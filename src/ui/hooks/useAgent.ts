/**
 * useAgent - Agent lifecycle hook
 *
 * Extracts agent initialization, context management, and model switching
 * from AegisInterface into a focused, testable hook.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Agent } from '../../agent/Agent.js';
import { ContextManager } from '../../context/index.js';
import { sessionActions, appActions, configActions, getState, subscribe } from '../../store/index.js';
import type { ModelConfig } from '../../config/types.js';

export interface UseAgentOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
  debug?: boolean;
  resumeSessionId?: string;
}

export interface UseAgentResult {
  agentRef: React.MutableRefObject<Agent | null>;
  contextManagerRef: React.MutableRefObject<ContextManager | null>;
  isInitializing: boolean;
  initError: string | null;
  currentModel: string | undefined;
  setCurrentModel: React.Dispatch<React.SetStateAction<string | undefined>>;
  handleSetupComplete: () => Promise<void>;
  getAgent: () => Agent | null;
  getContextManager: () => ContextManager | null;
}

async function initHooks(sessionId: string): Promise<void> {
  try {
    const { ConfigManager } = await import('../../config/index.js');
    const cm = ConfigManager.getInstance();
    const { initializeHooks, onSessionStart } = await import('../../hooks/index.js');
    initializeHooks(cm.getConfig().hooks || {});
    await onSessionStart(sessionId, process.cwd());
  } catch { /* non-fatal */ }
}

export function useAgent(options: UseAgentOptions): UseAgentResult {
  const { apiKey, baseURL, model, debug, resumeSessionId } = options;

  const agentRef = useRef<Agent | null>(null);
  const contextManagerRef = useRef<ContextManager | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const currentModelIdRef = useRef(model);
  const [currentModel, setCurrentModel] = useState(model);

  const getAgent = useCallback(() => agentRef.current, []);
  const getContextManager = useCallback(() => contextManagerRef.current, []);

  // Stable option refs (prevents recreation of callbacks)
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const modelRef = useRef(model);
  modelRef.current = model;

  // ==================== Setup Completion ====================
  const handleSetupComplete = useCallback(async () => {
    setInitError(null);
    setIsInitializing(true);
    try {
      const { ConfigManager } = await import('../../config/index.js');
      const cm = ConfigManager.getInstance();
      await cm.initialize();
      const newModel = cm.getDefaultModel();

      // If we already have a ContextManager (e.g. session was loaded earlier),
      // preserve it instead of creating a new one
      if (!contextManagerRef.current) {
        contextManagerRef.current = new ContextManager({ compressionThreshold: 100000 });
      }
      const ctxManager = contextManagerRef.current;

      // Only create a new session if none exists
      let sid = ctxManager.getCurrentSessionId();
      if (!sid) {
        sid = await ctxManager.createSession();
      }
      sessionActions().setSessionId(sid);

      agentRef.current = await Agent.create({
        apiKey: newModel.apiKey!,
        baseURL: newModel.baseURL,
        model: newModel.model!,
      });

      const { initializeCustomCommands } = await import('../../slash-commands/index.js');
      await initializeCustomCommands(process.cwd());

      import('../../skills/index.js').then(({ initializeSkills }) => {
        initializeSkills(process.cwd()).catch(() => {});
      }).catch(() => {});

      await initHooks(sid);

      setIsInitializing(false);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err));
      setIsInitializing(false);
    }
  }, []);

  // ==================== Initialization ====================
  useEffect(() => {
    const initAgent = async () => {
      if (getState().app.initializationStatus === 'needsSetup') return;
      try {
        if (debugRef.current) {
          console.log('[DEBUG] Initializing Agent and ContextManager...');
        }

        const ctxManager = new ContextManager({ compressionThreshold: 100000 });
        contextManagerRef.current = ctxManager;

        let currentSessionId: string;

        if (resumeSessionId) {
          const loaded = await ctxManager.loadSession(resumeSessionId);
          if (loaded) {
            currentSessionId = resumeSessionId;
            const contextMessages = ctxManager.getMessages();
            // Batch-restore all messages in a single store update so MessageList's
            // scrollLineOffset initializes correctly (showing the bottom of history).
            // Adding messages one-by-one via addUserMessage/addAssistantMessage skips
            // auto-scroll for assistant messages, leaving scrollLineOffset at 0 (top).
            const restoredMessages: import('../../store/types.js').SessionMessage[] =
              contextMessages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map((m, i) => ({
                  id: `restored-${i}-${Date.now()}`,
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                  timestamp: m.timestamp || Date.now(),
                }));
            sessionActions().restoreSession(currentSessionId, restoredMessages);
            if (debugRef.current) {
              console.log('[DEBUG] Loaded session with', contextMessages.length, 'messages');
            }
          } else {
            if (debugRef.current) {
              console.log('[DEBUG] Failed to load session, creating new one');
            }
            currentSessionId = await ctxManager.createSession();
          }
        } else {
          currentSessionId = await ctxManager.createSession();
        }

        sessionActions().setSessionId(currentSessionId);

        agentRef.current = await Agent.create({ apiKey, baseURL, model });

        const { initializeCustomCommands } = await import('../../slash-commands/index.js');
        const customCmdResult = await initializeCustomCommands(process.cwd());
        if (debugRef.current && customCmdResult.count > 0) {
          console.log('[DEBUG] Loaded', customCmdResult.count, 'custom commands');
        }

        import('../../skills/index.js').then(({ initializeSkills }) => {
          initializeSkills(process.cwd()).catch(() => {});
        }).catch(() => {});

        await initHooks(currentSessionId);

        // One-time free-tier upgrade reminder
        try {
          const { sharedMemory } = await import('../../memory/SharedMemory.js');
          const reminder = sharedMemory.getUpgradeReminder(currentSessionId);
          if (reminder) sessionActions().addAssistantMessage(reminder);
        } catch { /* non-fatal */ }

        setIsInitializing(false);

        if (debugRef.current) {
          console.log('[DEBUG] Agent initialized successfully, sessionId:', currentSessionId);
        }
      } catch (error) {
        setInitError(error instanceof Error ? error.message : '');
        setIsInitializing(false);
      }
    };

    initAgent();

    return () => {
      contextManagerRef.current?.cleanup().catch(() => {});
    };
  }, [apiKey, baseURL, model, debug, resumeSessionId]);

  // ==================== Model Switch Subscription ====================
  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      const newModelId = state.config.config?.currentModelId;
      if (newModelId && newModelId !== currentModelIdRef.current) {
        currentModelIdRef.current = newModelId;
        const models = state.config.config?.models || [];
        const found = models.find((m: ModelConfig) => m.id === newModelId);
        if (found) {
          const displayName = found.model || found.id;
          setCurrentModel(displayName);
          modelRef.current = displayName;

          if (agentRef.current) {
            import('../../agent/Agent.js').then(({ Agent }) => {
              const apiKey = found.apiKey || process.env.OPENAI_API_KEY || '';
              if (!apiKey) return;
              Agent.create({
                apiKey,
                baseURL: found.baseURL || (found as ModelConfig & { baseUrl?: string }).baseUrl,
                model: displayName,
              }).then(agent => {
                agentRef.current = agent;
              }).catch(() => {});
            }).catch(() => {});
          }
        }
      }
    });
    return unsubscribe;
  }, []);

  return {
    agentRef,
    contextManagerRef,
    isInitializing,
    initError,
    currentModel,
    setCurrentModel,
    handleSetupComplete,
    getAgent,
    getContextManager,
  };
}
