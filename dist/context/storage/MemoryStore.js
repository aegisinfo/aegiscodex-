/**
 *
 *
 *
 */
export class MemoryStore {
    contextData = null;
    maxSize;
    accessLog = new Map();
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
    }
    /**
     *
     */
    setContext(data) {
        this.contextData = data;
        this.recordAccess('context');
    }
    /**
     *
     */
    getContext() {
        this.recordAccess('context');
        return this.contextData;
    }
    /**
     *
     */
    hasData() {
        return this.contextData !== null;
    }
    /**
     *
     */
    addMessage(message) {
        if (!this.contextData) {
            throw new Error('上下文数据未初始化');
        }
        this.contextData.layers.conversation.messages.push(message);
        this.contextData.layers.conversation.lastActivity = Date.now();
        this.contextData.metadata.lastUpdated = Date.now();
        // 检查是否超过大小限
        this.enforceMemoryLimit();
        this.recordAccess('messages');
    }
    /**
     *
     */
    getMessages() {
        if (!this.contextData) {
            return [];
        }
        this.recordAccess('messages');
        return this.contextData.layers.conversation.messages;
    }
    /**
     *
     */
    setMessages(messages) {
        if (!this.contextData) {
            throw new Error('上下文数据未初始化');
        }
        this.contextData.layers.conversation.messages = messages;
        this.contextData.metadata.lastUpdated = Date.now();
    }
    /**
     *
     */
    addToolCall(toolCall) {
        if (!this.contextData) {
            throw new Error('上下文数据未初始化');
        }
        this.contextData.layers.tool.recentCalls.push(toolCall);
        this.contextData.metadata.lastUpdated = Date.now();
        // 限制工具调用记录数
        const maxToolCalls = 100;
        if (this.contextData.layers.tool.recentCalls.length > maxToolCalls) {
            this.contextData.layers.tool.recentCalls =
                this.contextData.layers.tool.recentCalls.slice(-maxToolCalls);
        }
        this.recordAccess('toolCalls');
    }
    /**
     *
     */
    updateToolCallResult(toolCallId, output, error) {
        if (!this.contextData)
            return;
        const toolCall = this.contextData.layers.tool.recentCalls.find(tc => tc.id === toolCallId);
        if (toolCall) {
            toolCall.output = output;
            toolCall.status = error ? 'error' : 'success';
            if (error) {
                toolCall.error = error;
            }
            this.contextData.metadata.lastUpdated = Date.now();
        }
    }
    /**
     *
     */
    getRecentToolCalls(count = 10) {
        if (!this.contextData) {
            return [];
        }
        return this.contextData.layers.tool.recentCalls.slice(-count);
    }
    /**
     *
     */
    updateTokenCount(tokens) {
        if (!this.contextData)
            return;
        this.contextData.metadata.totalTokens = tokens;
        this.contextData.metadata.lastUpdated = Date.now();
    }
    /**
     *
     */
    getTokenCount() {
        return this.contextData?.metadata.totalTokens ?? 0;
    }
    /**
     *
     */
    enforceMemoryLimit() {
        if (!this.contextData)
            return;
        const messages = this.contextData.layers.conversation.messages;
        if (messages.length > this.maxSize) {
            // 保留最近的消息，删除较旧
            const keepCount = Math.floor(this.maxSize * 0.8); // 保
            this.contextData.layers.conversation.messages = messages.slice(-keepCount);
        }
    }
    /**
     *
     */
    recordAccess(key) {
        this.accessLog.set(key, Date.now());
    }
    /**
     *
     */
    getLastAccess(key) {
        return this.accessLog.get(key);
    }
    /**
     *
     */
    getMemoryInfo() {
        if (!this.contextData) {
            return { hasData: false, messageCount: 0, toolCallCount: 0, lastUpdated: null };
        }
        return {
            hasData: true,
            messageCount: this.contextData.layers.conversation.messages.length,
            toolCallCount: this.contextData.layers.tool.recentCalls.length,
            lastUpdated: this.contextData.metadata.lastUpdated,
        };
    }
    /**
     *
     */
    getSessionId() {
        return this.contextData?.layers.session.sessionId ?? null;
    }
    /**
     *
     */
    clear() {
        this.contextData = null;
        this.accessLog.clear();
    }
}
//# sourceMappingURL=MemoryStore.js.map