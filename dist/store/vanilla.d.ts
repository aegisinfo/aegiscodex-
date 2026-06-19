/**
 * Zustand Vanilla Store
 *
 *
 */
import type { ClawdStore } from './types.js';
import type { RuntimeConfig } from '../config/types.js';
/**
 *
 *
 *
 * - devtools: 开发工具支持
 * - subscribeWithSelector: 支持选择器订阅
 */
export declare const vanillaStore: Omit<Omit<import("zustand/vanilla").StoreApi<ClawdStore>, "setState" | "devtools"> & {
    setState(partial: ClawdStore | Partial<ClawdStore> | ((state: ClawdStore) => ClawdStore | Partial<ClawdStore>), replace?: false | undefined, action?: (string | {
        [x: string]: unknown;
        [x: number]: unknown;
        [x: symbol]: unknown;
        type: string;
    }) | undefined): void;
    setState(state: ClawdStore | ((state: ClawdStore) => ClawdStore), replace: true, action?: (string | {
        [x: string]: unknown;
        [x: number]: unknown;
        [x: symbol]: unknown;
        type: string;
    }) | undefined): void;
    devtools: {
        cleanup: () => void;
    };
}, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: ClawdStore, previousSelectedState: ClawdStore) => void): () => void;
        <U>(selector: (state: ClawdStore) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
};
/**
 *
 */
export declare const getState: () => ClawdStore;
/**
 *
 */
export declare const subscribe: {
    (listener: (selectedState: ClawdStore, previousSelectedState: ClawdStore) => void): () => void;
    <U>(selector: (state: ClawdStore) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
        equalityFn?: ((a: U, b: U) => boolean) | undefined;
        fireImmediately?: boolean;
    } | undefined): () => void;
};
export declare const sessionActions: () => import("./types.js").SessionActions;
export declare const configActions: () => import("./types.js").ConfigActions;
export declare const appActions: () => import("./types.js").AppActions;
export declare const focusActions: () => import("./types.js").FocusActions;
export declare const commandActions: () => import("./types.js").CommandActions;
/**
 *
 */
export declare const getConfig: () => RuntimeConfig | null;
/**
 *
 */
export declare const getCurrentModel: () => {
    name?: string | undefined;
    id?: string | undefined;
    provider?: "openai-compatible" | "anthropic" | undefined;
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    model?: string | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
} | undefined;
/**
 *
 */
export declare const getPermissionMode: () => "default" | "autoEdit" | "yolo" | "plan";
/**
 *
 *
 *
 * - 幂等：已初始化直接返回
 * - 并发安全：共享 Promise
 * - 失败重试：下次调用重新尝试
 */
export declare function ensureStoreInitialized(): Promise<void>;
/**
 *
 */
export declare function subscribeToState<T>(selector: (state: ClawdStore) => T, callback: (value: T, prevValue: T) => void): () => void;
/**
 *
 */
export declare function subscribeToTodos(callback: (todos: ClawdStore['app']['todos']) => void): () => void;
/**
 *
 */
export declare function subscribeToMessages(callback: (messages: ClawdStore['session']['messages']) => void): () => void;
//# sourceMappingURL=vanilla.d.ts.map