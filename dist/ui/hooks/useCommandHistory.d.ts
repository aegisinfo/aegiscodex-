/**
 * useCommandHistory - 命令历史管理
 */
interface CommandHistoryResult {
    /** 添加命令到历史 */
    addToHistory: (command: string) => void;
    /** 获取上一条命令 */
    getPreviousCommand: () => string | null;
    /** 获取下一条命令 */
    getNextCommand: () => string | null;
    /** 重置历史索引 */
    resetIndex: () => void;
    /** 历史记录 */
    history: string[];
    /** 当前索引 */
    historyIndex: number;
}
/**
 *
 *
 */
export declare const useCommandHistory: (maxHistory?: number) => CommandHistoryResult;
export {};
//# sourceMappingURL=useCommandHistory.d.ts.map