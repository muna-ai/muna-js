/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { PredictionService as EdgePredictionService } from "../services"
import { OpenAIClient } from "./openai"
import { PredictionService } from "./remote"

/**
 * Client for incubating features.
 */
export class BetaClient {

    /**
     * Make predictions.
     */
    public readonly predictions: PredictionService;

    /**
     * OpenAI client.
     */
    public readonly openai: OpenAIClient;

    public constructor(client: MunaClient, predictions: EdgePredictionService) {
        this.predictions = new PredictionService(client);
        this.openai = new OpenAIClient(predictions, this.predictions.remote);
    }
}