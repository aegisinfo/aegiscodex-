/**
 * useCommandProcessor - Command processing hook
 *
 * Extracts the core command processing logic (slash commands, agent chat,
 * streaming, tool calls, auto-compaction) from AegisInterface.
 */
import { useCallback, useRef } from 'react';
import { TokenCounter } from '../../context/index.js';
import { sessionActions, commandActions, appActions, getState, } from '../../store/index.js';
import { classifyComplexity, resolveModelForTier } from '../../agent/router.js';
import { applyStreamEvent, finishToolCallInBuffer, getBufferedToolCalls, } from '../../store/streaming-buffer.js';
export function useCommandProcessor(options) {
    const { agentRef, contextManagerRef, modelRef, debugRef, getMessagesRef, confirmationHandlerRef, onSelectorRequest, } = options;
    // Auto-router: lazily-created Agent instances per model id, keyed by config
    // model id, reused across turns so picking the same tier twice in a row
    // doesn't pay an Agent.create() again.
    const routerAgentCacheRef = useRef(new Map());
    // Which model id the auto-router last swapped agentRef.current to (or
    // undefined if it's still whatever /model or initial setup left it as).
    const routerActiveModelIdRef = useRef(undefined);
    const processCommand = useCallback(async (value, options) => {
        const { isSlashCommand, executeSlashCommand } = await import('../../slash-commands/index.js');
        const { vanillaStore } = await import('../../store/vanilla.js');
        const { startBatch, batchAddUserMessage, batchAddAssistantMessage, batchSetThinking, flushBatchWithStore, cancelBatch } = await import('../../store/streaming-buffer.js');
        const streamingBuf = await import('../../store/streaming-buffer.js');
        if (isSlashCommand(value)) {
            // Phase 1: flush user message + thinking=true immediately
            sessionActions().setCurrentCommand(value);
            startBatch();
            batchAddUserMessage(value);
            batchSetThinking(true);
            flushBatchWithStore(vanillaStore);
            let streamingMsgId = null;
            let streamingResult = null;
            try {
                streamingMsgId = sessionActions().startStreamingMessage();
            }
            catch { /* streaming not available */ }
            const onContentDelta = streamingMsgId
                ? (delta) => { streamingBuf.appendToBuffer(delta); }
                : undefined;
            try {
                streamingResult = await executeSlashCommand(value, {
                    cwd: process.cwd(),
                    sessionId: getState().session.sessionId,
                    messages: getMessagesRef.current(),
                    contextManager: contextManagerRef.current,
                    chatService: agentRef.current?.getChatService(),
                    modelName: modelRef.current,
                    onContentDelta,
                    onThinkingDelta: streamingMsgId
                        ? (delta) => { streamingBuf.appendThinkingToBuffer(delta); }
                        : undefined,
                    confirmationHandler: confirmationHandlerRef.current,
                });
                if (streamingResult.type === 'selector' && streamingResult.selector) {
                    sessionActions().setCurrentCommand(null);
                    sessionActions().setThinking(false);
                    if (streamingMsgId)
                        sessionActions().finishStreamingMessage(streamingMsgId);
                    // Rollback: remove user command message + empty streaming message
                    // so WelcomeScreen stays visible (messages.length === 0)
                    sessionActions().removeLastMessages(2);
                    onSelectorRequest?.(streamingResult.selector);
                    return;
                }
                if (streamingResult.sendToAgent && streamingResult.content) {
                    // Don't clear currentCommand — it continues via processCommand below
                    sessionActions().setThinking(false);
                    if (streamingMsgId)
                        sessionActions().finishStreamingMessage(streamingMsgId);
                    await processCommand(streamingResult.content, { silent: true });
                    return;
                }
                if (streamingResult.type === 'silent') {
                    if (streamingMsgId)
                        sessionActions().finishStreamingMessage(streamingMsgId);
                    sessionActions().setCurrentCommand(null);
                    sessionActions().setThinking(false);
                    return;
                }
                startBatch();
                if (streamingResult.content) {
                    batchAddAssistantMessage(streamingResult.content);
                }
                else if (streamingResult.message) {
                    batchAddAssistantMessage(streamingResult.message);
                }
                else if (streamingResult.error) {
                    batchAddAssistantMessage('error: ' + streamingResult.error);
                }
            }
            catch (error) {
                startBatch();
                batchAddAssistantMessage('error: ' + (error instanceof Error ? error.message : String(error)));
            }
            finally {
                if (streamingMsgId && streamingResult?.type !== 'silent') {
                    try {
                        sessionActions().finishStreamingMessage(streamingMsgId);
                    }
                    catch { }
                }
                sessionActions().setCurrentCommand(null);
                batchSetThinking(false);
                flushBatchWithStore(vanillaStore);
            }
            return;
        }
        if (!agentRef.current || !contextManagerRef.current)
            return;
        const ctxManager = contextManagerRef.current;
        // ==================== Auto-router ====================
        // Pick a model for this turn based on task complexity, unless the user
        // has manually chosen one with /model this session. Never throws —
        // a classification or Agent.create failure just leaves the current
        // agent/model in place.
        // Captured here, recorded after the chat call resolves/aborts below —
        // this is the learning loop's only outcome signal (see routerStats.ts).
        let routedTier;
        let routedModelId;
        try {
            const routerState = getState();
            const autoRouter = routerState.config.config?.autoRouter;
            const defaultModelId = routerState.config.config?.currentModelId;
            const activeModelId = routerActiveModelIdRef.current ?? defaultModelId;
            if (autoRouter?.enabled && !routerState.app.manualModelOverride) {
                const models = routerState.config.config?.models || [];
                const tier = classifyComplexity(value);
                const targetModel = resolveModelForTier(tier, models, autoRouter.tiers);
                const targetId = targetModel?.id;
                const targetLabel = targetModel ? (targetModel.model || targetId) : undefined;
                if (targetModel && targetId && targetId !== activeModelId) {
                    let agent = routerAgentCacheRef.current.get(targetId);
                    if (!agent) {
                        const { Agent } = await import('../../agent/Agent.js');
                        agent = await Agent.create({
                            apiKey: targetModel.apiKey,
                            baseURL: targetModel.baseURL,
                            model: targetLabel,
                        });
                        routerAgentCacheRef.current.set(targetId, agent);
                    }
                    agentRef.current = agent;
                    modelRef.current = targetLabel;
                    routerActiveModelIdRef.current = targetId;
                }
                if (targetId) {
                    routedTier = tier;
                    routedModelId = targetId;
                }
                appActions().setAutoRouterActiveModel(targetId && targetId !== defaultModelId ? (targetLabel ?? null) : null);
            }
        }
        catch { /* non-fatal — keep using whatever agent is already active */ }
        // Capture the agent for this turn by value now that routing is decided.
        // Several awaits follow before chat() actually dispatches; reading
        // `agentRef.current` fresh at each of those points would let a
        // concurrent /model switch (its Agent.create() resolves async, on its
        // own timeline) retarget a request that's already committed to this turn.
        const dispatchAgent = agentRef.current;
        if (!options?.silent) {
            sessionActions().addUserMessage(value);
        }
        sessionActions().setCurrentCommand(value);
        sessionActions().setThinking(true);
        const { onUserPromptSubmit } = await import('../../hooks/index.js');
        const injectedContext = await onUserPromptSubmit(value, getState().session.sessionId, process.cwd());
        if (injectedContext) {
            if (debugRef.current) {
                console.log('[DEBUG] Hook injected context:', injectedContext);
            }
            sessionActions().addAssistantMessage('[Hook] ' + injectedContext);
        }
        await ctxManager.addMessage('user', value);
        // Auto-compact when context approaches 80% of the token limit
        {
            const currentTokens = ctxManager.getTokenCount();
            const runtimeConfig = getState().config.config;
            const maxCtx = runtimeConfig?.maxContextTokens ?? 200000;
            if (currentTokens > 0 && currentTokens >= maxCtx * 0.8) {
                try {
                    sessionActions().setCompacting(true);
                    sessionActions().addAssistantMessage('⟳ Context near limit - auto-compacting...');
                    const { CompactionService } = await import('../../context/CompactionService.js');
                    const ctxMsgs = ctxManager.getMessages();
                    const msgs = ctxMsgs.map((m) => ({
                        role: m.role,
                        content: m.content,
                    }));
                    const result = await CompactionService.compact(msgs, {
                        modelName: modelRef.current || 'claude-sonnet-4-6',
                        maxContextTokens: maxCtx,
                        chatService: dispatchAgent?.getChatService(),
                        trigger: 'auto',
                        actualPreTokens: currentTokens,
                    });
                    if (result.success) {
                        const { nanoid } = await import('nanoid');
                        ctxManager.replaceMessages(result.compactedMessages.map((m) => ({
                            id: nanoid(),
                            role: m.role,
                            content: m.content,
                            timestamp: Date.now(),
                        })));
                        ctxManager.updateTokenCount(result.postTokens);
                        const saved = result.preTokens - result.postTokens;
                        sessionActions().addAssistantMessage(`✓ Auto-compact: ${result.preTokens.toLocaleString()} → ${result.postTokens.toLocaleString()} tokens (−${saved.toLocaleString()})`);
                    }
                }
                catch { /* non-fatal */ }
                finally {
                    sessionActions().setCompacting(false);
                }
            }
        }
        // Dual-path streaming: mutable buffer + store
        const streamingMessageId = sessionActions().startStreamingMessage();
        // Wire to store so Escape/Ctrl+C can actually abort the agent
        const abortController = commandActions().createAbortController();
        try {
            const contextMessages = ctxManager.getMessages();
            const modelName = modelRef.current || 'claude-sonnet-4-6';
            const inputTokens = TokenCounter.countTokens(contextMessages.map(m => ({ role: m.role, content: m.content })), modelName);
            const { nanoid } = await import('nanoid');
            const chatContext = {
                sessionId: ctxManager.getCurrentSessionId() || getState().session.sessionId,
                messages: contextMessages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                confirmationHandler: confirmationHandlerRef.current,
            };
            const result = await dispatchAgent.chat(value, chatContext, {
                signal: abortController.signal,
                onStreamEvent: (event) => {
                    if (!abortController.signal.aborted) {
                        applyStreamEvent(event);
                    }
                },
                onToolCallStart: (toolCall) => {
                    if (abortController.signal.aborted)
                        return;
                    sessionActions().flushStreamBuffer(streamingMessageId);
                    const name = toolCall.function?.name || 'tool';
                    const toolId = toolCall.id || `${name}-${Date.now()}`;
                    sessionActions().addContentBlock(streamingMessageId, {
                        type: 'tool_use',
                        id: toolId,
                        name,
                        input: '',
                        status: 'running',
                        startedAt: Date.now(),
                    });
                },
                onToolResult: (_toolCall, toolResult) => {
                    if (abortController.signal.aborted)
                        return;
                    const toolId = _toolCall.id;
                    const isError = !toolResult.success;
                    finishToolCallInBuffer(toolId, isError);
                    const bufferedCalls = getBufferedToolCalls();
                    const bufferedCall = bufferedCalls.find(tc => tc.id === toolId);
                    if (bufferedCall?.arguments) {
                        sessionActions().setToolCallInput(streamingMessageId, toolId, bufferedCall.arguments);
                    }
                    sessionActions().updateToolCallStatus(streamingMessageId, toolId, isError ? 'error' : 'success', Date.now());
                    const DISPLAY_CONTENT_CAP = 3000; // diffs need more room than plain text results
                    const resultContent = toolResult.error
                        ? (toolResult.error.length > 200 ? toolResult.error.slice(0, 200) + '...' : toolResult.error)
                        : (toolResult.displayContent
                            ? (toolResult.displayContent.length > DISPLAY_CONTENT_CAP ? toolResult.displayContent.slice(0, DISPLAY_CONTENT_CAP) + '...' : toolResult.displayContent)
                            : '');
                    sessionActions().addToolResultBlock(streamingMessageId, toolId, resultContent, isError);
                },
            });
            sessionActions().finishStreamingMessage(streamingMessageId);
            await ctxManager.addMessage('assistant', result);
            const outputTokens = TokenCounter.countTextTokens(result, modelName);
            const totalTokens = inputTokens + outputTokens;
            ctxManager.updateTokenCount(totalTokens);
            const currentTokenUsage = getState().session.tokenUsage;
            const prevModel = currentTokenUsage.modelBreakdown[modelName] ?? { inputTokens: 0, outputTokens: 0 };
            sessionActions().updateTokenUsage({
                inputTokens: currentTokenUsage.inputTokens + inputTokens,
                outputTokens: currentTokenUsage.outputTokens + outputTokens,
                modelBreakdown: {
                    ...currentTokenUsage.modelBreakdown,
                    [modelName]: {
                        inputTokens: prevModel.inputTokens + inputTokens,
                        outputTokens: prevModel.outputTokens + outputTokens,
                    },
                },
            });
            if (debugRef.current) {
                console.log('[DEBUG] Token usage - input:', inputTokens, 'output:', outputTokens);
                console.log('[DEBUG] Total context tokens:', ctxManager.getTokenCount());
            }
            if (routedTier && routedModelId) {
                const { recordRouterOutcome } = await import('../../agent/routerStats.js');
                recordRouterOutcome(routedTier, routedModelId, true);
            }
        }
        catch (error) {
            if (routedTier && routedModelId) {
                const { recordRouterOutcome } = await import('../../agent/routerStats.js');
                recordRouterOutcome(routedTier, routedModelId, false);
            }
            if (error?.name !== 'AbortError') {
                const errorContent = 'Error: ' + error.message;
                sessionActions().forceAppendToMessage(streamingMessageId, errorContent);
                sessionActions().finishStreamingMessage(streamingMessageId);
                await ctxManager.addMessage('assistant', errorContent);
            }
            else {
                sessionActions().finishStreamingMessage(streamingMessageId);
            }
        }
        finally {
            sessionActions().setCurrentCommand(null);
            sessionActions().setThinking(false);
        }
    }, [onSelectorRequest]);
    const processQueue = useCallback(async () => {
        const nextCommand = commandActions().dequeueCommand();
        if (nextCommand) {
            if (debugRef.current) {
                console.log('[DEBUG] Processing queued command:', nextCommand);
            }
            await processCommand(nextCommand);
        }
    }, [processCommand]);
    const handleSubmit = useCallback(async (value) => {
        if (!value.trim())
            return;
        const currentState = getState();
        const currentIsThinking = currentState.session.isThinking;
        const currentPendingCount = currentState.command.pendingCommands.length;
        if (currentIsThinking) {
            commandActions().enqueueCommand(value);
            if (debugRef.current) {
                console.log('[DEBUG] Command queued:', value, 'Queue size:', currentPendingCount + 1);
            }
            return;
        }
        await processCommand(value);
    }, [processCommand]);
    return { processCommand, handleSubmit, processQueue };
}
//# sourceMappingURL=useCommandProcessor.js.map