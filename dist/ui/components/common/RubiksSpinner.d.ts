/**
 * RubiksSpinner - Compact animated spinner for /multi (generating state)
 * Uses the same dots spinner from cli-spinners as the ordinary Spinner.
 */
import React from 'react';
interface RubiksSpinnerProps {
    /** Agent label to display next to the spinner */
    agent?: string;
}
/**
 * Same rotating dots spinner as the ordinary Spinner from ink-spinner.
 * Runs through all frames of the 'dots' type at the correct interval.
 */
export declare const RubiksSpinner: React.FC<RubiksSpinnerProps>;
export default RubiksSpinner;
//# sourceMappingURL=RubiksSpinner.d.ts.map