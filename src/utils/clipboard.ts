/**
 * Clipboard helper with an OSC 52 fallback.
 *
 * Native tools (pbcopy/xclip/xsel/clip) require a desktop clipboard and,
 * on Linux, an X11/Wayland display — neither is available over plain SSH
 * or on minimal/headless installs. OSC 52 asks the terminal emulator
 * itself to set the clipboard and works in that case too (most modern
 * terminals support it, including over SSH and inside tmux/screen).
 */
export async function copyToClipboard(text: string): Promise<void> {
  const { execSync } = await import('child_process');
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      execSync('pbcopy', { input: text });
      return;
    }
    if (platform === 'win32') {
      execSync('clip', { input: text });
      return;
    }
    if (platform === 'linux') {
      try {
        execSync('xclip -selection clipboard', { input: text });
        return;
      } catch {
        execSync('xsel --clipboard --input', { input: text });
        return;
      }
    }
  } catch {
    // Fall through to the OSC 52 escape sequence below.
  }

  writeOsc52(text);
}

function writeOsc52(text: string): void {
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  // Wrap in tmux passthrough so it reaches the outer terminal when running
  // inside tmux, where OSC 52 would otherwise be swallowed by tmux itself.
  const sequence = `\x1b]52;c;${base64}\x07`;
  const payload = process.env.TMUX
    ? `\x1bPtmux;\x1b${sequence}\x1b\\`
    : sequence;
  process.stdout.write(payload);
}
