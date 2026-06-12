/**
 * CommandSuggestions - Dropdown autocomplete for slash commands
 *
 * Shows fuzzy-matched command suggestions when user types "/..."
 */
import React from 'react';
interface CommandSuggestionsProps {
    /** The current input value */
    input: string;
    /** Cursor position */
    cursorPosition: number;
    /** Callback to set input value (for tab-complete) */
    onSelectSuggestion: (suggestion: string) => void;
    /** Whether suggestions are visible */
    visible: boolean;
}
export declare const CommandSuggestions: React.FC<CommandSuggestionsProps>;
export default CommandSuggestions;
//# sourceMappingURL=CommandSuggestions.d.ts.map