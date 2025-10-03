/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { ChatCompletionService } from "./completion"

export class ChatService {

    /**
     * Create completions.
     */
    public readonly completions: ChatCompletionService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.completions = new ChatCompletionService(predictors, predictions, remotePredictions);
    }
}