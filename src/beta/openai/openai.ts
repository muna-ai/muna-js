/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictorService, PredictionService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { ChatService } from "./chat"
import { EmbeddingsService } from "./embeddings"

export class OpenAIClient {

    /**
     * Make chat conversations.
     */
    public readonly chat: ChatService;

    /**
     * Create embedding vectors.
     */
    public readonly embeddings: EmbeddingsService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.chat = new ChatService(predictors, predictions, remotePredictions);
        this.embeddings = new EmbeddingsService(predictors, predictions, remotePredictions);
    }
}