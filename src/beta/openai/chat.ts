/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictionService, PredictorService } from "../../services"
import { ChatCompletionService } from "./completions"

export class ChatService {

    /**
     * Create completions.
     */
    public readonly completions: ChatCompletionService;

    public constructor(predictors: PredictorService, predictions: PredictionService) {
        this.completions = new ChatCompletionService(predictors, predictions);
    }
}