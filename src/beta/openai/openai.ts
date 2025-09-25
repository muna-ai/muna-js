/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictionService } from "../../services"
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
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.chat = new ChatService(predictions, remotePredictions);
        this.embeddings = new EmbeddingsService(predictions, remotePredictions);
    }
}