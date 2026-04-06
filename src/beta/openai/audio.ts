/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import { SpeechService } from "./speech"
import { TranscriptionService } from "./transcriptions"

export class AudioService {

    /**
     * Create speech.
     */
    public readonly speech: SpeechService;

    /**
     * Transcribe audio.
     */
    public readonly transcriptions: TranscriptionService;

    public constructor(predictors: PredictorService, predictions: PredictionService) {
        this.speech = new SpeechService(predictors, predictions);
        this.transcriptions = new TranscriptionService(predictors, predictions);
    }
}