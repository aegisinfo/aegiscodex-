/**
 * 
 */

/**
 * 
 * 
 */
export enum FocusId {
  
  MAIN_INPUT = 'main-input',
  
  CONFIRMATION_PROMPT = 'confirmation-prompt',
  
  THEME_SELECTOR = 'theme-selector',
  
  MODEL_SELECTOR = 'model-selector',
  
  SESSION_SELECTOR = 'session-selector',
  
  FILE_SELECTOR = 'file-selector',
  
  HELP_PANEL = 'help-panel',
  
  SELECTOR = 'selector',
  
  NONE = 'none',
}

/**
 * 
 */
export interface FocusState {
  
  currentFocus: FocusId;
  
  previousFocus: FocusId | null;
  
  focusStack: FocusId[];
}

/**
 * 
 */
export interface FocusActions {
  
  setFocus: (id: FocusId) => void;
  
  popFocus: () => void;
  
  resetFocus: () => void;
  
  pushFocus: (id: FocusId) => void;
}
