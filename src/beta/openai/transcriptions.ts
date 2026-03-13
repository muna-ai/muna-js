/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxnc } from "../../c"
import type { CreatePredictionInput, PredictorService, PredictionService } from "../../services"
import { isTensor } from "../../types"
import type { Acceleration, Prediction, Tensor, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import { type Audio, isAudio } from "../types"
import type { Transcription } from "./types"

export interface TranscriptionCreateParams {
    /**
     * Audio file to transcribe.
     * Pass encoded audio (`Blob`, `ArrayBuffer`, or `Uint8Array`) in `flac`, `mp3`, `m4a`, `ogg`, or `wav` format,
     * or an `Audio` buffer with LPCM samples.
     */
    file: Blob | ArrayBuffer | Uint8Array | Audio;
    /**
     * Audio transcription model tag.
     */
    model: string;
    /**
     * The language of the input audio.
     */
    language?: string;
    /**
     * Text to guide the model's style or continue a previous audio segment.
     */
    prompt?: string;
    /**
     * The sampling temperature, between 0 and 1.
     */
    temperature?: number;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

type TranscriptionDelegate = (params: Omit<TranscriptionCreateParams, "model">) => Promise<Transcription>;

export class TranscriptionService {

    private readonly predictors: PredictorService;
    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;
    private readonly cache: Map<string, TranscriptionDelegate>;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.predictors = predictors;
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
        this.cache = new Map<string, TranscriptionDelegate>();
    }

    /**
     * Transcribe audio into the input language.
     */
    public async create({
        model: tag,
        file,
        language,
        prompt,
        temperature = 0,
        acceleration = "local_auto"
    }: TranscriptionCreateParams): Promise<Transcription> {
        if (!this.cache.has(tag)) {
            const delegate = await this.createDelegate(tag);
            this.cache.set(tag, delegate);
        }
        const delegate = this.cache.get(tag);
        const result = await delegate({
            file,
            language,
            prompt,
            temperature,
            acceleration
        });
        return result;
    }

    private async createDelegate(tag: string): Promise<TranscriptionDelegate> {
        const predictor = await this.predictors.retrieve({ tag });
        if (!predictor)
            throw new Error(
                `${tag} cannot be used with OpenAI transcription API because ` +
                `the predictor could not be found. Check that your access key ` +
                `is valid and that you have access to the predictor.`
            );
        const signature = predictor.signature;
        const requiredInputs = signature.inputs.filter(param => !param.optional);
        if (requiredInputs.length !== 1)
            throw new Error(
                `${tag} cannot be used with OpenAI transcription API because ` +
                `it has more than one required input parameter.`
            );
        const audioParam = requiredInputs.find(param =>
            param.dtype === "float32" &&
            param.denotation === "audio"
        );
        if (!audioParam)
            throw new Error(
                `${tag} cannot be used with OpenAI transcription API because ` +
                `it does not have a valid audio input parameter.`
            );
        const languageParam = signature.inputs.find(param =>
            param.dtype === "string" &&
            param.denotation === "openai.audio.transcriptions.language"
        );
        const promptParam = signature.inputs.find(param =>
            param.dtype === "string" &&
            param.denotation === "openai.audio.transcriptions.prompt"
        );
        const temperatureParam = signature.inputs.find(param =>
            ["float32", "float64"].includes(param.dtype) &&
            param.denotation === "openai.chat.completions.temperature"
        );
        const transcriptionParamIdx = signature.outputs.findIndex(param =>
            param.dtype === "string"
        );
        if (transcriptionParamIdx < 0)
            throw new Error(
                `${tag} cannot be used with OpenAI transcription API because ` +
                `it has no output string parameter.`
            );
        const delegate = async ({
            file,
            language,
            prompt,
            temperature,
            acceleration
        }: Omit<TranscriptionCreateParams, "model">): Promise<Transcription> => {
            const samples = await this.readAudioSamples(file, audioParam.sampleRate);
            const predictionInputs: Record<string, Value> = {
                [audioParam.name]: samples
            };
            if (language != null && languageParam)
                predictionInputs[languageParam.name] = language;
            if (prompt != null && promptParam)
                predictionInputs[promptParam.name] = prompt;
            if (temperature != null && temperatureParam)
                predictionInputs[temperatureParam.name] = temperature;
            const prediction = await this.createPrediction({
                tag,
                inputs: predictionInputs,
                acceleration
            });
            if (prediction.error)
                throw new Error(prediction.error);
            const text = prediction.results[transcriptionParamIdx];
            if (typeof text !== "string")
                throw new Error(`${tag} returned object of type ${typeof text} instead of a string`);
            const duration = samples.data.length / audioParam.sampleRate;
            const result: Transcription = {
                text,
                usage: {
                    type: "duration",
                    seconds: duration
                }
            };
            return result;
        };
        return delegate;
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        if ((input.acceleration as string)?.startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        else
            return this.predictions.create(input as CreatePredictionInput);
    }

    private async readAudioSamples(
        file: Blob | ArrayBuffer | Uint8Array | Audio,
        sampleRate: number
    ): Promise<Tensor> {
        if (isAudio(file)) {
            if (file.sampleRate !== sampleRate)
                throw new Error(
                    `Audio sample rate ${file.sampleRate}Hz does not match ` +
                    `the required sample rate of ${sampleRate}Hz.`
                );
            const frames = file.samples.length / file.channelCount;
            const shape = file.channelCount > 1 ? [frames, file.channelCount] : [frames];
            return { data: file.samples, shape };
        }
        const { FXNValue } = await getFxnc();
        const buffer =
            !(file instanceof ArrayBuffer) ?
            file instanceof Uint8Array ?
            file.buffer as ArrayBuffer :
            await file.arrayBuffer() :
            file;
        const audioValue = FXNValue.createFromBuffer(buffer, `audio/*;rate=${sampleRate}`);
        const samples = audioValue.toObject();
        audioValue.dispose();
        if (!isTensor(samples))
            throw new Error("Failed to decode audio file into tensor samples");
        return samples;
    }
}