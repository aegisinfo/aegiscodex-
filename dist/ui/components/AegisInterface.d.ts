/**
 * AegisInterface.tsx - Main CLI interface component
 *
 * Refactored to use extracted hooks: useAgent, useCommandProcessor, useTerminalSize.
 * Previously 977 lines — now ~450 lines of orchestration, with logic in focused hooks.
 */
import React from 'react';
export interface AegisInterfaceProps {
    apiKey: string;
    baseURL?: string;
    model?: string;
    initialMessage?: string;
    debug?: boolean;
    resumeSessionId?: string;
}
export declare const AegisInterface: React.FC<AegisInterfaceProps>;
//# sourceMappingURL=AegisInterface.d.ts.map