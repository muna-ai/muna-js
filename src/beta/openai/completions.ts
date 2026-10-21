/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { decode } from "base64-arraybuffer"
import { getFxnc } from "../../c"
import type { PredictionService, PredictorService } from "../../services"
import type { Acceleration, Image, Parameter, Prediction, Tensor, Value } from "../../types"
import { FLOAT_DTYPES, getParameter, INTEGER_DTYPES } from "../annotations"
import { predictionErrorToError } from "../errors"
import { ChatCompletionChunkSchema, ChatCompletionMessageSchema } from "./schema"
import type {
    ChatCompletion, ChatCompletionChunk, ChatCompletionFunctionTool,
    ChatCompletionMessage, ChatCompletionMessageFunctionToolCall,
    ChatCompletionReasoningEffort, ChatCompletionToolChoice
} from "./types"

export interface ChatCompletionCreateParamsBase {
    /**
     * Messages comprising the conversation so far.
     */
    messages: ChatCompletionMessage[];
    /**
     * Chat predictor tag.
     */
    model: string;
    /**
     * Tools the model may call.
     */
    tools?: ChatCompletionFunctionTool[] | null;
    /**
     * Tool choice mode.
     * Defaults to `auto`. When `none`, tools are not sent to the model.
     */
    tool_choice?: ChatCompletionToolChoice | null;
    /**
     * Response format.
     */
    response_format?: Record<string, object>;
    /**
     * Reasoning effort for reasoning models.
     */
    reasoning_effort?: ChatCompletionReasoningEffort | null;
    /**
     * Maximum completion tokens.
     */
    max_completion_tokens?: number | null;
    /**
     * Sampling temperature to use.
     */
    temperature?: number | null;
    /**
     * Nucleus sampling coefficient.
     */
    top_p?: number | null;
    /**
     * Sampling seed for reproducible outputs.
     */
    seed?: number | null;
    /**
     * Token frequency penalty.
     */
    frequency_penalty?: number | null;
    /**
     * Token presence penalty.
     */
    presence_penalty?: number | null;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration;
}

export interface ChatCompletionCreateParamsNonStreaming extends ChatCompletionCreateParamsBase {
    /**
     * Whether to stream responses.
     */
    stream?: false | null;
}

export interface ChatCompletionCreateParamsStreaming extends ChatCompletionCreateParamsBase {
    /**
     * Whether to stream responses.
     */
    stream: true;
}

export type ChatCompletionCreateParams = (
    ChatCompletionCreateParamsNonStreaming |
    ChatCompletionCreateParamsStreaming
);

type ChatCompletionDelegate = (params: Omit<ChatCompletionCreateParams, "model">) => Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>>;

export class ChatCompletionService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly cache: Map<string, ChatCompletionDelegate>;

    public constructor(predictors: PredictorService, predictions: PredictionService) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.cache = new Map<string, ChatCompletionDelegate>();
    }

    /**
     * Create a chat completion.
     */
    public create(body: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
    public create(body: ChatCompletionCreateParamsStreaming): Promise<AsyncGenerator<ChatCompletionChunk>>;
    public create(body: ChatCompletionCreateParamsBase): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>>;
    public async create(body: ChatCompletionCreateParams): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>> {
        const { model: tag, acceleration = "local_auto", ...params } = body;
        // Ensure we have a delegate
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        // Make prediction
        const delegate = this.cache.get(tag);
        const response = await delegate({ ...params, acceleration });
        // Return
        return response;
    }

    private async createDelegate(tag: string): Promise<ChatCompletionDelegate> {
        // Retrieve predictor
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because ` +
                `the predictor could not be found. Check that your access key ` +
                `is valid and that you have access to the predictor.`
            );
        // Check that there is only one required input parameter
        const signature = predictor.signature;
        const requiredInputs = signature.inputs.filter(param => !param.optional);
        if (requiredInputs.length !== 1)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because ` +
                `it has more than one required input parameter.`
            );
        // Check that the input parameter is `list[Message]`
        const [, inputParam] = getParameter(requiredInputs, { dtype: "list" });
        if (!inputParam)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because ` +
                `it does not have a valid chat messages input parameter.`
            );
        // Get optional input parameters
        const [, responseFormatParam] = getParameter(signature.inputs, {
            dtype: "dict",
            denotation: "openai.chat.completions.response_format"
        });
        const [, reasoningEffortParam] = getParameter(signature.inputs, {
            dtype: "string",
            denotation: "openai.chat.completions.reasoning_effort"
        });
        const [, maxOutputTokensParam] = getParameter(signature.inputs, {
            dtype: INTEGER_DTYPES,
            denotation: "openai.chat.completions.max_output_tokens"
        });
        const [, temperatureParam] = getParameter(signature.inputs, {
            dtype: FLOAT_DTYPES,
            denotation: "openai.chat.completions.temperature"
        });
        const [, topPParam] = getParameter(signature.inputs, {
            dtype: FLOAT_DTYPES,
            denotation: "openai.chat.completions.top_p"
        });
        const [, seedParam] = getParameter(signature.inputs, {
            dtype: INTEGER_DTYPES,
            denotation: "openai.chat.completions.seed"
        });
        const [, frequencyPenaltyParam] = getParameter(signature.inputs, {
            dtype: FLOAT_DTYPES,
            denotation: "openai.chat.completions.frequency_penalty"
        });
        const [, presencePenaltyParam] = getParameter(signature.inputs, {
            dtype: FLOAT_DTYPES,
            denotation: "openai.chat.completions.presence_penalty"
        });
        const [, imagesParam] = getParameter(signature.inputs, {
            dtype: "image_list",
            denotation: "openai.chat.completions.images"
        });
        const [, audiosParam] = getParameter(signature.inputs, {
            dtype: "array_list",
            denotation: "openai.chat.completions.audios"
        });
        const [, toolsParam] = getParameter(signature.inputs, {
            dtype: "list",
            denotation: "openai.chat.completions.tools"
        });
        // Get chat completion chunk output param index
        const completionParamIdx = signature.outputs.findIndex(param =>
            param.dtype === "dict" &&
            param.schema?.title === "ChatCompletionChunk"
        );
        if (completionParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because ` +
                `it does not have a valid chat completion chunk output parameter. ` +
                `Chat predictors must yield \`ChatCompletionChunk\` outputs.`
            );
        // Define the delegate
        const delegate = async ({
            messages,
            tools,
            tool_choice,
            response_format,
            reasoning_effort,
            max_completion_tokens,
            temperature,
            top_p,
            seed,
            frequency_penalty,
            presence_penalty,
            stream,
            acceleration
        }: Omit<ChatCompletionCreateParams, "model">): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>> => {
            // Check tool support
            const requestTools = tool_choice !== "none" && tools?.length ? tools : null;
            if (requestTools && !toolsParam)
                throw new TypeError(
                    `${tag} does not support tool calling because it does ` +
                    `not declare a tools input parameter.`
                );
            // Build prediction input map
            const conversation = await normalizeConversation(messages, { imagesParam, audiosParam });
            const predictionInputs: Record<string, Value> = {
                [inputParam.name]: conversation.messages
            };
            if (imagesParam && conversation.images.length > 0)
                predictionInputs[imagesParam.name] = conversation.images;
            if (audiosParam && conversation.audios.length > 0)
                predictionInputs[audiosParam.name] = conversation.audios;
            if (requestTools)
                predictionInputs[toolsParam.name] = requestTools as unknown as Value;
            if (response_format != null && responseFormatParam)
                predictionInputs[responseFormatParam.name] = response_format;
            if (reasoning_effort != null && reasoningEffortParam)
                predictionInputs[reasoningEffortParam.name] = reasoning_effort;
            if (max_completion_tokens != null && maxOutputTokensParam)
                predictionInputs[maxOutputTokensParam.name] = max_completion_tokens;
            if (temperature != null && temperatureParam)
                predictionInputs[temperatureParam.name] = temperature;
            if (top_p != null && topPParam)
                predictionInputs[topPParam.name] = top_p;
            if (seed != null && seedParam)
                predictionInputs[seedParam.name] = seed;
            if (frequency_penalty != null && frequencyPenaltyParam)
                predictionInputs[frequencyPenaltyParam.name] = frequency_penalty;
            if (presence_penalty != null && presencePenaltyParam)
                predictionInputs[presencePenaltyParam.name] = presence_penalty;
            // Predict
            const predictionStream = this.predictions.stream({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            const completionStream = gatherCompletionOutputs(predictionStream, completionParamIdx);
            const chunks = map(parseChatCompletionChunk, completionStream);
            // Return
            if (stream)
                return chunks;
            else
                return mergeChunks(await collect(chunks));
        };
        // Return
        return delegate;
    }
}

interface NormalizedConversation {
    messages: Record<string, unknown>[];
    images: Image[];
    audios: Tensor[];
}

/**
 * Prepare a conversation for the predictor: decode media parts into parallel
 * lists correlated by order of appearance across all messages, replacing each
 * with a payload-free placeholder (`{ type: "image" }` / `{ type: "audio" }`).
 * Mirrors `_normalize_conversation` in muna-py.
 */
async function normalizeConversation(
    messages: ChatCompletionMessage[],
    { imagesParam, audiosParam }: { imagesParam: Parameter | null, audiosParam: Parameter | null }
): Promise<NormalizedConversation> {
    if (!messages?.length)
        throw new TypeError("`messages` must contain at least one message.");
    const normalized: Record<string, unknown>[] = [];
    const images: Image[] = [];
    const audios: Tensor[] = [];
    for (const [index, raw] of messages.entries()) {
        const result = ChatCompletionMessageSchema.safeParse(raw);
        if (!result.success)
            throw new TypeError(`\`messages[${index}]\` is not a valid chat message: ${result.error.message}`);
        const message = result.data;
        validateMessage(index, message as ChatCompletionMessage);
        const wire: Record<string, unknown> = withoutNullish(message);
        if (message.role === "assistant" && message.content == null)
            wire.content = "";
        if (Array.isArray(message.content)) {
            const parts: unknown[] = [];
            for (const part of message.content) {
                if (part.type === "image_url" && imagesParam) {
                    images.push(await decodeImage(part.image_url.url));
                    parts.push({ type: "image" });
                } else if (part.type === "input_audio" && audiosParam) {
                    audios.push(await decodeAudio(part.input_audio, audiosParam.sampleRate));
                    parts.push({ type: "audio" });
                } else if (part.type === "image_url" || part.type === "input_audio") {
                    throw new TypeError(`\`${part.type}\` content is not supported by this model.`);
                } else if (part.type === "file") {
                    throw new TypeError("File content parts are not yet supported.");
                } else
                    parts.push(part);
            }
            wire.content = parts;
        }
        normalized.push(wire);
    }
    return { messages: normalized, images, audios };
}

/**
 * Reject a message that carries nothing for the model to read.
 */
function validateMessage(index: number, message: ChatCompletionMessage): void {
    const { role, content } = message;
    if (role === "assistant" || role === "tool")
        return;
    const hasPayload = (
        typeof content === "string" ? content.trim().length > 0 :
        Array.isArray(content) ? content.some(part =>
            part.type === "text" ? part.text.trim().length > 0 :
            part.type === "refusal" ? part.refusal.trim().length > 0 :
            true
        ) :
        false
    );
    if (!hasPayload)
        throw new TypeError(
            `\`messages[${index}]\` (${role} message) must have non-empty \`content\`. ` +
            `Text content must contain non-whitespace characters.`
        );
}

async function decodeImage(url: string): Promise<Image> {
    let buffer: ArrayBuffer;
    let mime: string;
    if (url.startsWith("data:")) {
        const [header, encoded] = url.split(",", 2);
        mime = header.slice("data:".length).split(";")[0] || "image/png";
        buffer = decode(encoded);
    } else {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Failed to download image at ${url} with status ${response.status}`);
        buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_IMAGE_FETCH_BYTES)
            throw new TypeError(`Image at ${url} exceeds the maximum size of ${MAX_IMAGE_FETCH_BYTES} bytes.`);
        mime = response.headers.get("content-type")?.split(";")[0] || "image/png";
    }
    return await decodeValue(buffer, mime) as Image;
}

async function decodeAudio(
    { data, format }: { data: string, format: "wav" | "mp3" },
    sampleRate: number | undefined
): Promise<Tensor> {
    const mime = sampleRate ? `audio/${format};rate=${sampleRate}` : `audio/${format}`;
    return await decodeValue(decode(data), mime) as Tensor;
}

async function decodeValue(buffer: ArrayBuffer, mime: string): Promise<unknown> {
    const { FXNValue } = await getFxnc();
    const value = FXNValue.createFromBuffer(buffer, mime);
    try {
        return value.toObject();
    } finally {
        value.dispose();
    }
}

async function* gatherCompletionOutputs(
    stream: AsyncGenerator<Prediction>,
    completionParamIdx: number
): AsyncGenerator<unknown> {
    for await (const prediction of stream) {
        if (prediction.error)
            throw predictionErrorToError(prediction.error);
        yield prediction.results[completionParamIdx];
    }
}

function parseChatCompletionChunk(data: unknown): ChatCompletionChunk {
    const result = ChatCompletionChunkSchema.safeParse(data);
    if (!result.success)
        throw new Error(
            `Failed to parse chat completion chunk from model output: ${JSON.stringify(data)}. ` +
            `Chat predictors must yield \`ChatCompletionChunk\` outputs.`
        );
    return result.data as ChatCompletionChunk;
}

function mergeChunks(chunks: ChatCompletionChunk[]): ChatCompletion {
    if (chunks.length === 0)
        throw new Error("Failed to parse chat completion because model did not return any outputs");
    const choicesMap = new Map<number, ChatCompletionChunk.Choice[]>();
    for (const chunk of chunks)
        for (const choice of chunk.choices) {
            if (!choicesMap.has(choice.index))
                choicesMap.set(choice.index, []);
            choicesMap.get(choice.index)!.push(choice);
        }
    const choices = Array
        .from(choicesMap.entries())
        .map(([index, streamChoices]) => createChatCompletionChoice(index, streamChoices));
    const chunkUsages = chunks
        .map(chunk => chunk.usage)
        .filter((usage): usage is ChatCompletion.Usage => usage != null);
    // Engines report token details (e.g. cached or reasoning tokens) on the
    // final usage-bearing chunk; sums would double-count, so take the last.
    const lastDetail = <K extends keyof ChatCompletion.Usage>(key: K) => chunkUsages
        .map(usage => usage[key])
        .reverse()
        .find(detail => detail != null);
    const usage: ChatCompletion.Usage = {
        prompt_tokens: chunkUsages.reduce((sum, u) => sum + u.prompt_tokens, 0),
        completion_tokens: chunkUsages.reduce((sum, u) => sum + u.completion_tokens, 0),
        total_tokens: chunkUsages.reduce((sum, u) => sum + u.total_tokens, 0),
        ...withoutNullish({
            prompt_tokens_details: lastDetail("prompt_tokens_details"),
            completion_tokens_details: lastDetail("completion_tokens_details")
        })
    };
    return {
        object: "chat.completion",
        id: chunks[0].id,
        model: chunks[0].model,
        created: chunks[0].created,
        choices,
        usage
    };
}

function createChatCompletionChoice(
    index: number,
    choices: ChatCompletionChunk.Choice[]
): ChatCompletion.Choice {
    const deltas = choices.map(choice => choice.delta).filter(delta => delta != null);
    const role = deltas.find(delta => delta.role)?.role ?? "assistant";
    const content = deltas.map(delta => delta.content ?? "").join("");
    const reasoningContent = deltas.map(delta => delta.reasoning_content ?? "").join("");
    const toolCalls = mergeToolCalls(deltas);
    const message: ChatCompletion.Message = { role, content };
    if (reasoningContent)
        message.reasoning_content = reasoningContent;
    if (toolCalls)
        message.tool_calls = toolCalls;
    const finish_reason = choices
        .map(choice => choice.finish_reason)
        .find(reason => reason != null) ?? "stop";
    return { index, message, finish_reason, logprobs: null };
}

/**
 * Accumulate streamed tool call fragments into completed tool calls, keyed by
 * fragment index: the first fragment carries the id and function name;
 * subsequent fragments append argument text.
 */
function mergeToolCalls(
    deltas: ChatCompletionChunk.Choice.Delta[]
): ChatCompletionMessageFunctionToolCall[] | null {
    const calls = new Map<number, { id: string, name: string, arguments: string }>();
    for (const delta of deltas)
        for (const fragment of delta.tool_calls ?? []) {
            if (!calls.has(fragment.index))
                calls.set(fragment.index, { id: "", name: "", arguments: "" });
            const call = calls.get(fragment.index)!;
            if (fragment.id)
                call.id = fragment.id;
            if (fragment.function?.name)
                call.name = fragment.function.name;
            if (fragment.function?.arguments)
                call.arguments += fragment.function.arguments;
        }
    if (calls.size === 0)
        return null;
    return Array
        .from(calls.entries())
        .sort(([a], [b]) => a - b)
        .map(([, call]) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments }
        }));
}

function withoutNullish<T extends object>(value: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null));
}

async function* map<T, U>(
    fn: (x: T) => U,
    iterable: AsyncIterable<T>
): AsyncGenerator<U> {
    for await (const item of iterable)
        yield fn(item);
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const result: T[] = [];
    for await (const item of iterable)
        result.push(item);
    return result;
}

const MAX_IMAGE_FETCH_BYTES = 20 * 1024 * 1024;
