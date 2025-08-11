/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { PredictionService as EdgePredictionService } from "../services"
import { ChatService } from "./chat"
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
     * Make chat conversations.
     */
    public readonly chat: ChatService;

    public constructor(client: MunaClient, predictions: EdgePredictionService) {
        this.predictions = new PredictionService(client);
        this.chat = new ChatService(predictions, this.predictions.remote);
    }
}