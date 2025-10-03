/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { CreatePredictionInput, PredictionService, PredictorService } from "../../services"
import type { Acceleration, Prediction } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import type { ChatCompletion, ChatCompletionChunk, ChatCompletionMessage } from "./types"

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
     * Maximum output tokens.
     */
    max_tokens?: number | null;
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

export class ChatCompletionService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
    }

    /**
     * Create a chat completion.
     */
    public create(body: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
    public create(body: ChatCompletionCreateParamsStreaming): AsyncGenerator<ChatCompletionChunk>;
    public create(body: ChatCompletionCreateParamsBase): Promise<ChatCompletion> | AsyncGenerator<ChatCompletionChunk>;
    public create(body: ChatCompletionCreateParams): Promise<ChatCompletion> | AsyncGenerator<ChatCompletionChunk> {
        const { model: tag, acceleration = "auto", ...inputs } = body;
        inputs.stream = inputs.stream ?? false;
        const input = { tag, inputs, acceleration };
        if (inputs.stream)
            return this.createCompletionStreaming(input);
        else
            return this.createCompletionNonStreaming(input);
    }

    private async createCompletionNonStreaming(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<ChatCompletion> {
        const prediction = await this.createPrediction(input);
        const completion = this.parseResponse(prediction) as ChatCompletion;
        return completion;
    }

    private async * createCompletionStreaming(input: CreatePredictionInput | CreateRemotePredictionInput): AsyncGenerator<ChatCompletionChunk> {
        const stream = await this.streamPrediction(input);
        for await (const prediction of stream) {
            const completion = this.parseResponse(prediction) as ChatCompletionChunk;
            yield completion;
        }
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        // muna.beta.predictions.remote.create(...)
        if ((input.acceleration as string).startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        // muna.predictions.create(...)
        else
            return this.predictions.create(input as CreatePredictionInput);
    }

    private streamPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): AsyncGenerator<Prediction> {
        if ((input.acceleration as string).startsWith("remote_"))
            throw new Error("Streaming predictions are not supported with remote acceleration");
        // muna.predictions.stream(...)
        return this.predictions.stream(input as CreatePredictionInput);
    }

    private parseResponse(prediction: Prediction): ChatCompletion | ChatCompletionChunk {
        if (prediction.error)
            throw new Error(prediction.error);
        return prediction.results[0] as ChatCompletion | ChatCompletionChunk;
    }
}