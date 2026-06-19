/**
 * Anonymous machine fingerprint — used only to gate the free memory tier
 * against trivial reset (deleting config.json, fresh container). Soft
 * anti-abuse signal, not a security boundary: never send the raw machine
 * ID anywhere, only a salted hash of it.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as os from 'os';
function readRawMachineId() {
    try {
        if (process.platform === 'linux') {
            try {
                return fs.readFileSync('/etc/machine-id', 'utf8').trim();
            }
            catch {
                return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
            }
        }
        if (process.platform === 'darwin') {
            const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8', timeout: 3000 });
            const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
            if (m)
                return m[1];
        }
        if (process.platform === 'win32') {
            const out = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf8', timeout: 3000 });
            const m = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
            if (m)
                return m[1];
        }
    }
    catch {
        // fall through to weak fallback below
    }
    return '';
}
export function getMachineFingerprint() {
    const raw = readRawMachineId() || `${os.hostname()}:${os.platform()}:${os.arch()}`;
    return crypto.createHash('sha256').update(`aegis-fp-v1:${raw}`).digest('hex');
}
//# sourceMappingURL=machineFingerprint.js.map