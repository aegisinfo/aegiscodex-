/**
 *
 *
 *
 */
import { FocusId, type FocusState, type FocusActions } from './types.js';
type FocusListener = (state: FocusState) => void;
/**
 *
 */
declare class FocusManagerImpl {
    private state;
    private listeners;
    /**
     *
     */
    getState(): FocusState;
    /**
     *
     */
    getCurrentFocus(): FocusId;
    /**
     *
     */
    setFocus(id: FocusId): void;
    /**
     *
     */
    pushFocus(id: FocusId): void;
    /**
     *
     */
    popFocus(): void;
    /**
     *
     */
    resetFocus(): void;
    /**
     *
     */
    subscribe(listener: FocusListener): () => void;
    /**
     *
     */
    private notify;
    /**
     *
     */
    getActions(): FocusActions;
}
export declare const focusManager: FocusManagerImpl;
export declare const focusActions: FocusActions;
export {};
//# sourceMappingURL=FocusManager.d.ts.map