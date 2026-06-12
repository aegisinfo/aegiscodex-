/**
 *
 *
 *
 */
import { z } from 'zod';
/**
 *
 */
export declare const ToolSchemas: {
    /**
     *
     */
    filePath: (options?: {
        description?: string;
    }) => z.ZodString;
    /**
     *
     */
    absolutePath: (options?: {
        description?: string;
    }) => z.ZodEffects<z.ZodString, string, string>;
    /**
     *
     */
    lineNumber: (options?: {
        description?: string;
    }) => z.ZodNumber;
    /**
     *
     */
    lineLimit: (options?: {
        description?: string;
        max?: number;
    }) => z.ZodNumber;
    /**
     *
     */
    encoding: () => z.ZodDefault<z.ZodEnum<["utf8", "utf-8", "ascii", "base64", "binary", "hex"]>>;
    /**
     * Glob 模式
     */
    globPattern: (options?: {
        description?: string;
    }) => z.ZodString;
    /**
     *
     */
    regexPattern: (options?: {
        description?: string;
    }) => z.ZodString;
    /**
     *
     */
    command: (options?: {
        description?: string;
    }) => z.ZodString;
    /**
     *
     */
    timeout: (options?: {
        max?: number;
        default?: number;
    }) => z.ZodDefault<z.ZodNumber>;
    /**
     *
     */
    booleanWithDefault: (defaultValue: boolean, description?: string) => z.ZodDefault<z.ZodBoolean>;
};
/**
 *
 */
export declare function optional<T extends z.ZodType>(schema: T): z.ZodOptional<T>;
//# sourceMappingURL=schemas.d.ts.map