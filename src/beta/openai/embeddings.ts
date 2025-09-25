/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { CreatePredictionInput, PredictionService } from "../../services"
import type { Acceleration, Prediction } from "../../types"
import type { CreateRemotePredictionInput, RemoteAcceleration, RemotePredictionService } from "../remote"

export interface EmbeddingsCreateParams {
    /**
     * Input text to embed, encoded as a string or array of strings.
     */
    input: string | string[];
    /**
     * Embedding model predictor tag.
     */
    model: string;
    /**
     * The number of dimensions the resulting output embeddings should have.
     * Only supported in Matryoshka embedding models.
     */
    dimensions?: number;
    /**
     * The format to return the embeddings in.
     */
    encoding_format?: "float" | "base64";
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration | RemoteAcceleration;
}

export class EmbeddingsService {

    private readonly predictions: PredictionService;
    private readonly remotePredictions: RemotePredictionService;

    public constructor(predictions: PredictionService, remotePredictions: RemotePredictionService) {
        this.predictions = predictions;
        this.remotePredictions = remotePredictions;
    }

    private createPrediction(input: CreatePredictionInput | CreateRemotePredictionInput): Promise<Prediction> {
        // muna.beta.predictions.remote.create(...)
        if ((input.acceleration as string).startsWith("remote_"))
            return this.remotePredictions.create(input as CreateRemotePredictionInput);
        // muna.predictions.create(...)
        else
            return this.predictions.create(input as CreatePredictionInput);
    }
}