/**
 *
 *
 *
 */
import { FocusId } from './types.js';
/**
 *
 */
class FocusManagerImpl {
    state = {
        currentFocus: FocusId.MAIN_INPUT,
        previousFocus: null,
        focusStack: [FocusId.MAIN_INPUT],
    };
    listeners = new Set();
    /**
     *
     */
    getState() {
        return { ...this.state };
    }
    /**
     *
     */
    getCurrentFocus() {
        return this.state.currentFocus;
    }
    /**
     *
     */
    setFocus(id) {
        if (this.state.currentFocus === id) {
            return;
        }
        this.state = {
            currentFocus: id,
            previousFocus: this.state.currentFocus,
            focusStack: [...this.state.focusStack, id],
        };
        this.notify();
    }
    /**
     *
     */
    pushFocus(id) {
        this.state = {
            currentFocus: id,
            previousFocus: this.state.currentFocus,
            focusStack: [...this.state.focusStack, id],
        };
        this.notify();
    }
    /**
     *
     */
    popFocus() {
        if (this.state.focusStack.length <= 1) {
            return;
        }
        const newStack = this.state.focusStack.slice(0, -1);
        const previousFocus = newStack[newStack.length - 1] || FocusId.MAIN_INPUT;
        this.state = {
            currentFocus: previousFocus,
            previousFocus: this.state.currentFocus,
            focusStack: newStack,
        };
        this.notify();
    }
    /**
     *
     */
    resetFocus() {
        this.state = {
            currentFocus: FocusId.MAIN_INPUT,
            previousFocus: this.state.currentFocus,
            focusStack: [FocusId.MAIN_INPUT],
        };
        this.notify();
    }
    /**
     *
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     *
     */
    notify() {
        const state = this.getState();
        for (const listener of this.listeners) {
            listener(state);
        }
    }
    /**
     *
     */
    getActions() {
        return {
            setFocus: (id) => this.setFocus(id),
            popFocus: () => this.popFocus(),
            resetFocus: () => this.resetFocus(),
            pushFocus: (id) => this.pushFocus(id),
        };
    }
}
// 导出单
export const focusManager = new FocusManagerImpl();
// 导出操作快捷方
export const focusActions = focusManager.getActions();
//# sourceMappingURL=FocusManager.js.map