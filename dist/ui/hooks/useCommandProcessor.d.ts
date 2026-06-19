/**
 * useCommandProcessor - Command processing hook
 *
 * Extracts the core command processing logic (slash commands, agent chat,
 * streaming, tool calls, auto-compaction) from AegisInterface.
 */
import type { Agent } from '../../agent/Agent.js';
import type { ContextManager } from '../../context/index.js';
import type { ConfirmationHandler } from './useConfirmation.js';
export interface UseCommandProcessorOptions {
    agentRef: React.MutableRefObject<Agent | null>;
    contextManagerRef: React.MutableRefObject<ContextManager | null>;
    modelRef: React.MutableRefObject<string | undefined>;
    debugRef: React.MutableRefObject<boolean | undefined>;
    getMessagesRef: React.MutableRefObject<() => any[]>;
    confirmationHandlerRef: React.MutableRefObject<ConfirmationHandler>;
    onSelectorRequest?: (state: {
        title: string;
        options: Array<{
            value: string;
            label: string;
        }>;
        handler: 'theme' | 'model' | null;
    }) => void;
}
export interface UseCommandProcessorResult {
    processCommand: (value: string, options?: {
        silent?: boolean;
    }) => Promise<void>;
    handleSubmit: (value: string) => Promise<void>;
    processQueue: () => Promise<void>;
}
export declare function useCommandProcessor(options: UseCommandProcessorOptions): UseCommandProcessorResult;
//# sourceMappingURL=useCommandProcessor.d.ts.map