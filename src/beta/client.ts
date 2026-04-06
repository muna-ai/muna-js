/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { PredictionService, PredictorService } from "../services"
import { OpenAIClient } from "./openai"

/**
 * Client for incubating features.
 */
export class BetaClient {

    /**
     * OpenAI client.
     */
    public readonly openai: OpenAIClient;

    public constructor(
        client: MunaClient,
        predictors: PredictorService,
        predictions: PredictionService
    ) {
        this.openai = new OpenAIClient(predictors, predictions);
    }
}