/**
 * /clone — Clone any website via DeepSeek API
 *
 * Fetches a URL's HTML, sends it to DeepSeek for analysis,
 * and recreates it as a local project you can customize.
 *
 * Usage:
 *   /clone https://example.com
 *   /clone https://example.com --name my-project
 */

import type { SlashCommand, SlashCommandResult, SlashCommandContext } from './types.js';
import { createChatService } from '../services/ChatService.js';

const C = {
  cyan:   '\x1b[38;2;0;229;192m',
  purple: '\x1b[38;2;124;111;212m',
  green:  '\x1b[38;2;34;197;94m',
  red:    '\x1b[38;2;239;68;68m',
  muted:  '\x1b[38;2;68;64;90m',
  bold:   '\x1b[1m',
  reset:  '\x1b[0m',
};

interface CloneOptions {
  url: string;
  name?: string;
}

function parseArgs(args: string): CloneOptions {
  const parts = args.trim().split(/\s+/);
  let url = '';
  let name = '';

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '--name' && i + 1 < parts.length) {
      name = parts[++i];
    } else if (!url) {
      url = parts[i];
    }
  }

  return { url, name };
}

async function fetchHtml(url: string): Promise<string> {
  const { execSync } = await import('node:child_process');

  // Use curl with a realistic User-Agent to get the actual page content
  const cmd = [
    'curl',
    '-s',                         // silent
    '-L',                         // follow redirects
    '--max-time', '15',           // timeout after 15s
    '--connect-timeout', '10',
    '-H', `'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'`,
    '-H', `'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'`,
    `'${url}'`,
  ].join(' ');

  try {
    const html = execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 });
    // Truncate very large pages to avoid token limits
    return html.length > 80000 ? html.slice(0, 80000) + '\n<!-- [truncated] -->' : html;
  } catch (e: any) {
    throw new Error(`Failed to fetch ${url}: ${e.stderr?.toString() || e.message}`);
  }
}

function pickDeepSeekModel(): { apiKey: string; baseURL: string; model: string } | null {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    };
  }
  return null;
}

const CLONE_SYSTEM_PROMPT = `You are a senior web developer. Your job is to analyze HTML from a reference website and recreate it as a customizable local project.

Rules:
1. Create a complete, self-contained HTML page that captures the visual structure, layout, and design of the reference
2. Replace all brand-specific content with placeholder text (change company name, use "My Site" / "Your Brand")
3. Replace all external URLs (images, links, APIs) with relative paths or placeholders
4. Inline all CSS in a <style> tag — no external stylesheets
5. Make the page responsive (mobile-friendly)
6. Add a comment at the top showing the original source URL
7. Output ONLY valid HTML — no explanations, no markdown

The output must be a single HTML file that works when opened in a browser.`;

async function cloneSite(opts: CloneOptions, output: (s: string) => void): Promise<string> {
  const html = await fetchHtml(opts.url);

  const ds = pickDeepSeekModel();
  if (!ds) {
    throw new Error(
      'DeepSeek API key not found.\n' +
      'Set DEEPSEEK_API_KEY in ~/.aegiscode/.env or as an environment variable.\n' +
      'Get a key at: https://platform.deepseek.com/'
    );
  }

  const chat = createChatService({
    apiKey: ds.apiKey,
    baseURL: ds.baseURL,
    model: ds.model,
    timeout: 120_000,
  });

  output(`${C.muted}  Analyzing ${opts.url} (${(html.length / 1024).toFixed(1)}KB HTML)${C.reset}\n`);
  output(`${C.muted}  Using DeepSeek to recreate…${C.reset}\n`);

  const response = await chat.chat([
    { role: 'system', content: CLONE_SYSTEM_PROMPT },
    { role: 'user', content: `Here is the HTML of the reference website from ${opts.url}:\n\n\`\`\`html\n${html}\n\`\`\`\n\nRecreate this page as described. Output ONLY the HTML.` },
  ]);

  // Extract HTML from response (strip markdown fences if any)
  let resultHtml = response.content.trim();
  resultHtml = resultHtml.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();

  if (!resultHtml) {
    throw new Error('DeepSeek returned empty response');
  }

  return resultHtml;
}

export const cloneCommand: SlashCommand = {
  name: 'clone',
  aliases: ['fetch-site', 'websnap'],
  description: 'Clone any website using DeepSeek — /clone <url> [--name <project>]',
  category: 'skills',
  usage: '/clone <url> [--name <project-name>]',
  examples: [
    '/clone https://example.com',
    '/clone https://example.com --name my-landing',
    '/clone https://tailwindcss.com --name tailwind-clone',
  ],
  fullDescription: `Website cloner powered by DeepSeek.

Fetches a URL's HTML, sends it to DeepSeek for analysis,
and recreates it as a local HTML file you can customize.

The cloned page:
- Replaces brand content with placeholders
- Inlines all CSS
- Makes it responsive
- Works standalone in a browser

Requires DEEPSEEK_API_KEY in your environment.`,

  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const opts = parseArgs(args);
    if (!opts.url) {
      return {
        success: false,
        type: 'error',
        error: 'Usage: /clone <url> [--name <project-name>]\n' +
               'Example: /clone https://example.com --name my-landing',
      };
    }

    // Validate URL
    try {
      new URL(opts.url);
    } catch {
      return { success: false, type: 'error', error: `Invalid URL: ${opts.url}` };
    }

    const cwd = context.cwd || process.cwd();
    const projectName = opts.name || opts.url.replace(/https?:\/\//, '').replace(/\/$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
    const outputDir = `${cwd}/${projectName}`;

    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
    const log = (s: string) => {
      if (context.onContentDelta) {
        context.onContentDelta(stripAnsi(s) + '\n');
      } else {
        process.stdout.write(s + '\n');
      }
    };

    log(`\n${C.cyan}${C.bold}⬡ CLONE${C.reset}`);
    log(`${C.muted}  Source: ${opts.url}${C.reset}`);
    log(`${C.muted}  Output: ${projectName}/${C.reset}\n`);

    try {
      const fs = await import('node:fs');
      const path = await import('node:path');

      // Create output directory
      fs.mkdirSync(outputDir, { recursive: true });

      // Clone the site
      const html = await cloneSite(opts, log);

      // Write the HTML file
      const outputFile = path.join(outputDir, 'index.html');
      fs.writeFileSync(outputFile, html, 'utf-8');

      // Write a simple README
      const readme = `# ${projectName}

Website cloned from [${opts.url}](${opts.url}) using AEGIS Code + DeepSeek.

## Files

- \`index.html\` — Cloned website (standalone, open in browser)

## Customize

Edit \`index.html\` to replace placeholder content with your own.
`;
      fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf-8');

      const filesize = (html.length / 1024).toFixed(1);

      log(`\n${C.green}✓${C.reset} Created ${C.cyan}${projectName}/index.html${C.reset} (${filesize}KB)`);
      log(`${C.muted}  ${outputFile}${C.reset}`);
      log(`\n${C.bold}Done!${C.reset} Open index.html in your browser or edit it to make it yours.`);

      // Save a session note
      const note = `[clone] Created ${projectName}/ — cloned from ${opts.url}`;
      try {
        const sessionFile = path.join(outputDir, '.aegis-clone');
        fs.writeFileSync(sessionFile, JSON.stringify({ source: opts.url, clonedAt: new Date().toISOString(), project: projectName }, null, 2), 'utf-8');
      } catch {}

      return { success: true, type: 'silent' };
    } catch (error: any) {
      return {
        success: false,
        type: 'error',
        error: `Clone failed: ${error.message}`,
      };
    }
  },
};
