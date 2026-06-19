/**
 * App.tsx - rooted UI with stable references
 */
import React from 'react';
import type { PermissionMode } from '../cli/types.js';
import type { VersionCheckResult } from '../services/VersionChecker.js';
export interface AppProps {
    apiKey: string;
    baseURL?: string;
    model?: string;
    initialMessage?: string;
    debug?: boolean;
    permissionMode?: PermissionMode;
    versionCheckPromise?: Promise<VersionCheckResult | null>;
    resumeSessionId?: string;
    routerEnabled?: boolean;
}
export declare const App: React.FC<AppProps>;
//# sourceMappingURL=App.d.ts.map