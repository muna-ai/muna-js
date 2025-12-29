/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { SpeechService } from "./speech"
import { TranscriptionService } from "./transcription"

export class AudioService {

    /**
     * Create speech.
     */
    public readonly speech: SpeechService;

    /**
     * Transcribe audio.
     */
    private readonly transcriptions: TranscriptionService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.speech = new SpeechService(predictors, predictions, remotePredictions);
        this.transcriptions = new TranscriptionService(predictors, predictions, remotePredictions);
    }
}