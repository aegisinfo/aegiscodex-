/**
 * RubiksSpinner - Compact animated spinner for /multi (generating state)
 * Uses the same dots spinner from cli-spinners as the ordinary Spinner.
 */

import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import spinners from 'cli-spinners';

interface RubiksSpinnerProps {
  /** Agent label to display next to the spinner */
  agent?: string;
}

/**
 * Same rotating dots spinner as the ordinary Spinner from ink-spinner.
 * Runs through all frames of the 'dots' type at the correct interval.
 */
export const RubiksSpinner: React.FC<RubiksSpinnerProps> = ({ agent }) => {
  const [frame, setFrame] = useState(0);
  const spinner = spinners.dots;

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => {
        const isLastFrame = prev === spinner.frames.length - 1;
        return isLastFrame ? 0 : prev + 1;
      });
    }, spinner.interval);
    return () => clearInterval(id);
  }, []);

  return (
    <Text>
      {spinner.frames[frame]}
      {agent ? ` ${agent}` : ''}
    </Text>
  );
};

export default RubiksSpinner;
