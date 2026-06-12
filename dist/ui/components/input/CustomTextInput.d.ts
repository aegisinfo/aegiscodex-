/**
 * CustomTextInput - 自定义文本输入组件
 *
 *
 */
import React from 'react';
import { FocusId } from '../../focus/index.js';
interface CustomTextInputProps {
    /** 输入值 */
    value: string;
    /** 光标位置 */
    cursorPosition: number;
    /** 值变化回调 */
    onChange: (value: string) => void;
    /** 光标位置变化回调 */
    onChangeCursorPosition: (pos: number) => void;
    /** 提交回调 */
    onSubmit?: (value: string) => void;
    /** 粘贴回调 */
    onPaste?: (text: string) => {
        prompt?: string;
    } | void;
    /** 上箭头回调（浏览历史） */
    onArrowUp?: () => void;
    /** 下箭头回调（浏览历史） */
    onArrowDown?: () => void;
    /** 占位符 */
    placeholder?: string;
    /** 焦点 ID */
    focusId?: FocusId;
    /** 是否禁用 */
    disabled?: boolean;
}
/**
 *
 */
export declare const CustomTextInput: React.FC<CustomTextInputProps>;
export default CustomTextInput;
//# sourceMappingURL=CustomTextInput.d.ts.map