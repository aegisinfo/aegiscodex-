/**
 * useConfirmation - 确认对话框状态管理
 *
 *
 *
 */
import type { ConfirmationHandler, ConfirmationDetails, ConfirmationResponse } from '../../tools/execution/types.js';
/**
 *
 */
interface ConfirmationState {
    isVisible: boolean;
    details: ConfirmationDetails | null;
    resolver: ((response: ConfirmationResponse) => void) | null;
}
interface UseConfirmationResult {
    /** 确认状态 */
    confirmationState: ConfirmationState;
    /** 确认处理器（供 Agent/Pipeline 使用） */
    confirmationHandler: ConfirmationHandler;
    /** 处理用户响应 */
    handleResponse: (response: ConfirmationResponse) => void;
    /** 显示确认对话框 */
    showConfirmation: (details: ConfirmationDetails) => Promise<ConfirmationResponse>;
}
/**
 *
 *
 *
 */
export declare const useConfirmation: () => UseConfirmationResult;
export {};
//# sourceMappingURL=useConfirmation.d.ts.map