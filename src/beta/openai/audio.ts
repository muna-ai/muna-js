/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { SpeechService } from "./speech"

export class AudioService {

    /**
     * Create speech.
     */
    public readonly speech: SpeechService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.speech = new SpeechService(predictors, predictions, remotePredictions);
    }
}