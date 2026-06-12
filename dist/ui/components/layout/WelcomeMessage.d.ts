/**
 * WelcomeMessage - animated ink-flow reveal on startup
 *
 * The ASCII logo is swept character-by-character (left→right, top→bottom)
 * with a colour gradient: dim (unwritten) → white nib → wet teal → dry primary.
 * After the sweep, content phases in sequentially.
 */
import React from 'react';
interface WelcomeMessageProps {
    terminalWidth: number;
}
export declare const WelcomeMessage: React.FC<WelcomeMessageProps>;
export default WelcomeMessage;
//# sourceMappingURL=WelcomeMessage.d.ts.map