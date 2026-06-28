/**
 * /council — AEGIS Council Vote
 * Three AI agents deliberate and vote via API directly
 */

const C = {
  teal:   '\x1b[38;2;0;229;192m',
  purple: '\x1b[38;2;124;111;212m',
  pink:   '\x1b[38;2;244;114;182m',
  orange: '\x1b[38;2;249;115;22m',
  green:  '\x1b[38;2;34;197;94m',
  red:    '\x1b[38;2;239;68;68m',
  muted:  '\x1b[38;2;68;64;90m',
  bold:   '\x1b[1m',
  reset:  '\x1b[0m',
};

interface Agent {
  name: string;
  role: string;
  color: string;
  call: (question: string) => Promise<{ vote: string; analysis: string }>;
}

async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, question: string, persona: string): Promise<{ vote: string; analysis: string }> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are ${persona} in the AEGIS Council. The question is:\n\n"${question}"\n\nRespond with:\nVOTE: JA or NEJ\nANALYSIS: 1-2 sentences explaining your reasoning.`,
      }],
    }),
  });
  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content || '';
  const vote = text.includes('VOTE: JA') ? 'JA' : text.includes('VOTE: NEJ') ? 'NEJ' : 'AVSTÅR';
  const analysis = text.split('ANALYSIS:')[1]?.trim().slice(0, 200) || text.slice(0, 200);
  return { vote, analysis };
}

function pickProvider(): { baseUrl: string; apiKey: string; model: string } {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL)
    return { baseUrl: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o' };
  if (process.env.DEEPSEEK_API_KEY)
    return { baseUrl: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' };
  if (process.env.GROQ_API_KEY)
    return { baseUrl: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' };
  if (process.env.OPENAI_API_KEY)
    return { baseUrl: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' };
  throw new Error('No API key configured. Set OPENAI_API_KEY, DEEPSEEK_API_KEY, or GROQ_API_KEY in ~/.aegiscode/.env');
}

let _provider: ReturnType<typeof pickProvider> | null = null;
function callPrimary(q: string, p: string)   { if (!_provider) _provider = pickProvider(); return callOpenAICompatible(_provider.baseUrl, _provider.apiKey, _provider.model, q, p); }
function callDeepSeek(q: string, p: string)  { return callOpenAICompatible('https://api.deepseek.com/v1', process.env.DEEPSEEK_API_KEY || '', 'deepseek-chat', q, p); }
function callGroq(q: string, p: string)      { return callOpenAICompatible('https://api.groq.com/openai/v1', process.env.GROQ_API_KEY || '', 'llama-3.3-70b-versatile', q, p); }

const AGENTS: Agent[] = [
  {
    name: 'Claude',
    role: 'Strategic Analyst',
    color: C.teal,
    call: (q) => callPrimary(q, 'a strategic analyst focused on long-term impact and human values'),
  },
  {
    name: 'DeepSeek',
    role: 'Technical Architect',
    color: C.purple,
    call: (q) => callDeepSeek(q, 'a technical architect focused on feasibility and system design'),
  },
  {
    name: 'Llama',
    role: 'Ethics Officer',
    color: C.orange,
    call: (q) => callGroq(q, 'an ethics officer focused on safety, fairness, and societal impact'),
  },
];

export async function runCouncil(question: string): Promise<string> {
  const results: { name: string; role: string; color: string; vote: string; analysis: string }[] = [];
  const lines: string[] = [];

  lines.push('## ⬡ AEGIS COUNCIL');
  lines.push(`**Question:** ${question}`);
  lines.push('');
  lines.push('*Agents deliberating...*');
  lines.push('');

  await Promise.all(AGENTS.map(async (agent) => {
    try {
      const result = await agent.call(question);
      results.push({ name: agent.name, role: agent.role, color: agent.color, ...result });
    } catch (e: any) {
      results.push({ name: agent.name, role: agent.role, color: agent.color, vote: 'OFFLINE', analysis: e.message });
    }
  }));

  // Rebuild lines with results
  lines.length = 0;
  lines.push('## ⬡ AEGIS COUNCIL');
  lines.push(`**Question:** ${question}`);
  lines.push('');

  for (const r of results) {
    const voteEmoji = r.vote === 'JA' ? '✅' : r.vote === 'NEJ' ? '❌' : '⚫';
    lines.push(`**${r.name}** · ${r.role}`);
    lines.push(`${voteEmoji} **${r.vote}** — ${r.analysis}`);
    lines.push('');
  }

  const ja  = results.filter(r => r.vote === 'JA').length;
  const nej = results.filter(r => r.vote === 'NEJ').length;
  const approved = ja > nej;
  const verdict = approved ? '✅ GODKÄNT' : '❌ AVSLAGET';
  const summary = `${ja} JA · ${nej} NEJ · ${results.length - ja - nej} AVSTÅR`;

  lines.push('---');
  lines.push(`${verdict} · ${summary}`);

  return lines.join('\n');
}
