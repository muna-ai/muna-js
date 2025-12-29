/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxnc } from "../../c"
import type { CreatePredictionInput, PredictorService, PredictionService } from "../../services"
import { isTensor, type Tensor } from "../../types"
import type { Acceleration, Prediction, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"

export type SpeechResponseFormat = "aac" | "flac" | "mp3" | "opus" | "pcm" | "wav";
export type SpeechStreamFormat = "audio" | "sse";

export interface SpeechCreateParams {
    /**
     * The text to generate audio for.
     */
    input: string;
    /**
     * Speech generation predictor tag.
     */
    model: string;
    /**
     * The voice to use when generating the audio.
     */
    voice: string;
    /**
     * The format to return audio in.
     */
    response_format?: SpeechResponseFormat;
    /**
     * The speed of the generated audio.
     * Defaults to 1.0. 
     */
    speed?: number;
    /**
     * The format to stream the audio in.
     */
    stream_format?: SpeechStreamFormat;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

type SpeechDelegate = (params: Omit<SpeechCreateParams, "model">) => Promise<Response>;

export class SpeechService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;
    private readonly cache: Map<string, SpeechDelegate>;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
        this.cache = new Map<string, SpeechDelegate>();
    }

    public async create({
        model: tag,
        input,
        voice,
        response_format = "mp3",
        speed = 1.0,
        stream_format = "audio",
        acceleration = "remote_auto"
    }: SpeechCreateParams): Promise<Response> {
        // Ensure we have a delegate
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        // Make prediction
        const delegate = this.cache.get(tag);
        const response = await delegate({
            input,
            voice,
            response_format,
            speed,
            stream_format,
            acceleration
        });
        // Return
        return response;
    }

    private async createDelegate(tag: string): Promise<SpeechDelegate> {
        // Retrieve predictor
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI speech API because 
                the predictor could not be found. Check that your access key 
                is valid and that you have access to the predictor.`
            );
        // Get required inputs
        const signature = predictor.signature;
        const requiredInputParams = signature.inputs.filter(param => !param.optional);
        if (requiredInputParams.length !== 2)
            throw new Error(
                `${tag} cannot be used with OpenAI speech API because 
                it does not have exactly two required input parameters.`
            );
        // Get the text input parameter
        const inputParam = requiredInputParams.find(param => param.type === "string");
        if (!inputParam)
            throw new Error(
                `${tag} cannot be used with OpenAI speech API because 
                it does not have the required speech input parameter.`
            );
        // Get the voice input parameter
        const voiceParam = requiredInputParams.find(param =>
            param.type === "string" &&
            param.denotation === "openai.audio.speech.voice"
        );
        if (!voiceParam)
            throw new Error(
                `${tag} cannot be used with OpenAI speech API because 
                it does not have the required speech voice parameter.`
            );
        // Get the speed input parameter (optional)
        const speedParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.type) &&
            param.denotation === "openai.audio.speech.speed"
        );
        // Get the index of the audio output parameter
        const audioParamIdx = signature.outputs.findIndex(param =>
            param.type === "float32" &&
            param.denotation === "audio"
        );
        if (audioParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI speech API because 
                it has no outputs with an \`audio\` denotation.`
            );
        const audioParam = signature.outputs[audioParamIdx];
        // Define the delegate
        const delegate = async ({
            input,
            voice,
            speed,
            acceleration,
            response_format,
            stream_format
        }: Omit<SpeechCreateParams, "model">): Promise<Response> => {
            // Check response format
            if (response_format === "mp3")
                throw new Error(
                    `Cannot create speech with response format \`${response_format}\` 
                    because it is not yet supported.`
                );
            // Check stream format
            if (stream_format !== "audio")
                throw new Error(
                    `Cannot create speech with stream format \`${stream_format}\` 
                    because only \`audio\` is currently supported.`
                );
            // Build prediction input map
            const predictionInputs: Record<string, Value> = {
                [inputParam.name]: input,
                [voiceParam.name]: voice
            };
            if (speed != null && speedParam)
                predictionInputs[speedParam.name] = speed;
            // Create prediction
            const prediction = await this.createPrediction({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            // Check for error
            if (prediction.error)
                throw new Error(prediction.error);
            // Check returned audio
            const audio = prediction.results[audioParamIdx];
            if (!isTensor(audio))
                throw new Error(`${tag} returned object of type ${typeof audio} instead of an audio tensor`);
            if (!(audio.data instanceof Float32Array))
                throw new Error(
                    `${tag} returned audio tensor with invalid data type: 
                    ${audio.constructor.name.replace("Array", "").toLowerCase()}`
                );
            if (![1, 2].includes(audio.shape.length))
                throw new Error(`${tag} returned audio tensor with invalid shape: ${audio.shape}`);
            // Create response
            const { content, contentType } = await this.createResponseData({
                audio,
                sampleRate: audioParam.sampleRate,
                responseFormat: response_format
            });
            const response = new Response(content, {
                status: 200,
                statusText: "OK",
                headers: {
                    "Content-Type": contentType,
                    "Content-Length": `${content.byteLength}`
                }
            });
            // Return
            return response;
        };
        // Return
        return delegate;
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        if ((input.acceleration as string).startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        else
            return this.predictions.create(input as CreatePredictionInput);
    }

    private async createResponseData({
        audio,
        sampleRate,
        responseFormat
    }: { audio: Tensor, sampleRate: number, responseFormat: SpeechResponseFormat }) {
        const channels = audio.shape.length == 2 ? audio.shape[1] : 1;
        if (responseFormat === "pcm") {
            const contentType = [
                `audio/pcm`,
                `rate=${sampleRate}`,
                `channels=${channels}`,
                `encoding=float`,
                `bits=32`
            ].join(";");
            const content = audio.data.buffer as ArrayBuffer;
            return { content, contentType };
        }
        const { FXNValue } = await getFxnc();
        const audioValue = FXNValue.createArray(audio.data, audio.shape, 0);
        const contentType = `audio/${responseFormat};rate=${sampleRate}`;
        const content = audioValue.serialize(contentType);
        audioValue.dispose();
        return { content, contentType };
    }
}