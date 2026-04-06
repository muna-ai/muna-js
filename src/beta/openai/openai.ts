/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictorService, PredictionService } from "../../services"
import { AudioService } from "./audio"
import { ChatService } from "./chat"
import { EmbeddingService } from "./embeddings"
import { ImageService } from "./images"

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

    /**
     * Create images.
     */
    public readonly images: ImageService;

    public constructor(predictors: PredictorService, predictions: PredictionService) {
        this.chat = new ChatService(predictors, predictions);
        this.embeddings = new EmbeddingService(predictors, predictions);
        this.audio = new AudioService(predictors, predictions);
        this.images = new ImageService(predictors, predictions);
    }
}