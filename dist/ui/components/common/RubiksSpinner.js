import { jsxs as _jsxs } from "react/jsx-runtime";
/**
 * RubiksSpinner - Compact animated spinner for /multi (generating state)
 * Uses the same dots spinner from cli-spinners as the ordinary Spinner.
 */
import { useEffect, useState } from 'react';
import { Text } from 'ink';
import spinners from 'cli-spinners';
/**
 * Same rotating dots spinner as the ordinary Spinner from ink-spinner.
 * Runs through all frames of the 'dots' type at the correct interval.
 */
export const RubiksSpinner = ({ agent }) => {
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
    return (_jsxs(Text, { children: [spinner.frames[frame], agent ? ` ${agent}` : ''] }));
};
export default RubiksSpinner;
//# sourceMappingURL=RubiksSpinner.js.map