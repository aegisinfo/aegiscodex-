/**
 * ChatSearch - Ctrl+F inline search within messages
 *
 * Shows a search bar overlay when activated via Ctrl+F.
 * Highlights matching messages and allows cycling through results.
 */
import React from 'react';
import type { FocusId } from '../../focus/index.js';
interface ChatSearchProps {
    /** Called when search is dismissed */
    onDismiss: () => void;
    /** Called with indices of matching messages */
    onResults?: (indices: number[], currentIndex: number) => void;
    /** The focus ID for input capture */
    focusId?: FocusId;
}
export declare const ChatSearch: React.FC<ChatSearchProps>;
export default ChatSearch;
//# sourceMappingURL=ChatSearch.d.ts.map