import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * UpdatePrompt - 版本更新提示组件
 *
 *
 * - Update now: 立即执行升级
 * - Skip: 跳过本次提示
 * - Skip until next version: 跳过当前版本的提示
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { setSkipUntilVersion, getUpgradeCommand, performUpgrade, restartApp, } from '../../../services/VersionChecker.js';
const menuOptions = [
    { key: 'update', label: 'Update now' },
    { key: 'skip', label: 'Skip' },
    { key: 'skipUntil', label: 'Skip until next version' },
];
export const UpdatePrompt = ({ versionInfo, onComplete, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateResult, setUpdateResult] = useState(null);
    useInput(async (input, key) => {
        if (isUpdating)
            return;
        // 上下键选
        if (key.upArrow) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
            return;
        }
        // 数字键快速选
        const numKey = parseInt(input, 10);
        if (numKey >= 1 && numKey <= menuOptions.length) {
            setSelectedIndex(numKey - 1);
            return;
        }
        // Enter 确认选
        if (key.return) {
            const selected = menuOptions[selectedIndex];
            await handleSelection(selected.key);
        }
    });
    const handleSelection = async (option) => {
        switch (option) {
            case 'update':
                setIsUpdating(true);
                const result = await performUpgrade();
                setUpdateResult(result.message);
                if (result.success) {
                    // 升级成功，自动重启应
                    setTimeout(() => restartApp(), 1500);
                }
                else {
                    // 升级失败，继续进入应
                    setTimeout(() => onComplete(), 2000);
                }
                break;
            case 'skip':
                onComplete();
                break;
            case 'skipUntil':
                if (versionInfo.latestVersion) {
                    await setSkipUntilVersion(versionInfo.latestVersion);
                }
                onComplete();
                break;
        }
    };
    // 显示升级结
    if (updateResult) {
        return (_jsx(Box, { flexDirection: "column", padding: 1, children: _jsx(Text, { children: updateResult }) }));
    }
    // 显示升级
    if (isUpdating) {
        return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { color: "yellow", children: "\u23F3 Upgrading..." }), _jsx(Text, { color: "gray", children: getUpgradeCommand() })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "cyan", children: "\uD83C\uDF89 New version available!" }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { children: [_jsx(Text, { color: "gray", children: versionInfo.currentVersion }), _jsx(Text, { color: "gray", children: " \u2192 " }), _jsx(Text, { color: "green", bold: true, children: versionInfo.latestVersion })] }) }), _jsx(Box, { flexDirection: "column", marginBottom: 1, children: menuOptions.map((option, index) => (_jsx(Box, { children: _jsxs(Text, { color: selectedIndex === index ? 'cyan' : 'white', children: [selectedIndex === index ? '❯ ' : '  ', index + 1, ". ", option.label] }) }, option.key))) }), _jsx(Box, { children: _jsx(Text, { color: "gray", children: "Use \u2191\u2193 to navigate, Enter to select, or press 1-3" }) })] }));
};
export default UpdatePrompt;
//# sourceMappingURL=UpdatePrompt.js.map