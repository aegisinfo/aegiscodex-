/**
 * 
 * 
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { VersionCheckResult } from '../../../services/VersionChecker.js';
import {
  setSkipUntilVersion,
  getUpgradeCommand,
  performUpgrade,
  restartApp,
} from '../../../services/VersionChecker.js';

interface UpdatePromptProps {
  versionInfo: VersionCheckResult;
  onComplete: () => void;
}

type MenuOption = 'update' | 'skip' | 'skipUntil';

const menuOptions: { key: MenuOption; label: string }[] = [
  { key: 'update', label: 'Update now' },
  { key: 'skip', label: 'Skip' },
  { key: 'skipUntil', label: 'Skip until next version' },
];

export const UpdatePrompt: React.FC<UpdatePromptProps> = ({
  versionInfo,
  onComplete,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  useInput(async (input, key) => {
    if (isUpdating) return;
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
      return;
    }
    const numKey = parseInt(input, 10);
    if (numKey >= 1 && numKey <= menuOptions.length) {
      setSelectedIndex(numKey - 1);
      return;
    }
    if (key.return) {
      const selected = menuOptions[selectedIndex];
      await handleSelection(selected.key);
    }
  });

  const handleSelection = async (option: MenuOption) => {
    switch (option) {
      case 'update':
        setIsUpdating(true);
        const result = await performUpgrade();
        setUpdateResult(result.message);
        if (result.success) {
          setTimeout(() => restartApp(), 1500);
        } else {
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
  if (updateResult) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{updateResult}</Text>
      </Box>
    );
  }
  if (isUpdating) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">⏳ Upgrading...</Text>
        <Text color="gray">{getUpgradeCommand()}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🎉 New version available!
        </Text>
      </Box>

      {}
      <Box marginBottom={1}>
        <Text>
          <Text color="gray">{versionInfo.currentVersion}</Text>
          <Text color="gray"> → </Text>
          <Text color="green" bold>{versionInfo.latestVersion}</Text>
        </Text>
      </Box>

      {}
      <Box flexDirection="column" marginBottom={1}>
        {menuOptions.map((option, index) => (
          <Box key={option.key}>
            <Text color={selectedIndex === index ? 'cyan' : 'white'}>
              {selectedIndex === index ? '❯ ' : '  '}
              {index + 1}. {option.label}
            </Text>
          </Box>
        ))}
      </Box>

      {}
      <Box>
        <Text color="gray">
          Use ↑↓ to navigate, Enter to select, or press 1-3
        </Text>
      </Box>
    </Box>
  );
};

export default UpdatePrompt;
