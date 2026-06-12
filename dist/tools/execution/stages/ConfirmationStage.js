/**
 * Confirmation Stage - 用户确认阶段
 *
 */
export class ConfirmationStage {
    sessionApprovals;
    name = 'confirmation';
    constructor(sessionApprovals) {
        this.sessionApprovals = sessionApprovals;
    }
    async process(execution) {
        // 如果不需要确认，直接通
        if (!execution._internal.needsConfirmation) {
            return;
        }
        const tool = execution._internal.tool;
        if (!tool) {
            execution.abort('Tool not found in execution context');
            return;
        }
        // 检查是否已在会话中批
        const signature = execution._internal.permissionSignature;
        if (signature && this.sessionApprovals.has(signature)) {
            return;
        }
        // 构建确认详
        const confirmationDetails = {
            title: `Permission Required: ${tool.name}`,
            message: execution._internal.confirmationReason || 'This operation requires your confirmation',
            details: this.generatePreview(execution),
            risks: this.extractRisks(execution),
            affectedFiles: this.getAffectedPaths(execution),
        };
        // 请求用户确
        const handler = execution.context.confirmationHandler;
        if (!handler) {
            // 无确认处理器，默认拒
            execution.abort('No confirmation handler available - operation requires user approval');
            return;
        }
        const response = await handler.requestConfirmation(confirmationDetails);
        if (!response.approved) {
            execution.abort(`User rejected: ${response.reason || 'No reason provided'}`);
            return;
        }
        // 如果用户选择"记住此决定"，保存到会话批准列
        if (response.scope === 'session' && signature) {
            this.sessionApprovals.add(signature);
        }
    }
    /**
     *
     */
    generatePreview(execution) {
        const { toolName, params } = execution;
        switch (toolName) {
            case 'Edit': {
                const oldString = params.old_string;
                const newString = params.new_string;
                const filePath = params.file_path;
                return `**File:** ${filePath}

**Before:**
\`\`\`
${this.truncate(oldString, 10)}
\`\`\`

**After:**
\`\`\`
${this.truncate(newString, 10)}
\`\`\``;
            }
            case 'Write': {
                const content = params.contents;
                const filePath = params.file_path;
                return `**File:** ${filePath}

**Content Preview:**
\`\`\`
${this.truncate(content, 20)}
\`\`\``;
            }
            case 'Bash': {
                const command = params.command;
                const cwd = params.working_directory;
                return `**Command:** \`${command}\`${cwd ? `\n**Directory:** ${cwd}` : ''}`;
            }
            default:
                return undefined;
        }
    }
    /**
     *
     */
    extractRisks(execution) {
        const risks = [];
        const { toolName, params } = execution;
        const tool = execution._internal.tool;
        // 基于工具类型的风
        if (tool?.kind === 'write') {
            risks.push('This operation will modify files');
        }
        else if (tool?.kind === 'execute') {
            risks.push('This operation will execute system commands');
        }
        // 基于参数的风
        if (toolName === 'Bash') {
            const command = params.command;
            if (command.includes('rm')) {
                risks.push('Command may delete files');
            }
            if (command.includes('sudo')) {
                risks.push('Command requires elevated privileges');
            }
            if (command.includes('|')) {
                risks.push('Command uses piping');
            }
        }
        // 检查敏感文
        const confirmReason = execution._internal.confirmationReason || '';
        if (confirmReason.includes('Sensitive file')) {
            risks.push('Operation involves sensitive files');
        }
        return risks;
    }
    /**
     *
     */
    getAffectedPaths(execution) {
        const params = execution.params;
        const pathKeys = ['file_path', 'path', 'target', 'destination'];
        const paths = [];
        for (const key of pathKeys) {
            if (typeof params[key] === 'string') {
                paths.push(params[key]);
            }
        }
        return paths;
    }
    /**
     *
     */
    truncate(text, maxLines = 10) {
        const lines = text.split('\n');
        if (lines.length <= maxLines) {
            return text;
        }
        return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
    }
}
//# sourceMappingURL=ConfirmationStage.js.map