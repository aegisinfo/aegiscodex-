/**
 * UpdatePrompt - 版本更新提示组件
 *
 *
 * - Update now: 立即执行升级
 * - Skip: 跳过本次提示
 * - Skip until next version: 跳过当前版本的提示
 */
import React from 'react';
import type { VersionCheckResult } from '../../../services/VersionChecker.js';
interface UpdatePromptProps {
    versionInfo: VersionCheckResult;
    onComplete: () => void;
}
export declare const UpdatePrompt: React.FC<UpdatePromptProps>;
export default UpdatePrompt;
//# sourceMappingURL=UpdatePrompt.d.ts.map