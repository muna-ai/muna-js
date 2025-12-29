/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { z } from "zod"

const ChatCompletionMessageSchema = z.object({
    role: z.enum(["assistant", "developer", "system", "user"]),
    content: z.string().nullable()
});

const ChatCompletionUsageSchema = z.object({
    completion_tokens: z.number(),
    prompt_tokens: z.number(),
    total_tokens: z.number()
});

const ChatCompletionChoiceSchema = z.object({
    index: z.number(),
    message: ChatCompletionMessageSchema,
    finish_reason: z.enum(["stop", "length", "tool_calls", "content_filter", "function_call"]),
    logprobs: z.null().optional()
});

export const ChatCompletionSchema = z.object({
    object: z.literal("chat.completion"),
    id: z.string(),
    model: z.string(),
    choices: z.array(ChatCompletionChoiceSchema),
    created: z.number(),
    usage: ChatCompletionUsageSchema.nullable()
});

const ChatCompletionChunkDeltaSchema = z.object({
    role: z.enum(["developer", "system", "user", "assistant", "tool"]).optional(),
    content: z.string().nullable().optional()
});

const ChatCompletionChunkChoiceSchema = z.object({
    index: z.number(),
    delta: ChatCompletionChunkDeltaSchema.nullable(),
    finish_reason: z.enum(["stop", "length", "tool_calls", "content_filter", "function_call"]).nullable(),
    logprobs: z.null().optional()
});

export const ChatCompletionChunkSchema = z.object({
    object: z.literal("chat.completion.chunk"),
    id: z.string(),
    model: z.string(),
    choices: z.array(ChatCompletionChunkChoiceSchema),
    created: z.number(),
    usage: ChatCompletionUsageSchema.nullable()
});
