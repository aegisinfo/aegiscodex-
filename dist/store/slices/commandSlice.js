/**
 * Command Slice - 命令状态管理
 */
const initialCommandState = {
    isProcessing: false,
    abortController: null,
    pendingCommands: [],
};
export const createCommandSlice = (set, get) => ({
    ...initialCommandState,
    actions: {
        /**
         *
         */
        setProcessing: (isProcessing) => {
            set((state) => ({
                command: { ...state.command, isProcessing },
            }));
        },
        /**
         *
         */
        createAbortController: () => {
            const controller = new AbortController();
            set((state) => ({
                command: { ...state.command, abortController: controller },
            }));
            return controller;
        },
        /**
         *
         * - 发送 abort signal
         * - 重置 isProcessing
         * - 重置 isThinking (跨 slice)
         * - 清空待处理队列
         */
        abort: () => {
            const { abortController } = get().command;
            if (abortController && !abortController.signal.aborted) {
                abortController.abort();
            }
            // 重置 session 的 isThinking 状
            get().session.actions.setThinking(false);
            // 重置 command 状态并清空队
            set((state) => ({
                command: {
                    ...state.command,
                    isProcessing: false,
                    abortController: null,
                    pendingCommands: [],
                },
            }));
        },
        /**
         *
         */
        enqueueCommand: (command) => {
            set((state) => ({
                command: {
                    ...state.command,
                    pendingCommands: [...state.command.pendingCommands, command],
                },
            }));
        },
        /**
         *
         */
        dequeueCommand: () => {
            const { pendingCommands } = get().command;
            if (pendingCommands.length === 0) {
                return undefined;
            }
            const [nextCommand, ...rest] = pendingCommands;
            set((state) => ({
                command: {
                    ...state.command,
                    pendingCommands: rest,
                },
            }));
            return nextCommand;
        },
        /**
         *
         */
        clearQueue: () => {
            set((state) => ({
                command: {
                    ...state.command,
                    pendingCommands: [],
                },
            }));
        },
    },
});
//# sourceMappingURL=commandSlice.js.map