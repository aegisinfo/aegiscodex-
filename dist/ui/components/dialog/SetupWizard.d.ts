/**
 * SetupWizard - Interactive first-run setup guide
 *
 * Saves API keys to ~/.aegiscode/.env — config.json picks them up automatically.
 * Flow: pick provider → enter key → add another? → done
 */
import React from 'react';
interface SetupWizardProps {
    onComplete: () => void;
}
export declare const SetupWizard: React.FC<SetupWizardProps>;
export default SetupWizard;
//# sourceMappingURL=SetupWizard.d.ts.map