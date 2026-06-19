/**
 * App Slice - 应用状态管理
 */
const initialAppState = {
    initializationStatus: 'pending',
    initializationError: null,
    activeModal: 'none',
    todos: [],
    awaitingSecondCtrlC: false,
    showAllThinking: false,
    manualModelOverride: false,
    autoRouterActiveModel: null,
};
export const createAppSlice = (set, get) => ({
    ...initialAppState,
    actions: {
        /**
         *
         */
        setInitializationStatus: (status) => {
            set((state) => ({
                app: { ...state.app, initializationStatus: status },
            }));
        },
        /**
         *
         */
        setInitializationError: (error) => {
            set((state) => ({
                app: {
                    ...state.app,
                    initializationError: error,
                    initializationStatus: error ? 'error' : state.app.initializationStatus,
                },
            }));
        },
        /**
         *
         */
        setActiveModal: (modal) => {
            set((state) => ({
                app: { ...state.app, activeModal: modal },
            }));
        },
        /**
         *
         */
        setTodos: (todos) => {
            set((state) => ({
                app: { ...state.app, todos },
            }));
        },
        /**
         *
         */
        addTodo: (todo) => {
            set((state) => ({
                app: {
                    ...state.app,
                    todos: [...state.app.todos, todo],
                },
            }));
        },
        /**
         *
         */
        updateTodo: (id, updates) => {
            set((state) => ({
                app: {
                    ...state.app,
                    todos: state.app.todos.map((todo) => todo.id === id ? { ...todo, ...updates } : todo),
                },
            }));
        },
        /**
         *
         */
        removeTodo: (id) => {
            set((state) => ({
                app: {
                    ...state.app,
                    todos: state.app.todos.filter((todo) => todo.id !== id),
                },
            }));
        },
        /**
         *
         */
        setAwaitingSecondCtrlC: (awaiting) => {
            set((state) => ({
                app: { ...state.app, awaitingSecondCtrlC: awaiting },
            }));
        },
        /**
         *
         */
        toggleShowAllThinking: () => {
            set((state) => ({
                app: { ...state.app, showAllThinking: !state.app.showAllThinking },
            }));
        },
        /**
         *
         */
        setManualModelOverride: (value) => {
            set((state) => ({
                app: { ...state.app, manualModelOverride: value },
            }));
        },
        /**
         *
         */
        setAutoRouterActiveModel: (label) => {
            set((state) => ({
                app: { ...state.app, autoRouterActiveModel: label },
            }));
        },
    },
});
//# sourceMappingURL=appSlice.js.map