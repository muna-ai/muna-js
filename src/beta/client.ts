/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { PredictionService, PredictorService } from "../services"
import { OpenAIClient } from "./openai"
import { PredictionService as BetaPredictionService } from "./remote"

/**
 * Client for incubating features.
 */
export class BetaClient {

    /**
     * Make predictions.
     */
    public readonly predictions: BetaPredictionService;

    /**
     * OpenAI client.
     */
    public readonly openai: OpenAIClient;

    public constructor(
        client: MunaClient,
        predictors: PredictorService,
        predictions: PredictionService
    ) {
        this.predictions = new BetaPredictionService(client);
        this.openai = new OpenAIClient(predictors, predictions, this.predictions.remote);
    }
}