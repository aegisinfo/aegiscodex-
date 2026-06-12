/**
 * MessageArea - 消息列表区域
 *
 *
 */
import React from 'react';
/**
 * UI 消息类型
 */
export interface UIMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp?: number;
    metadata?: {
        model?: string;
        tokenUsage?: {
            input: number;
            output: number;
        };
    };
}
interface MessageAreaProps {
    /** 消息列表 */
    messages: UIMessage[];
    /** 最大显示消息数 */
    maxMessages?: number;
    /** 是否显示时间戳 */
    showTimestamp?: boolean;
}
/**
 *
 */
export declare const MessageArea: React.FC<MessageAreaProps>;
export default MessageArea;
//# sourceMappingURL=MessageArea.d.ts.map