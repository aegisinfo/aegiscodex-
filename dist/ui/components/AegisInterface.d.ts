/**
 * AegisInterface.tsx - Main CLI interface component
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