/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { CreatePredictionInput, PredictionService, PredictorService } from "../../services"
import type { Acceleration, Prediction, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import { ChatCompletionSchema, ChatCompletionChunkSchema } from "./schema"
import type { ChatCompletion, ChatCompletionChunk, ChatCompletionMessage } from "./types"

type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

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
     * Response format.
     */
    response_format?: Record<string, object>;
    /**
     * Reasoning effort for reasoning models.
     */
    reasoning_effort?: ReasoningEffort;
    /**
     * Maximum completion tokens.
     */
    max_completion_tokens?: number | null;
    /**
     * Sampling temperature to use.
     */
    temperature?: number;
    /**
     * Nucleus sampling coefficient.
     */
    top_p?: number;
    /**
     * Token frequency penalty.
     */
    frequency_penalty?: number;
    /**
     * Token presence penalty.
     */
    presence_penalty?: number;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
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
    private readonly remotePredictions: RemotePredictionService;
    private readonly cache: Map<string, ChatCompletionDelegate>;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
        this.cache = new Map<string, ChatCompletionDelegate>();
    }

    /**
     * Create a chat completion.
     */
    public create(body: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
    public create(body: ChatCompletionCreateParamsStreaming): Promise<AsyncGenerator<ChatCompletionChunk>>;
    public create(body: ChatCompletionCreateParamsBase): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>>;
    public async create(body: ChatCompletionCreateParams): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>> {
        const { model: tag, ...params } = body;
        // Ensure we have a delegate
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        // Make prediction
        const delegate = this.cache.get(tag);
        const response = await delegate({ ...params });
        // Return
        return response;
    }

    private async createDelegate(tag: string): Promise<ChatCompletionDelegate> {
        // Retrieve predictor
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because 
                the predictor could not be found. Check that your access key 
                is valid and that you have access to the predictor.`
            );
        // Check that there is only one required input parameter
        const signature = predictor.signature;
        const requiredInputs = signature.inputs.filter(param => !param.optional);
        if (requiredInputs.length !== 1)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because 
                it has more than one required input parameter.`
            );
        // Check that the input parameter is `list[Message]`
        const inputParam = requiredInputs.find(param => param.type === "list");
        if (!inputParam)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because 
                it does not have a valid chat messages input parameter.`
            );
        // Get optional input parameters
        const responseFormatParam = signature.inputs.find(param =>
            param.type === "dict" &&
            param.denotation === "openai.chat.completions.response_format"
        );
        const reasoningEffortParam = signature.inputs.find(param =>
            param.type === "string" &&
            param.denotation === "openai.chat.completions.reasoning_effort"
        );
        const maxOutputTokensParam = signature.inputs.find(param =>
            ["int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64"].includes(param.type) &&
            param.denotation === "openai.chat.completions.max_output_tokens"
        );
        const temperatureParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.type) &&
            param.denotation === "openai.chat.completions.temperature"
        );
        const topPParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.type) &&
            param.denotation === "openai.chat.completions.top_p"
        );
        const frequencyPenaltyParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.type) &&
            param.denotation === "openai.chat.completions.frequency_penalty"
        );
        const presencePenaltyParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.type) &&
            param.denotation === "openai.chat.completions.presence_penalty"
        );
        // Get chat completion output param index
        const completionParamIdx = signature.outputs.findIndex(param =>
            param.type === "dict" &&
            ["ChatCompletion", "ChatCompletionChunk"].includes(param.schema?.title)
        );
        if (completionParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI chat completions API because 
                it does not have a valid chat completion output parameter.`
            );
        // Define the delegate
        const delegate = async ({
            messages,
            response_format,
            reasoning_effort,
            max_completion_tokens,
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            stream,
            acceleration
        }: Omit<ChatCompletionCreateParams, "model">): Promise<ChatCompletion | AsyncGenerator<ChatCompletionChunk>> => {
            // Build prediction input map
            const predictionInputs: Record<string, Value> = {
                [inputParam.name]: messages
            };
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
            if (frequency_penalty != null && frequencyPenaltyParam)
                predictionInputs[frequencyPenaltyParam.name] = frequency_penalty;
            if (presence_penalty != null && presencePenaltyParam)
                predictionInputs[presencePenaltyParam.name] = presence_penalty;
            // Predict
            const predictionStream = this.streamPrediction({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            const completionStream = gatherCompletionOutputs(predictionStream, completionParamIdx);
            // Return
            if (stream)
                return map(parseChatCompletionChunk, completionStream);
            else
                return parseChatCompletion(await collect(completionStream));
        };
        // Return
        return delegate;
    }

    private streamPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): AsyncGenerator<Prediction> {
        if ((input.acceleration as string)?.startsWith("remote_"))
            return this.remotePredictions.stream(input as CreateRemotePredictionInput);
        else
            return this.predictions.stream(input as CreatePredictionInput);
    }
}

async function* gatherCompletionOutputs(
    stream: AsyncGenerator<Prediction>,
    completionParamIdx: number
): AsyncGenerator<Record<string, object>> {
    for await (const prediction of stream) {
        if (prediction.error)
            throw new Error(prediction.error);
        yield prediction.results[completionParamIdx] as Record<string, object>;
    }
}

function parseChatCompletion(outputs: Record<string, object>[]): ChatCompletion {
    if (outputs.length === 0)
        throw new Error("Failed to parse chat completion because model did not return any outputs");
    const completionsResult = ChatCompletionSchema.array().safeParse(outputs);
    if (completionsResult.success)
        return completionsResult.data[completionsResult.data.length - 1] as ChatCompletion;
    const chunksResult = ChatCompletionChunkSchema.array().safeParse(outputs);
    if (!chunksResult.success)
        throw new Error(`Failed to parse chat completion from model outputs: ${JSON.stringify(outputs)}`);
    const chunks = chunksResult.data as ChatCompletionChunk[];
    const choicesMap = new Map<number, ChatCompletionChunk.Choice[]>();
    for (const chunk of chunks)
        for (const choice of chunk.choices) {
            if (!choicesMap.has(choice.index))
                choicesMap.set(choice.index, []);
            choicesMap.get(choice.index)!.push(choice);
        }
    const choices: ChatCompletion.Choice[] = [];
    for (const [index, streamChoices] of choicesMap.entries())
        choices.push(createChatCompletionChoice(index, streamChoices));
    const chunkUsages = chunks
        .map(chunk => chunk.usage)
        .filter((usage): usage is ChatCompletion.Usage => usage != null);
    const usage: ChatCompletion.Usage = {
        prompt_tokens: chunkUsages.reduce((sum, u) => sum + u.prompt_tokens, 0),
        completion_tokens: chunkUsages.reduce((sum, u) => sum + u.completion_tokens, 0),
        total_tokens: chunkUsages.reduce((sum, u) => sum + u.total_tokens, 0)
    };
    const completion: ChatCompletion = {
        object: "chat.completion",
        id: chunks[0].id,
        model: chunks[0].model,
        created: chunks[0].created,
        choices,
        usage
    };
    return completion;
}

function parseChatCompletionChunk(data: Record<string, object>): ChatCompletionChunk {
    const chunkResult = ChatCompletionChunkSchema.safeParse(data);
    if (chunkResult.success)
        return chunkResult.data as ChatCompletionChunk;
    const completionResult = ChatCompletionSchema.safeParse(data);
    if (!completionResult.success)
        throw new Error(`Failed to parse streaming chat completion chunk from model output: ${JSON.stringify(data)}`);
    const completion = completionResult.data as ChatCompletion;
    const chunk: ChatCompletionChunk = {
        object: "chat.completion.chunk",
        id: completion.id,
        model: completion.model,
        created: completion.created,
        choices: completion.choices.map((choice): ChatCompletionChunk.Choice => ({
            index: choice.index,
            delta: {
                role: choice.message.role,
                content: choice.message.content
            },
            finish_reason: choice.finish_reason,
            logprobs: null
        })),
        usage: completion.usage
    };
    return chunk;
}

function createChatCompletionChoice(
    index: number,
    choices: ChatCompletionChunk.Choice[]
): ChatCompletion.Choice {
    const role = choices[0].delta.role;
    const content = choices
        .filter(choice => choice.delta)
        .map(choice => choice.delta.content ?? "")
        .join("");
    const finish_reason = choices
        .map(choice => choice.finish_reason)
        .find(r => r != null) ?? "stop";
    const message: ChatCompletionMessage = { role, content };
    return {
        index,
        message,
        finish_reason,
        logprobs: null
    };
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