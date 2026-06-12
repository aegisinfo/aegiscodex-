/**
 * AppBuilder — Declarative multi-agent app framework
 *
 * Makes it trivial to build new CLI "apps" that orchestrate multiple AI agents.
 *
 * Usage:
 * ```ts
 * const auditApp = new AppBuilder('audit', 'Security Auditor')
 *   .describe('Audit codebase for security vulnerabilities')
 *   .agent('scanner', 'Vulnerability Scanner', scannerPrompt, ['Read', 'Grep', 'Glob'])
 *   .agent('analyzer', 'Risk Analyzer', analyzerPrompt, ['Read'])
 *   .agent('reporter', 'Report Generator', reporterPrompt)
 *   .register();
 * ```
 */
import { OrchestratorAgent } from './OrchestratorAgent.js';
import { requireModelConfig } from './utils.js';
// ─── Built-in app prompts ──────────────────────────────────────────
const BUILTIN_APP_TEMPLATES = {
    audit: {
        name: 'Code Security Auditor',
        description: 'Audit the codebase for security vulnerabilities, hardcoded secrets, and unsafe patterns',
        subtitle: 'Security Audit',
        instructions: 'Provide a comprehensive security audit with severity ratings and remediation steps.',
        agents: [
            {
                name: 'scanner',
                role: 'Vulnerability Scanner',
                tools: ['Read', 'Grep', 'Glob'],
                prompt: `You are a Security Vulnerability Scanner.
Scan the codebase for: hardcoded API keys/secrets, SQL injection, XSS, unsafe eval/exec, path traversal, command injection.
Use Grep with targeted patterns to find issues. Report every finding with file path, severity (CRITICAL/HIGH/MEDIUM/LOW), and line number.`,
            },
            {
                name: 'analyzer',
                role: 'Risk Analyzer',
                tools: ['Read', 'Grep', 'Glob'],
                prompt: `You are a Security Risk Analyzer.
Review the dependency/package files, configuration files, and environment setup.
Check for: outdated packages with known CVEs, misconfigured CORS, permissive file permissions, weak auth.
Use Read on package.json, tsconfig, Dockerfiles, CI configs. Report risks with actionable fixes.`,
            },
            {
                name: 'reporter',
                role: 'Report Generator',
                prompt: `You are a Security Report Generator. Given the scanner and analyzer findings, produce a final report.
Structure: Executive Summary, Critical Findings, High, Medium, Low, Recommendations.
Always include CVE references where applicable. Be concise and actionable.`,
            },
        ],
    },
    refactor: {
        name: 'Code Refactoring Engine',
        description: 'Analyze and refactor code for better structure, performance, and maintainability',
        subtitle: 'Refactoring',
        instructions: 'Execute the refactoring plan. Write the actual code changes.',
        agents: [
            {
                name: 'analyzer',
                role: 'Code Analyzer',
                tools: ['Read', 'Grep', 'Glob'],
                prompt: `You are a Code Analyzer. Analyze the codebase for refactoring opportunities.
Look for: duplicate code, long functions, complex conditionals, unused imports, circular dependencies, inconsistent patterns.
Use Grep and Read to find specific examples. Provide file paths and line numbers.`,
            },
            {
                name: 'planner',
                role: 'Refactoring Planner',
                tools: ['Read'],
                prompt: `You are a Refactoring Planner. Given the analyzer findings, create a step-by-step refactoring plan.
Each step should specify: which file to modify, what to change, why, and the risk level (LOW/MEDIUM/HIGH).
Order by impact (highest value first). Be concrete — include before/after code snippets.`,
            },
            {
                name: 'implementer',
                role: 'Implementation Engineer',
                tools: ['Read', 'Edit', 'Write', 'Grep'],
                prompt: `You are an Implementation Engineer. Execute the refactoring plan.
Make the actual code changes using Edit and Write tools.
After each change, use Read to verify the result. Keep the existing code style.`,
            },
        ],
    },
    'test-gen': {
        name: 'Test Generator',
        description: 'Generate comprehensive test suites for your code',
        subtitle: 'Test Generation',
        instructions: 'Generate the test files. Use existing test patterns in the project.',
        agents: [
            {
                name: 'explorer',
                role: 'Code Explorer',
                tools: ['Read', 'Grep', 'Glob'],
                prompt: `You are a Code Explorer. Find testable units in the codebase.
For each module: list exported functions/classes, their parameters, return types, and side effects.
Check for existing test files and test patterns used in the project.
Report: which test framework is used, where tests live, existing test patterns.`,
            },
            {
                name: 'designer',
                role: 'Test Designer',
                tools: ['Read'],
                prompt: `You are a Test Designer. Given the explorer findings, design test cases.
For each function/module: describe the happy path, error cases, edge cases, and any setup/teardown needed.
Prioritize: critical business logic > utilities > edge cases. Be specific about assertions.`,
            },
            {
                name: 'writer',
                role: 'Test Writer',
                tools: ['Read', 'Write', 'Edit', 'Grep'],
                prompt: `You are a Test Writer. Generate the actual test files following the test designer's plan.
Match the project's existing test patterns (framework, naming, directory structure).
Write complete, runnable tests. Use Write to create new test files.`,
            },
        ],
    },
};
// ─── AppBuilder ────────────────────────────────────────────────────
export class AppBuilder {
    def = {};
    agents = [];
    _prompts;
    constructor(id, name) {
        this.def.id = id;
        this.def.name = name;
        this.def.modelConfig = requireModelConfig;
        this.def.concurrency = 4;
    }
    /** Set short description (shown in /help) */
    describe(description) {
        this.def.description = description;
        return this;
    }
    /** Set usage instructions */
    use(usage) {
        this.def.usage = usage;
        return this;
    }
    /** Add example usages */
    examples(examples) {
        this.def.examples = examples;
        return this;
    }
    /** Set custom model resolver */
    model(resolver) {
        this.def.modelConfig = resolver;
        return this;
    }
    /** Set max parallelism */
    concurrency(n) {
        this.def.concurrency = n;
        return this;
    }
    /** Set synthesizer agent name (default: first registered) */
    synthesizer(name) {
        this.def.synthesizer = name;
        return this;
    }
    /**
     * Register a sub-agent.
     *
     * @param name - Agent identifier (used in delegation)
     * @param role - Human-readable role name
     * @param systemPrompt - System prompt for this agent
     * @param tools - Tool names this agent can use (e.g. ['Read', 'Grep'])
     */
    agent(name, role, systemPrompt, tools) {
        this.agents.push({ name, role, systemPrompt, config: {}, tools });
        return this;
    }
    /**
     * Load a built-in app template and customize it.
     * Available: 'audit', 'refactor', 'test-gen'
     */
    fromTemplate(templateId, overrides) {
        const template = BUILTIN_APP_TEMPLATES[templateId];
        if (!template) {
            throw new Error(`Unknown app template: "${templateId}". Available: ${Object.keys(BUILTIN_APP_TEMPLATES).join(', ')}`);
        }
        this.def.name = overrides?.name || template.name;
        this.def.description = overrides?.description || template.description;
        this.def.usage = `/${this.def.id || templateId} <task>`;
        this.def.examples = [
            `/${this.def.id || templateId} Audit the login module`,
            `/${this.def.id || templateId} Check package.json for vulnerabilities`,
        ];
        this._prompts = {
            template: templateId,
            subTaskTemplates: {},
        };
        for (const agent of template.agents) {
            const userPrompt = overrides?.agentPrompts?.[agent.name];
            this.agent(agent.name, agent.role, userPrompt || agent.prompt, agent.tools);
        }
        return this;
    }
    /**
     * Build and register the app, returning the definition.
     * This also makes the app available via the slash-command system.
     */
    register() {
        if (!this.def.id)
            throw new Error('AppBuilder: id is required');
        if (!this.def.description)
            this.def.description = '';
        if (this.agents.length === 0)
            throw new Error('AppBuilder: at least one agent required');
        const definition = {
            id: this.def.id,
            name: this.def.name || this.def.id,
            description: this.def.description,
            usage: this.def.usage || `/${this.def.id} <task>`,
            examples: this.def.examples || [`/${this.def.id} ...`],
            modelConfig: this.def.modelConfig || requireModelConfig,
            agents: this.agents,
            synthesizer: this.def.synthesizer || this.agents[this.agents.length - 1]?.name,
            concurrency: this.def.concurrency || 4,
        };
        // Register globally so slash commands can find it
        registeredApps.set(definition.id, definition);
        return definition;
    }
}
// ─── Global App Registry ──────────────────────────────────────────
/** Map of appId → AppDefinition */
const registeredApps = new Map();
/**
 * Get all registered apps.
 */
export function getRegisteredApps() {
    return Array.from(registeredApps.values());
}
/**
 * Get a specific app by ID.
 */
export function getApp(id) {
    return registeredApps.get(id);
}
/**
 * Run an app by its registered ID.
 */
export async function runApp(appId, options) {
    const app = registeredApps.get(appId);
    if (!app) {
        throw new Error(`App "${appId}" not found. Available: ${Array.from(registeredApps.keys()).join(', ')}`);
    }
    const startTime = Date.now();
    const modelCfg = app.modelConfig();
    const agentConfig = {
        apiKey: modelCfg.apiKey,
        baseURL: modelCfg.baseURL,
        model: modelCfg.model,
        timeout: modelCfg.timeout,
    };
    const orchestrator = new OrchestratorAgent(`App-${appId}`, `You are ${app.name}. ${app.description}`);
    // Register agents with resolved config
    for (const agent of app.agents) {
        orchestrator.registerAgent({
            ...agent,
            config: { ...agentConfig, ...agent.config },
        });
    }
    // Build sub-tasks
    const subTasks = {};
    if (options.subTasks) {
        Object.assign(subTasks, options.subTasks);
    }
    else {
        // Generate default sub-tasks from agent descriptions
        for (const agent of app.agents) {
            subTasks[agent.name] = agent.systemPrompt.split('\n')[0];
        }
    }
    // Run orchestration
    const result = await orchestrator.orchestrate(options.task, subTasks, app.synthesizer, options.sessionId);
    const errorCount = result.responses.filter(r => r.content.startsWith('[Error:') || r.content.startsWith('[Fatal:')).length;
    return {
        responses: result.responses.map(r => ({
            agentName: r.agentName,
            content: r.content,
            toolCallsCount: r.metadata?.toolCallsCount,
            durationMs: r.metadata?.durationMs,
        })),
        summary: result.summary,
        totalDurationMs: Date.now() - startTime,
        errorCount,
    };
}
// ─── Auto-register built-in apps ───────────────────────────────────
/** Create default built-in apps */
export function createBuiltinApps() {
    return Object.entries(BUILTIN_APP_TEMPLATES).map(([id, template]) => {
        const builder = new AppBuilder(id, template.name)
            .describe(template.description)
            .use(`/${id} <task>`)
            .examples([
            `/${id} ...`,
        ]);
        for (const agent of template.agents) {
            builder.agent(agent.name, agent.role, agent.prompt, agent.tools);
        }
        return builder.register();
    });
}
//# sourceMappingURL=AppBuilder.js.map