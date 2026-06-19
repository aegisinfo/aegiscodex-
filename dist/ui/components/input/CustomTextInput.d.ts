import React from 'react';
import { FocusId } from '../../focus/index.js';
interface CustomTextInputProps {
    value: string;
    cursorPosition: number;
    /** Cursor visibility — computed by parent so this component doesn't re-render every tick */
    cursorOn?: boolean;
    onChange: (value: string) => void;
    onChangeCursorPosition: (pos: number) => void;
    onSubmit?: (value: string) => void;
    onPaste?: (text: string) => {
        prompt?: string;
    } | void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    placeholder?: string;
    focusId?: FocusId;
    disabled?: boolean;
}
export declare const CustomTextInput: React.FC<CustomTextInputProps>;
export default CustomTextInput;
//# sourceMappingURL=CustomTextInput.d.ts.map