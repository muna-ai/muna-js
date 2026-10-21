/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { z } from "zod"

const FinishReasonSchema = z.enum(["stop", "length", "tool_calls", "content_filter", "function_call"]);

const ChatCompletionUsageSchema = z.object({
    completion_tokens: z.number(),
    prompt_tokens: z.number(),
    total_tokens: z.number(),
    prompt_tokens_details: z.object({
        audio_tokens: z.number().nullish(),
        cache_write_tokens: z.number().nullish(),
        cached_tokens: z.number().nullish()
    }).nullish(),
    completion_tokens_details: z.object({
        reasoning_tokens: z.number().nullish()
    }).nullish()
});

const ChoiceDeltaToolCallSchema = z.object({
    index: z.number(),
    id: z.string().nullish(),
    type: z.literal("function").nullish(),
    function: z.object({
        name: z.string().nullish(),
        arguments: z.string().nullish()
    }).nullish()
});

const ChatCompletionChunkDeltaSchema = z.object({
    role: z.enum(["developer", "system", "user", "assistant", "tool"]).nullish(),
    content: z.string().nullish(),
    reasoning_content: z.string().nullish(),
    tool_calls: z.array(ChoiceDeltaToolCallSchema).nullish()
});

const ChatCompletionChunkChoiceSchema = z.object({
    index: z.number(),
    delta: ChatCompletionChunkDeltaSchema.nullable(),
    finish_reason: FinishReasonSchema.nullish(),
    logprobs: z.null().optional()
});

export const ChatCompletionChunkSchema = z.object({
    object: z.literal("chat.completion.chunk"),
    id: z.string(),
    model: z.string(),
    choices: z.array(ChatCompletionChunkChoiceSchema),
    created: z.number(),
    usage: ChatCompletionUsageSchema.nullish()
});

const ChatCompletionContentPartSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text"),
        text: z.string()
    }),
    z.object({
        type: z.literal("image_url"),
        image_url: z.object({
            url: z.string(),
            detail: z.enum(["auto", "low", "high"]).nullish()
        })
    }),
    z.object({
        type: z.literal("input_audio"),
        input_audio: z.object({
            data: z.string(),
            format: z.enum(["wav", "mp3"])
        })
    }),
    z.object({
        type: z.literal("file"),
        file: z.object({
            file_data: z.string().nullish(),
            file_id: z.string().nullish(),
            filename: z.string().nullish()
        })
    }),
    z.object({
        type: z.literal("refusal"),
        refusal: z.string()
    })
]);

export const ChatCompletionMessageSchema = z.object({
    role: z.enum(["assistant", "user", "system", "developer", "tool"]),
    content: z.union([z.string(), z.array(ChatCompletionContentPartSchema)]).nullable(),
    reasoning_content: z.string().nullish(),
    tool_calls: z.array(z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
            name: z.string(),
            arguments: z.string()
        })
    })).nullish(),
    tool_call_id: z.string().nullish()
});
