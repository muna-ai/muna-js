/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxnc } from "../../c"
import type { CreatePredictionInput, PredictorService, PredictionService } from "../../services"
import { isTensor, type Tensor } from "../../types"
import type { Acceleration, Prediction, Value } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"
import type { Transcription } from "./types"

export interface TranscriptionCreateParams {
    /**
     * Audio file to transcribe.
     * This MUST be in one of the following formats: `flac`, `mp3`, `m4a`, `ogg`, `wav`.
     */
    file: Blob;
    /**
     * Audio transcription predictor tag.
     */
    model: string;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

type TranscriptionDelegate = (params: Omit<TranscriptionCreateParams, "model">) => Promise<Response>;

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
}