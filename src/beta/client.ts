/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import { PredictionService } from "./remote"

/**
 * Client for incubating features.
 */
export class BetaClient {

    /**
     * Make predictions.
     */
    public readonly predictions: PredictionService;

    public constructor(client: MunaClient) {
        this.predictions = new PredictionService(client);
    }
}