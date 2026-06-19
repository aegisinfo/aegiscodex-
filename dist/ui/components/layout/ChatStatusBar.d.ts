/**
 * ChatStatusBar — Claude Code style minimal status bar
 */
import React from 'react';
interface ChatStatusBarProps {
    model?: string;
    /** True when `model` was picked by the auto-router rather than /model */
    modelIsAuto?: boolean;
    isVisible?: boolean;
    isScrolledUp?: boolean;
    renderLatency?: number;
    routerEnabled?: boolean;
    onToggleRouter?: () => void;
}
export declare const ChatStatusBar: React.FC<ChatStatusBarProps>;
export default ChatStatusBar;
//# sourceMappingURL=ChatStatusBar.d.ts.map