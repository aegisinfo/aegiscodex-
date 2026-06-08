/**
 * RubiksSpinner - 1D Rubik's Cube spinner for /multi (4 sides = 4 agents)
 */

import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

interface RubiksSpinnerProps {
  /** Agent label to display next to the cube */
  agent?: string;
}

const FACES = ['⬜', '🟥', '🟩', '🟦'];

const CUBE_FRAMES = [
  `[${FACES[0]}][  ][  ][  ]`,
  `[  ][${FACES[1]}][  ][  ]`,
  `[  ][  ][${FACES[2]}][  ]`,
  `[  ][  ][  ][${FACES[3]}]`,
];

/**
 * A 1D Rubik's Cube spinner: cycles 4 faces representing the 4 agents.
 */
export const RubiksSpinner: React.FC<RubiksSpinnerProps> = ({ agent }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % CUBE_FRAMES.length);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <Text>
      {' '}{CUBE_FRAMES[frame]}
      {agent ? ` ${agent}` : ''}
    </Text>
  );
};

export default RubiksSpinner;
