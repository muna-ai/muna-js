/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { ChatCompletionsService } from "./completions"

export class ChatService {

    /**
     * Create completions.
     */
    public readonly completions: ChatCompletionsService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.completions = new ChatCompletionsService(predictors, predictions, remotePredictions);
    }
}