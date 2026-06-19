/**
 * /build — Parallel multi-model app builder
 *
 * Decomposes a task into components, assigns each to the best available model,
 * builds everything in parallel, then synthesizes results.
 *
 * Phases:
 *   1. Plan  — primary model produces a JSON component tree
 *   2. Build — all components run in parallel (different models per role)
 *   3. Sync  — primary model synthesizes and reports what was written
 */
import { OrchestratorAgent } from '../agent/orchestrator/OrchestratorAgent.js';
import { requireModelConfig, buildSourceContext } from '../agent/orchestrator/utils.js';
import { PermissionMode } from '../tools/index.js';
import { createChatService } from '../services/ChatService.js';
// ── Colors ────────────────────────────────────────────────────────
const C = {
    cyan: '\x1b[38;2;0;229;192m',
    purple: '\x1b[38;2;124;111;212m',
    orange: '\x1b[38;2;249;115;22m',
    green: '\x1b[38;2;34;197;94m',
    red: '\x1b[38;2;239;68;68m',
    muted: '\x1b[38;2;68;64;90m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
};
function resolveAvailableModels() {
    const primary = requireModelConfig();
    const models = {
        primary: { model: primary.model, baseURL: primary.baseURL, apiKey: primary.apiKey, label: primary.model },
    };
    if (process.env.DEEPSEEK_API_KEY) {
        models.deepseek = {
            model: 'deepseek-chat',
            baseURL: 'https://api.deepseek.com/v1',
            apiKey: process.env.DEEPSEEK_API_KEY,
            label: 'DeepSeek',
        };
    }
    if (process.env.GROQ_API_KEY) {
        models.groq = {
            model: 'llama-3.3-70b-versatile',
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: process.env.GROQ_API_KEY,
            label: 'Llama-3.3 (Groq)',
        };
    }
    if (process.env.OPENAI_API_KEY) {
        models.openai = {
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            label: process.env.OPENAI_MODEL || 'GPT-4o',
        };
    }
    return models;
}
/**
 * Assign the best available model to a role.
 * Falls back to primary if a specific model isn't available.
 */
function pickModel(role, available) {
    // Logic-heavy / algorithm → DeepSeek
    if (/backend|api|database|algorithm|logic/i.test(role) && available.deepseek)
        return available.deepseek;
    // UI / frontend → OpenAI
    if (/frontend|ui|interface|style|css|html/i.test(role) && available.openai)
        return available.openai;
    // Tests / docs → Groq (fast)
    if (/test|spec|doc|readme/i.test(role) && available.groq)
        return available.groq;
    return available.primary;
}
// ── Planning phase ────────────────────────────────────────────────
const PLAN_PROMPT = `You are a senior software architect. The user wants to build:

"{task}"

Output ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "appName": "short-kebab-name",
  "stack": "one-line tech stack description",
  "entrypoint": "main file to run the app",
  "components": [
    {
      "name": "component-id",
      "role": "human role title",
      "description": "what this component builds — 2-3 sentences, be specific",
      "files": ["file1.py", "file2.py"],
      "modelHint": "backend|frontend|tests|docs"
    }
  ]
}

Rules:
- 3-6 components maximum
- Each component must be independently buildable in parallel
- files[] contains the actual files this agent will write to disk
- modelHint must be one of: backend, frontend, tests, docs, general
- Be opinionated about the stack — choose one clear approach
- Always include a "tests" component
- Always include an "integrator" component (role: "Integration Engineer") that writes the main entrypoint and wires everything together`;
async function planBuild(task) {
    const cfg = requireModelConfig();
    const chat = createChatService({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, model: cfg.model, timeout: 60_000 });
    const response = await chat.chat([
        { role: 'user', content: PLAN_PROMPT.replace('{task}', task) },
    ]);
    // Strip markdown fences if model added them
    let raw = response.content.trim();
    raw = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    try {
        return JSON.parse(raw);
    }
    catch {
        // Fallback: extract JSON block
        const match = raw.match(/\{[\s\S]+\}/);
        if (match)
            return JSON.parse(match[0]);
        throw new Error(`Planner returned invalid JSON:\n${raw.slice(0, 500)}`);
    }
}
// ── Agent system prompts ──────────────────────────────────────────
function buildSystemPrompt(component, plan, cwd) {
    const sourceCtx = buildSourceContext(cwd);
    const codeContext = sourceCtx
        ? `\n\nExisting code in workspace (file tree + structure summaries + git context):\n${sourceCtx}\n\nUse Read / Grep / Glob to examine these before writing — your code must integrate with existing patterns.`
        : '';
    return `You are ${component.role} on a team building: ${plan.appName}
Stack: ${plan.stack}
Working directory: ${cwd}

Your assignment:
${component.description}

Files you should write: ${component.files.join(', ')}${codeContext}

CRITICAL RULES:
1. Use Write tool to create each file — write complete, production-ready code
2. Use Read / Grep / Glob to explore existing code before writing
3. Do NOT write placeholder code — implement fully working logic
4. Follow the stack: ${plan.stack}
5. When done, list each file you created with a one-line description

Other agents are building the rest of the app simultaneously — focus only on your assignment.
The "integrator" agent will wire everything together.`;
}
function integratorSystemPrompt(plan, components, cwd) {
    const sourceCtx = buildSourceContext(cwd);
    const others = components.filter(c => c.name !== 'integrator');
    const codeContext = sourceCtx
        ? `\n\nExisting code in workspace (file tree + structure summaries + git context):\n${sourceCtx}\n\nUse Read / Grep / Glob to check existing files before wiring.`
        : '';
    return `You are Integration Engineer on a team building: ${plan.appName}
Stack: ${plan.stack}
Working directory: ${cwd}${codeContext}

Other agents are building:
${others.map(c => `- ${c.name}: ${c.files.join(', ')}`).join('\n')}

Your job:
1. Use Read / Grep / Glob to check what each agent wrote and any existing code
2. Write the main entrypoint: ${plan.entrypoint}
3. Write a README.md with: what the app does, how to install, how to run
4. Fix any import/wiring issues between components
5. Write a requirements.txt / package.json / go.mod (whichever fits the stack)

Wait — other agents run in parallel. Assume their files exist as listed above.
Write ${plan.entrypoint} and README.md with correct imports for those files.`;
}
// ── Build command ─────────────────────────────────────────────────
export const buildCommand = {
    name: 'build',
    aliases: ['forge'],
    description: 'Build an app with multiple AI models in parallel — /build <what to build>',
    category: 'skills',
    usage: '/build <description>',
    examples: [
        '/build a REST API for a todo app with PostgreSQL',
        '/build a CLI tool that summarizes git commits',
        '/build a Flask web app with login and dashboard',
    ],
    fullDescription: `Parallel multi-model app builder.

Breaks your task into components, assigns each to the best available AI model,
builds everything simultaneously, then synthesizes results.

Models used based on available API keys:
- Primary model     — architecture, integration
- DeepSeek          — backend, algorithms (DEEPSEEK_API_KEY)
- GPT-4o            — frontend, UI         (OPENAI_API_KEY)
- Llama via Groq    — tests, docs          (GROQ_API_KEY)

All agents write real files to your current directory.`,
    async handler(args, context) {
        const task = args.trim();
        if (!task) {
            return { success: false, type: 'error', error: 'Usage: /build <what to build>\nExample: /build a REST API for a todo app' };
        }
        const cwd = context.cwd || process.cwd();
        const output = [];
        // Strip ANSI escape codes for clean markdown rendering in streaming buffer
        const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
        const log = (s) => {
            output.push(s);
            if (context.onContentDelta) {
                context.onContentDelta(stripAnsi(s) + '\n');
            }
            else {
                process.stdout.write(s + '\n');
            }
        };
        log(`\n${C.cyan}${C.bold}⬡ AEGIS BUILD${C.reset}`);
        log(`${C.muted}Task: ${task}${C.reset}\n`);
        // ── Phase 1: Plan ─────────────────────────────────────────────
        log(`${C.muted}[1/3] Planning architecture…${C.reset}`);
        let plan;
        try {
            plan = await planBuild(task);
        }
        catch (e) {
            return { success: false, type: 'error', error: `Planning failed: ${e.message}` };
        }
        log(`${C.cyan}  App: ${plan.appName}${C.reset}`);
        log(`${C.muted}  Stack: ${plan.stack}${C.reset}`);
        log(`${C.muted}  Components: ${plan.components.map(c => c.name).join(', ')}${C.reset}\n`);
        // ── Phase 2: Build ────────────────────────────────────────────
        log(`${C.muted}[2/3] Building in parallel…${C.reset}\n`);
        const available = resolveAvailableModels();
        const modelNames = Object.entries(available)
            .filter(([k]) => k !== 'primary')
            .map(([, v]) => v.label);
        if (modelNames.length > 0) {
            log(`${C.muted}  Models: primary + ${modelNames.join(', ')}${C.reset}\n`);
        }
        else {
            log(`${C.muted}  Model: ${available.primary.label} (add DEEPSEEK_API_KEY / OPENAI_API_KEY / GROQ_API_KEY for more)${C.reset}\n`);
        }
        const orchestrator = new OrchestratorAgent('Build-Orchestrator', `You are the AEGIS Build Orchestrator. Coordinate parallel construction of ${plan.appName}.`);
        for (const comp of plan.components) {
            const modelCfg = pickModel(comp.modelHint || comp.name, available);
            const prompt = comp.name === 'integrator'
                ? integratorSystemPrompt(plan, plan.components, cwd)
                : buildSystemPrompt(comp, plan, cwd);
            const agentCfg = {
                name: comp.name,
                role: comp.role,
                systemPrompt: prompt,
                config: { apiKey: modelCfg.apiKey, baseURL: modelCfg.baseURL, model: modelCfg.model, timeout: 180_000 },
                tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
                permissionMode: PermissionMode.AUTO_EDIT,
            };
            orchestrator.registerAgent(agentCfg);
            log(`  ${C.cyan}${comp.name}${C.reset} ${C.muted}→ ${modelCfg.label} · ${comp.files.join(', ')}${C.reset}`);
        }
        log('');
        // Separate integrator from parallel agents (runs after others)
        const parallelComponents = plan.components.filter(c => c.name !== 'integrator');
        const integratorComp = plan.components.find(c => c.name === 'integrator');
        // Build sub-tasks for parallel phase
        const subTasks = {};
        for (const comp of parallelComponents) {
            subTasks[comp.name] = comp.description;
        }
        let parallelResponses = [];
        try {
            parallelResponses = await orchestrator.delegateParallel(parallelComponents.map(c => ({ agentName: c.name, task: c.description })), parallelComponents.length);
        }
        catch (e) {
            return { success: false, type: 'error', error: `Build phase failed: ${e.message}` };
        }
        // Log agent results
        for (const res of parallelResponses) {
            const ok = !res.content.startsWith('[Error') && !res.content.startsWith('[Fatal');
            const icon = ok ? `${C.green}✓${C.reset}` : `${C.red}✖${C.reset}`;
            log(`${icon} ${C.cyan}${res.agentName}${C.reset} ${C.muted}(${Math.round((res.metadata?.durationMs || 0) / 1000)}s)${C.reset}`);
        }
        // Run integrator after parallel phase
        if (integratorComp) {
            log(`\n${C.muted}  Wiring components…${C.reset}`);
            try {
                const intRes = await orchestrator.delegate('integrator', integratorComp.description);
                const ok = !intRes.content.startsWith('[Error') && !intRes.content.startsWith('[Fatal');
                const icon = ok ? `${C.green}✓${C.reset}` : `${C.red}✖${C.reset}`;
                log(`${icon} ${C.cyan}integrator${C.reset} ${C.muted}(${Math.round((intRes.metadata?.durationMs || 0) / 1000)}s)${C.reset}`);
                parallelResponses.push(intRes);
            }
            catch (e) {
                log(`${C.red}✖ integrator failed: ${e.message}${C.reset}`);
            }
        }
        // ── Phase 3: Synthesis ────────────────────────────────────────
        log(`\n${C.muted}[3/3] Synthesizing…${C.reset}\n`);
        const agentSummaries = parallelResponses
            .map(r => `[${r.agentName}]:\n${(r.content || '').slice(0, 600)}`)
            .join('\n\n---\n\n');
        const cfg = requireModelConfig();
        const chat = createChatService({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, model: cfg.model, timeout: 60_000 });
        let synthesis = '';
        try {
            const synRes = await chat.chat([{
                    role: 'user',
                    content: `You coordinated building: ${plan.appName} (${plan.stack})

Agent reports:
${agentSummaries}

Produce a concise build summary:
1. Files written (list each with one-line description)
2. How to run the app
3. Any issues to fix manually

Be concrete. No fluff.`,
                }]);
            synthesis = synRes.content;
        }
        catch {
            synthesis = parallelResponses.map(r => `**${r.agentName}**: ${(r.content || '').slice(0, 200)}`).join('\n\n');
        }
        const errorCount = parallelResponses.filter(r => r.content?.startsWith('[Error') || r.content?.startsWith('[Fatal')).length;
        const totalMs = parallelResponses.reduce((s, r) => s + (r.metadata?.durationMs || 0), 0);
        const summaryText = [
            `## ⬡ Build: ${plan.appName}`,
            `**Stack:** ${plan.stack}`,
            `**Run:** \`${plan.entrypoint}\``,
            '',
            synthesis,
            '',
            `---`,
            `*${parallelResponses.length} agents · ${Math.round(totalMs / 1000)}s${errorCount > 0 ? ` · ⚠ ${errorCount} agent(s) had errors` : ' · all clean'}*`,
        ].join('\n');
        log(`\n${summaryText}`);
        log(`\n\n✅ **Build complete!**\n`);
        return { success: true, type: 'silent' };
    },
};
//# sourceMappingURL=build.js.map