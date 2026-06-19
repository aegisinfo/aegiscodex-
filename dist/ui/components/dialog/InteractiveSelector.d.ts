/**
 * InteractiveSelector - 交互式选择器组件
 */
import React from 'react';
export interface SelectorOption<T = string> {
    value: T;
    label: string;
    description?: string;
    isCurrent?: boolean;
}
interface InteractiveSelectorProps<T = string> {
    title: string;
    options: SelectorOption<T>[];
    onSelect: (value: T) => void;
    onCancel: () => void;
    initialIndex?: number;
    focusId?: string;
    maxVisible?: number;
}
export declare function InteractiveSelector<T = string>({ title, options, onSelect, onCancel, initialIndex, focusId, maxVisible, }: InteractiveSelectorProps<T>): React.ReactElement;
export default InteractiveSelector;
//# sourceMappingURL=InteractiveSelector.d.ts.map