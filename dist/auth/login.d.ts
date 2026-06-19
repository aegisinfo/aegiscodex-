/**
 * aegis login — browser-based OAuth flow
 *
 * 1. Start a one-shot HTTP server on a random local port
 * 2. Open the browser to aegiscloud.org/login?redirect_uri=...
 * 3. Wait for the callback carrying ?token=...
 * 4. Persist the token in ~/.aegiscode/config.json
 * 5. Resolve (caller prints success) or reject with a readable error
 */
export declare function runLogin(): Promise<{
    token: string;
}>;
export declare function runLoginPassword(): Promise<void>;
export declare function runLoginClaudePro(): Promise<void>;
export declare function runLogout(): void;
//# sourceMappingURL=login.d.ts.map