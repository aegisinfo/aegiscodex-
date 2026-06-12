/**
 * useInputBuffer - 输入缓冲区管理
 *
 *
 */
interface InputBufferResult {
    /** 当前输入值 */
    value: string;
    /** 光标位置 */
    cursorPosition: number;
    /** 设置输入值 */
    setValue: (newValue: string) => void;
    /** 设置光标位置 */
    setCursorPosition: (pos: number) => void;
    /** 在光标位置插入文本 */
    insertAt: (text: string) => void;
    /** 删除光标前的字符 */
    deleteBackward: () => void;
    /** 删除光标后的字符 */
    deleteForward: () => void;
    /** 清空输入 */
    clear: () => void;
    /** 移动光标到开头 */
    moveToStart: () => void;
    /** 移动光标到结尾 */
    moveToEnd: () => void;
    /** 获取当前引用（用于避免重渲染时的闭包问题） */
    getRef: () => {
        value: string;
        cursorPosition: number;
    };
}
/**
 *
 */
export declare const useInputBuffer: (initialValue?: string, initialCursor?: number) => InputBufferResult;
export {};
//# sourceMappingURL=useInputBuffer.d.ts.map