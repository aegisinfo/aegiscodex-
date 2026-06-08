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
class FocusManagerImpl {
  private state: FocusState = {
    currentFocus: FocusId.MAIN_INPUT,
    previousFocus: null,
    focusStack: [FocusId.MAIN_INPUT],
  };
  
  private listeners: Set<FocusListener> = new Set();

  /**
   * 
   */
  getState(): FocusState {
    return { ...this.state };
  }

  /**
   * 
   */
  getCurrentFocus(): FocusId {
    return this.state.currentFocus;
  }

  /**
   * 
   */
  setFocus(id: FocusId): void {
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
  pushFocus(id: FocusId): void {
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
  popFocus(): void {
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
  resetFocus(): void {
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
  subscribe(listener: FocusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 
   */
  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /**
   * 
   */
  getActions(): FocusActions {
    return {
      setFocus: (id: FocusId) => this.setFocus(id),
      popFocus: () => this.popFocus(),
      resetFocus: () => this.resetFocus(),
      pushFocus: (id: FocusId) => this.pushFocus(id),
    };
  }
}

// 导出单
export const focusManager = new FocusManagerImpl();

// 导出操作快捷方
export const focusActions = focusManager.getActions();
