/**
 * InteractiveSelector - 交互式选择器组件
 *
 *
 */
import React from 'react';
export interface SelectorOption<T = string> {
    /** 选项值 */
    value: T;
    /** 显示标签 */
    label: string;
    /** 描述信息 */
    description?: string;
    /** 是否为当前选中项 */
    isCurrent?: boolean;
}
interface InteractiveSelectorProps<T = string> {
    /** 标题 */
    title: string;
    /** 选项列表 */
    options: SelectorOption<T>[];
    /** 选择回调 */
    onSelect: (value: T) => void;
    /** 取消回调 */
    onCancel: () => void;
    /** 初始选中索引 */
    initialIndex?: number;
    /** 焦点 ID */
    focusId?: string;
}
/**
 *
 */
export declare function InteractiveSelector<T = string>({ title, options, onSelect, onCancel, initialIndex, focusId, }: InteractiveSelectorProps<T>): React.ReactElement;
export default InteractiveSelector;
//# sourceMappingURL=InteractiveSelector.d.ts.map