/**
 * useAgent - Agent lifecycle hook
 *
 * Extracts agent initialization, context management, and model switching
 * from AegisInterface into a focused, testable hook.
 */
import { Agent } from '../../agent/Agent.js';
import { ContextManager } from '../../context/index.js';
export interface UseAgentOptions {
    apiKey: string;
    baseURL?: string;
    model?: string;
    debug?: boolean;
    resumeSessionId?: string;
}
export interface UseAgentResult {
    agentRef: React.MutableRefObject<Agent | null>;
    contextManagerRef: React.MutableRefObject<ContextManager | null>;
    isInitializing: boolean;
    initError: string | null;
    currentModel: string | undefined;
    setCurrentModel: React.Dispatch<React.SetStateAction<string | undefined>>;
    handleSetupComplete: () => Promise<void>;
    getAgent: () => Agent | null;
    getContextManager: () => ContextManager | null;
}
export declare function useAgent(options: UseAgentOptions): UseAgentResult;
//# sourceMappingURL=useAgent.d.ts.map