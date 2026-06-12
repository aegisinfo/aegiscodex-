/**
 * Config Slice - 配置状态管理
 */
export const createConfigSlice = (set) => ({
    config: null,
    actions: {
        /**
         *
         */
        setConfig: (config) => {
            set((state) => ({
                config: { ...state.config, config },
            }));
        },
        /**
         *
         */
        updateConfig: (partial) => {
            set((state) => {
                if (!state.config.config) {
                    console.warn('[ConfigSlice] Config not initialized, cannot update');
                    return state;
                }
                return {
                    config: {
                        ...state.config,
                        config: { ...state.config.config, ...partial },
                    },
                };
            });
        },
    },
});
//# sourceMappingURL=configSlice.js.map