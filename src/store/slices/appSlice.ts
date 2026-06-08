/**
 * App Slice - 应用状态管理
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, AppSlice, InitializationStatus, ActiveModal, TodoItem } from '../types.js';

const initialAppState = {
  initializationStatus: 'pending' as InitializationStatus,
  initializationError: null as string | null,
  activeModal: 'none' as ActiveModal,
  todos: [] as TodoItem[],
  awaitingSecondCtrlC: false,
  showAllThinking: false,
};

export const createAppSlice: StateCreator<
  ClawdStore,
  [],
  [],
  AppSlice
> = (set, get) => ({
  ...initialAppState,

  actions: {
    /**
     * 
     */
    setInitializationStatus: (status: InitializationStatus) => {
      set((state) => ({
        app: { ...state.app, initializationStatus: status },
      }));
    },

    /**
     * 
     */
    setInitializationError: (error: string | null) => {
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
    setActiveModal: (modal: ActiveModal) => {
      set((state) => ({
        app: { ...state.app, activeModal: modal },
      }));
    },

    /**
     * 
     */
    setTodos: (todos: TodoItem[]) => {
      set((state) => ({
        app: { ...state.app, todos },
      }));
    },

    /**
     * 
     */
    addTodo: (todo: TodoItem) => {
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
    updateTodo: (id: string, updates: Partial<TodoItem>) => {
      set((state) => ({
        app: {
          ...state.app,
          todos: state.app.todos.map((todo) =>
            todo.id === id ? { ...todo, ...updates } : todo
          ),
        },
      }));
    },

    /**
     * 
     */
    removeTodo: (id: string) => {
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
    setAwaitingSecondCtrlC: (awaiting: boolean) => {
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
  },
});
