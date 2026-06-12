/**
 * ConfirmationPrompt - 权限确认组件
 *
 *
 */
import React from 'react';
import type { ConfirmationDetails, ConfirmationResponse } from '../../../agent/types.js';
interface ConfirmationPromptProps {
    details: ConfirmationDetails;
    onResponse: (response: ConfirmationResponse) => void;
}
export declare const ConfirmationPrompt: React.FC<ConfirmationPromptProps>;
/**
 *
 *
 */
export declare function createAutoConfirmationHandler(mode?: 'approve' | 'deny' | 'approve_session'): (details: ConfirmationDetails) => Promise<ConfirmationResponse>;
export default ConfirmationPrompt;
//# sourceMappingURL=ConfirmationPrompt.d.ts.map