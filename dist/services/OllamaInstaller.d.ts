/**
 * OllamaInstaller — auto-install, start, and validate Ollama when a local
 * Ollama model is selected.
 *
 * Flow:
 *  1. Detect if baseURL points to a local Ollama instance
 *  2. Ensure server is running (install if missing)
 *  3. Ensure the requested model is pulled
 *  4. Check that the model supports tools — auto-swap to best installed capable model if not
 *  5. Return the final model name to use (may differ from the input)
 */
export interface OllamaModelInfo {
    name: string;
    supportsTools: boolean;
    sizeGB?: number;
    isLoaded: boolean;
}
export declare function isLocalOllamaUrl(baseURL?: string): boolean;
/**
 * Returns enriched info for every model installed in a local Ollama instance.
 * Used by the /model selector to show size, tool support, and loaded status.
 * Returns [] if baseURL is not a local Ollama URL or the server is not running.
 */
export declare function getOllamaModels(baseURL?: string): Promise<OllamaModelInfo[]>;
/**
 * Called by Agent.initialize() before the first API request.
 *
 * Returns the model name that should actually be used — this may differ from
 * the `model` argument when the requested model does not support tools and
 * has been swapped for a capable alternative.
 *
 * Returns undefined if baseURL is not a local Ollama endpoint (no-op).
 */
export declare function ensureOllama(baseURL?: string, model?: string): Promise<string | undefined>;
//# sourceMappingURL=OllamaInstaller.d.ts.map