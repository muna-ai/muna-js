/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { RemotePredictionService } from "./remote"
import type { MunaClient } from "../../client"

export class PredictionService {

    /**
     * Make remote predictions.
     */
    public readonly remote: RemotePredictionService;

    public constructor(client: MunaClient) {
        this.remote = new RemotePredictionService(client);
    }
}