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

async function callAnthropic(question: string, persona: string): Promise<{ vote: string; analysis: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are ${persona} in the AEGIS Council. You MUST always vote. You MUST start your response with exactly "VOTE: JA" or "VOTE: NEJ". Never abstain. Then write "ANALYSIS:" followed by 1-2 sentences.`,
      messages: [{
        role: 'user',
        content: `Council question: "${question}"\n\nYou must respond in this exact format:\nVOTE: JA\nANALYSIS: your reasoning here\n\nOR\n\nVOTE: NEJ\nANALYSIS: your reasoning here`,
      }],
    }),
  });
  const data = await res.json() as any;
  const text = data.content?.[0]?.text || '';
  const vote = text.includes('VOTE: JA') ? 'JA' : text.includes('VOTE: NEJ') ? 'NEJ' : 'AVSTÅR';
  const analysis = text.split('ANALYSIS:')[1]?.trim().slice(0, 200) || text.slice(0, 200);
  return { vote, analysis };
}

async function callDeepSeek(question: string, persona: string): Promise<{ vote: string; analysis: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('No DEEPSEEK_API_KEY');
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
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

async function callGroq(question: string, persona: string): Promise<{ vote: string; analysis: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('No GROQ_API_KEY');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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

const AGENTS: Agent[] = [
  {
    name: 'Claude',
    role: 'Strategic Analyst',
    color: C.teal,
    call: (q) => callAnthropic(q, 'a strategic analyst focused on long-term impact and human values'),
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
