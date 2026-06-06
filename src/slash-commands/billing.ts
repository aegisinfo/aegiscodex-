/**
 * /billing — AEGIS Billing info
 */
import { exec } from 'child_process';

function openUrl(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` :
              process.platform === 'win32'  ? `start "${url}"` :
              `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Best quality — Claude Sonnet 4.5',
    pricing: '$3/MTok input · $15/MTok output',
    url: 'https://console.anthropic.com/settings/billing',
    recommend: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Best value — fast & affordable',
    pricing: '$0.14/MTok input · $0.28/MTok output',
    url: 'https://platform.deepseek.com/usage',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Free tier — 100k tokens/day',
    pricing: 'Free · Dev tier available',
    url: 'https://console.groq.com/settings/billing',
  },
];

export async function runBilling(args: string): Promise<string> {
  const arg = args.trim().toLowerCase();

  // Direct open
  const found = PROVIDERS.find(p => p.id === arg);
  if (found) {
    openUrl(found.url);
    return `Opening ${found.name} billing...\n${found.url}`;
  }

  // Show info
  const lines: string[] = [
    '## ⬡ API Billing',
    '',
    '> AEGIS CLI is BYOK — you pay your AI provider directly.',
    '',
  ];

  for (const p of PROVIDERS) {
    const rec = p.recommend ? ' ★ recommended' : '';
    lines.push(`**${p.name}**${rec}`);
    lines.push(`${p.description}`);
    lines.push(`${p.pricing}`);
    lines.push(`${p.url}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('## ⬡ AEGIS Memory');
  lines.push('');
  lines.push('Semantic memory across sessions: **$2/month**');
  lines.push('Run `/memory` to subscribe.');

  lines.push('');
  lines.push('`/billing claude` · `/billing deepseek` · `/billing groq` — opens billing page');

  return lines.join('\n');
}
