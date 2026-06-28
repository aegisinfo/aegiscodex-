/**
 * SetupWizard - Interactive first-run setup guide
 *
 * Saves API keys to ~/.aegiscode/.env — config.json picks them up automatically.
 * Flow: pick provider → enter key → add another? → done
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { themeManager } from '../../themes/index.js';
import { appActions } from '../../../store/index.js';

interface Provider {
  id: string;
  label: string;
  envVar: string;
  keyUrl: string;
  noKey?: boolean;
}

const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    envVar: 'ANTHROPIC_API_KEY',
    keyUrl: 'console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    envVar: 'OPENAI_API_KEY',
    keyUrl: 'platform.openai.com/api-keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    keyUrl: 'platform.deepseek.com/api_keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    envVar: 'GROQ_API_KEY',
    keyUrl: 'console.groq.com/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    keyUrl: 'aistudio.google.com/app/apikey',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    envVar: '',
    keyUrl: '',
    noKey: true,
  },
];

type Step = 'welcome' | 'provider' | 'apikey' | 'another' | 'saving' | 'done';

interface SetupWizardProps {
  onComplete: () => void;
}

function readEnv(envPath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 0 || line.trim().startsWith('#')) continue;
    result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return result;
}

function writeEnv(envPath: string, vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const theme = themeManager.getTheme();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]); // env var names already saved this session

  const selectedProvider = PROVIDERS[selectedIdx];
  const envPath = path.join(os.homedir(), '.aegiscode', '.env');

  const saveKeyToEnv = useCallback((provider: Provider, key: string) => {
    const configDir = path.join(os.homedir(), '.aegiscode');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const vars = readEnv(envPath);
    vars[provider.envVar] = key;
    writeEnv(envPath, vars);
  }, [envPath]);

  const finalize = useCallback(() => {
    setStep('saving');
    // Inject saved env vars into process.env so ConfigManager picks them up immediately
    const vars = readEnv(envPath);
    for (const [k, v] of Object.entries(vars)) {
      if (v && !v.startsWith('YOUR_')) process.env[k] = v;
    }
    appActions().setInitializationStatus('ready');
    setStep('done');
    setTimeout(() => onComplete(), 300);
  }, [envPath, onComplete]);

  useInput((input, key) => {
    if (step === 'welcome') {
      if (key.return || input === ' ') setStep('provider');
      else if (key.escape) process.exit(0);
      return;
    }
    if (step === 'provider') {
      if (key.upArrow) {
        setSelectedIdx(i => (i > 0 ? i - 1 : PROVIDERS.length - 1));
      } else if (key.downArrow) {
        setSelectedIdx(i => (i < PROVIDERS.length - 1 ? i + 1 : 0));
      } else if (key.return) {
        if (selectedProvider.noKey) {
          // Ollama needs no key — mark as done and ask for another
          setSaved(s => [...s, 'Ollama']);
          setStep('another');
        } else {
          setApiKey('');
          setError(null);
          setStep('apikey');
        }
      } else if (key.escape) {
        if (saved.length > 0) {
          finalize();
        } else {
          process.exit(0);
        }
      }
    } else if (step === 'apikey') {
      if (key.return) {
        const trimmed = apiKey.trim();
        if (!trimmed) {
          setError('Key cannot be empty.');
          return;
        }
        try {
          saveKeyToEnv(selectedProvider, trimmed);
          setSaved(s => [...s, selectedProvider.envVar]);
          setApiKey('');
          setError(null);
          setStep('another');
        } catch (err) {
          setError((err as Error).message);
        }
      } else if (key.escape) {
        setApiKey('');
        setError(null);
        setStep('provider');
      } else if (key.backspace || key.delete) {
        setApiKey(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setApiKey(prev => prev + input);
      }
    } else if (step === 'another') {
      if (input === 'y' || input === 'Y') {
        setStep('provider');
      } else if (input === 'n' || input === 'N' || key.return || key.escape) {
        finalize();
      }
    }
  });

  const primary = theme.colors.primary;
  const muted = theme.colors.text?.muted ?? 'gray';
  const textPrimary = theme.colors.text?.primary ?? 'white';

  if (step === 'welcome') {
    return (
      <Box flexDirection="column" padding={1} gap={1}>
        <Text color={primary} bold>{`
  ╔═╗╔═╗╔═╗╦╔═╗
  ╠═╣║╣ ║ ╦║╚═╗
  ╩ ╩╚═╝╚═╝╩╚═╝`}</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text color={primary} bold>ÆGIS Code  </Text>
          <Text color={muted} dimColor>Terminal AI coding agent</Text>
        </Box>
        <Box marginLeft={2} flexDirection="column" gap={0}>
          <Text color={textPrimary} bold>Quick setup:</Text>
          <Box marginTop={1} flexDirection="column" gap={0}>
            <Box gap={2}>
              <Text color={primary} bold>1</Text>
              <Text color={textPrimary}>Install Node.js 22+</Text>
              <Text color={muted} dimColor>→  nvm install 22</Text>
            </Box>
            <Box gap={2}>
              <Text color={primary} bold>2</Text>
              <Text color={textPrimary}>Install CLI        </Text>
              <Text color={muted} dimColor>→  npm install -g aegiscode</Text>
            </Box>
            <Box gap={2}>
              <Text color={primary} bold>3</Text>
              <Text color={textPrimary}>Add your API key   </Text>
              <Text color={muted} dimColor>→  next screen</Text>
            </Box>
          </Box>
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Text color={muted} dimColor>Press </Text>
          <Text color={primary} bold>Enter</Text>
          <Text color={muted} dimColor> to set up your API key  ·  Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'saving' || step === 'done') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={primary}>◆ Saving configuration...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={primary}>◆ ÆGIS — Setup</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={muted}>
          Keys are saved to <Text color={textPrimary}>~/.aegiscode/.env</Text>
        </Text>
      </Box>

      {/* Saved so far */}
      {saved.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          {saved.map(v => (
            <Text key={v} color="green">✓ {v}</Text>
          ))}
        </Box>
      )}

      {step === 'provider' && (
        <>
          <Box marginBottom={1}>
            <Text bold color={textPrimary}>Select provider:</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            {PROVIDERS.map((p, i) => {
              const isSelected = i === selectedIdx;
              const alreadySaved = saved.includes(p.envVar || 'Ollama');
              return (
                <Box key={p.id}>
                  <Text color={isSelected ? primary : muted}>
                    {isSelected ? '❯ ' : '  '}
                  </Text>
                  <Text bold={isSelected} color={isSelected ? textPrimary : muted}>
                    {p.label}
                  </Text>
                  <Text color={muted}>
                    {'  '}
                  </Text>
                  <Text color={alreadySaved ? 'green' : muted} dimColor={!alreadySaved}>
                    {p.noKey ? '(no key needed)' : p.envVar}
                    {alreadySaved ? ' ✓' : ''}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Box>
            <Text color={muted} dimColor>
              ↑↓ navigate  Enter select{saved.length > 0 ? '  Esc done' : '  Esc exit'}
            </Text>
          </Box>
        </>
      )}

      {step === 'apikey' && (
        <>
          <Box marginBottom={1}>
            <Text bold color={textPrimary}>
              {selectedProvider.label}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={muted} dimColor>
              Get your key at: {selectedProvider.keyUrl}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color={muted}>{selectedProvider.envVar}=</Text>
          </Box>
          <Box marginBottom={1} borderStyle="round" borderColor={primary} paddingX={1}>
            <Text color={textPrimary}>
              {apiKey.length > 0
                ? apiKey.slice(0, 8) + '•'.repeat(Math.max(0, apiKey.length - 8))
                : ''}
              <Text color={primary}>▏</Text>
              {apiKey.length === 0 && (
                <Text color={muted} dimColor>paste your key here</Text>
              )}
            </Text>
          </Box>
          {error && (
            <Box marginBottom={1}>
              <Text color="red">✗ {error}</Text>
            </Box>
          )}
          <Box>
            <Text color={muted} dimColor>Enter confirm  Esc back</Text>
          </Box>
        </>
      )}

      {step === 'another' && (
        <>
          <Box marginBottom={1}>
            <Text color="green">✓ Saved to ~/.aegiscode/.env</Text>
          </Box>
          <Box>
            <Text color={textPrimary}>Add another provider? </Text>
            <Text color={primary} bold>y</Text>
            <Text color={muted}>/</Text>
            <Text color={primary} bold>n</Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SetupWizard;
