import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * SetupWizard - Interactive first-run setup guide
 *
 * Saves API keys to ~/.aegiscode/.env — config.json picks them up automatically.
 * Flow: pick provider → enter key → add another? → done
 */
import { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { themeManager } from '../../themes/index.js';
import { appActions } from '../../../store/index.js';
const PROVIDERS = [
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
function readEnv(envPath) {
    const result = {};
    if (!fs.existsSync(envPath))
        return result;
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const eq = line.indexOf('=');
        if (eq < 0 || line.trim().startsWith('#'))
            continue;
        result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return result;
}
function writeEnv(envPath, vars) {
    const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
}
export const SetupWizard = ({ onComplete }) => {
    const theme = themeManager.getTheme();
    const [step, setStep] = useState('provider');
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState([]); // env var names already saved this session
    const selectedProvider = PROVIDERS[selectedIdx];
    const envPath = path.join(os.homedir(), '.aegiscode', '.env');
    const saveKeyToEnv = useCallback((provider, key) => {
        const configDir = path.join(os.homedir(), '.aegiscode');
        if (!fs.existsSync(configDir))
            fs.mkdirSync(configDir, { recursive: true });
        const vars = readEnv(envPath);
        vars[provider.envVar] = key;
        writeEnv(envPath, vars);
    }, [envPath]);
    const finalize = useCallback(() => {
        setStep('saving');
        // Inject saved env vars into process.env so ConfigManager picks them up immediately
        const vars = readEnv(envPath);
        for (const [k, v] of Object.entries(vars)) {
            if (v && !v.startsWith('YOUR_'))
                process.env[k] = v;
        }
        appActions().setInitializationStatus('ready');
        setStep('done');
        setTimeout(() => onComplete(), 300);
    }, [envPath, onComplete]);
    useInput((input, key) => {
        if (step === 'provider') {
            if (key.upArrow) {
                setSelectedIdx(i => (i > 0 ? i - 1 : PROVIDERS.length - 1));
            }
            else if (key.downArrow) {
                setSelectedIdx(i => (i < PROVIDERS.length - 1 ? i + 1 : 0));
            }
            else if (key.return) {
                if (selectedProvider.noKey) {
                    // Ollama needs no key — mark as done and ask for another
                    setSaved(s => [...s, 'Ollama']);
                    setStep('another');
                }
                else {
                    setApiKey('');
                    setError(null);
                    setStep('apikey');
                }
            }
            else if (key.escape) {
                if (saved.length > 0) {
                    finalize();
                }
                else {
                    process.exit(0);
                }
            }
        }
        else if (step === 'apikey') {
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
                }
                catch (err) {
                    setError(err.message);
                }
            }
            else if (key.escape) {
                setApiKey('');
                setError(null);
                setStep('provider');
            }
            else if (key.backspace || key.delete) {
                setApiKey(prev => prev.slice(0, -1));
            }
            else if (input && !key.ctrl && !key.meta && input.length === 1) {
                setApiKey(prev => prev + input);
            }
        }
        else if (step === 'another') {
            if (input === 'y' || input === 'Y') {
                setStep('provider');
            }
            else if (input === 'n' || input === 'N' || key.return || key.escape) {
                finalize();
            }
        }
    });
    const primary = theme.colors.primary;
    const muted = theme.colors.text?.muted ?? 'gray';
    const textPrimary = theme.colors.text?.primary ?? 'white';
    if (step === 'saving' || step === 'done') {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsx(Text, { color: primary, children: "\u25C6 Saving configuration..." }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: primary, children: "\u25C6 \u00C6GIS \u2014 Setup" }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: muted, children: ["Keys are saved to ", _jsx(Text, { color: textPrimary, children: "~/.aegiscode/.env" })] }) }), saved.length > 0 && (_jsx(Box, { marginBottom: 1, flexDirection: "column", children: saved.map(v => (_jsxs(Text, { color: "green", children: ["\u2713 ", v] }, v))) })), step === 'provider' && (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: textPrimary, children: "Select provider:" }) }), _jsx(Box, { flexDirection: "column", marginBottom: 1, children: PROVIDERS.map((p, i) => {
                            const isSelected = i === selectedIdx;
                            const alreadySaved = saved.includes(p.envVar || 'Ollama');
                            return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? primary : muted, children: isSelected ? '❯ ' : '  ' }), _jsx(Text, { bold: isSelected, color: isSelected ? textPrimary : muted, children: p.label }), _jsx(Text, { color: muted, children: '  ' }), _jsxs(Text, { color: alreadySaved ? 'green' : muted, dimColor: !alreadySaved, children: [p.noKey ? '(no key needed)' : p.envVar, alreadySaved ? ' ✓' : ''] })] }, p.id));
                        }) }), _jsx(Box, { children: _jsxs(Text, { color: muted, dimColor: true, children: ["\u2191\u2193 navigate  Enter select", saved.length > 0 ? '  Esc done' : '  Esc exit'] }) })] })), step === 'apikey' && (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: textPrimary, children: selectedProvider.label }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: muted, dimColor: true, children: ["Get your key at: ", selectedProvider.keyUrl] }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: muted, children: [selectedProvider.envVar, "="] }) }), _jsx(Box, { marginBottom: 1, borderStyle: "round", borderColor: primary, paddingX: 1, children: _jsxs(Text, { color: textPrimary, children: [apiKey.length > 0
                                    ? apiKey.slice(0, 8) + '•'.repeat(Math.max(0, apiKey.length - 8))
                                    : '', _jsx(Text, { color: primary, children: "\u258F" }), apiKey.length === 0 && (_jsx(Text, { color: muted, dimColor: true, children: "paste your key here" }))] }) }), error && (_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { color: "red", children: ["\u2717 ", error] }) })), _jsx(Box, { children: _jsx(Text, { color: muted, dimColor: true, children: "Enter confirm  Esc back" }) })] })), step === 'another' && (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "green", children: "\u2713 Saved to ~/.aegiscode/.env" }) }), _jsxs(Box, { children: [_jsx(Text, { color: textPrimary, children: "Add another provider? " }), _jsx(Text, { color: primary, bold: true, children: "y" }), _jsx(Text, { color: muted, children: "/" }), _jsx(Text, { color: primary, bold: true, children: "n" })] })] }))] }));
};
export default SetupWizard;
//# sourceMappingURL=SetupWizard.js.map