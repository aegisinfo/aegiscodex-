/**
 *
 *
 *
 */
import os from 'os';
/**
 *
 */
export function getEnvironmentInfo() {
    return {
        workingDirectory: process.cwd(),
        homeDirectory: os.homedir(),
        platform: `${os.platform()} ${os.release()}`,
        nodeVersion: process.version,
        currentDate: new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }),
        shell: process.env.SHELL || 'unknown',
        username: (() => { try {
            return os.userInfo().username;
        }
        catch {
            return process.env.USER || 'user';
        } })(),
    };
}
/**
 *
 *
 *
 */
export function getEnvironmentContext() {
    const env = getEnvironmentInfo();
    return `# Environment Context

## Working Directory
**Current**: \`${env.workingDirectory}\`
**Home**: \`${env.homeDirectory}\`

## System Information
- **Platform**: ${env.platform}
- **Node.js**: ${env.nodeVersion}
- **Shell**: ${env.shell}
- **Date**: ${env.currentDate}

## File Path Guidelines
When using file tools, provide **absolute paths**:
- ✅ Correct: \`${env.workingDirectory}/package.json\`
- ❌ Incorrect: \`package.json\` (relative path)

The working directory is the root for all relative references.`;
}
//# sourceMappingURL=environment.js.map