/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../../client"
import { RemotePredictionService } from "./remote"

export class PredictionService {

    /**
     * Make remote predictions.
     */
    public readonly remote: RemotePredictionService;

    public constructor(client: MunaClient) {
        this.remote = new RemotePredictionService(client);
    }
}