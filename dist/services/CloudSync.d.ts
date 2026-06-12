/**
 * CloudSync - Laddar upp konversationer till aegiscloud.org
 *
 * Körs automatiskt vid exit om aegiscloud.api_key är satt i config.
 * Kräver att aegiscloud.org/api/conversations är uppe och tar emot POST.
 *
 * Config (~/.aegiscode/config.json):
 * {
 *   "aegiscloud": {
 *     "api_key": "...",
 *     "syncConversations": true
 *   }
 * }
 */
export interface SyncMessage {
    role: string;
    content: string;
}
export interface SyncResult {
    ok: boolean;
    reason?: 'no_key' | 'disabled' | 'empty' | 'uploaded' | 'error';
    error?: string;
}
export declare function syncConversation(sessionId: string, messages: SyncMessage[], model?: string): Promise<SyncResult>;
/** Spara API-nyckel i config */
export declare function saveAegisCloudKey(apiKey: string, syncConversations?: boolean): void;
/** Läs aegiscloud-config */
export declare function getAegisCloudConfig(): {
    apiKey?: string;
    syncConversations: boolean;
};
/** Spara konversation till lokal shared.json memory */
export declare function appendToLocalMemory(sessionId: string, messages: SyncMessage[]): Promise<void>;
//# sourceMappingURL=CloudSync.d.ts.map