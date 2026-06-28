/**
 * App Slice - 应用状态管理
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, AppSlice, InitializationStatus, ActiveModal, TodoItem, WorkflowState } from '../types.js';
import { initialWorkflowState } from '../types.js';

const initialAppState = {
  initializationStatus: 'pending' as InitializationStatus,
  initializationError: null as string | null,
  activeModal: 'none' as ActiveModal,
  todos: [] as TodoItem[],
  awaitingSecondCtrlC: false,
  showAllThinking: false,
  manualModelOverride: false,
  autoRouterActiveModel: null as string | null,
  workflow: { ...initialWorkflowState } as WorkflowState,
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

    /**
     *
     */
    setManualModelOverride: (value: boolean) => {
      set((state) => ({
        app: { ...state.app, manualModelOverride: value },
      }));
    },

    /**
     *
     */
    setAutoRouterActiveModel: (label: string | null) => {
      set((state) => ({
        app: { ...state.app, autoRouterActiveModel: label },
      }));
    },

    // ── Workflow ──────────────────────────────────────────
    workflow: {
      setWorkflow: (opts: { phase: string; target: string; steps: string[] }) => {
        set((state) => ({
          app: {
            ...state.app,
            workflow: {
              visible: true,
              phase: opts.phase,
              target: opts.target,
              steps: opts.steps.map((label, i) => ({
                label,
                status: i === 0 ? 'active' as const : 'pending' as const,
              })),
              currentStepIndex: 0,
              totalSteps: opts.steps.length,
            },
          },
        }));
      },

      advanceStep: () => {
        set((state) => {
          const wf = state.app.workflow;
          if (!wf.visible) return state;
          const nextIndex = wf.currentStepIndex + 1;
          if (nextIndex >= wf.totalSteps) {
            return {
              app: {
                ...state.app,
                workflow: { ...initialWorkflowState },
              },
            };
          }
          const updatedSteps = wf.steps.map((s, i) => ({
            ...s,
            status: i < nextIndex ? 'done' as const : i === nextIndex ? 'active' as const : 'pending' as const,
          }));
          return {
            app: {
              ...state.app,
              workflow: {
                ...wf,
                steps: updatedSteps,
                currentStepIndex: nextIndex,
              },
            },
          };
        });
      },

      clearWorkflow: () => {
        set((state) => ({
          app: {
            ...state.app,
            workflow: { ...initialWorkflowState },
          },
        }));
      },
    },
  },
});
