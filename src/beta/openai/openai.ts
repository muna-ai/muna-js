/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictorService, PredictionService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { AudioService } from "./audio"
import { ChatService } from "./chat"
import { EmbeddingService } from "./embeddings"

export class OpenAIClient {

    /**
     * Create chat conversations.
     */
    public readonly chat: ChatService;

    /**
     * Create embedding vectors.
     */
    public readonly embeddings: EmbeddingService;

    /**
     * Create speech.
     */
    public readonly audio: AudioService;

    public constructor(
        predictors: PredictorService,
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.chat = new ChatService(predictors, predictions, remotePredictions);
        this.embeddings = new EmbeddingService(predictors, predictions, remotePredictions);
        this.audio = new AudioService(predictors, predictions, remotePredictions);
    }
}