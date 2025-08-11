/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { BetaClient } from "./beta/client"
import { MunaClient } from "./client"
import { PredictionService, PredictorService, UserService } from "./services"

export interface MunaConfig {
    /**
     * Muna access key.
     */
    accessKey?: string;
    /**
     * Muna API URL.
     */
    url?: string;
}

/**
 * Muna client.
 */
export class Muna {

    /**
     * Muna API client.
     * Do NOT use this unless you know what you are doing.
     */
    public readonly client: MunaClient;

    /**
     * Manage users.
     */
    public readonly users: UserService;

    /**
     * Manage predictors.
     */
    public readonly predictors: PredictorService;

    /**
     * Make predictions.
     */
    public readonly predictions: PredictionService;

    /**
     * Beta client for incubating features.
     */
    public readonly beta: BetaClient;

    /**
     * Create a Muna client.
     * @param config Muna client configuration.
     */
    public constructor(config?: MunaConfig) {
        this.client = new MunaClient(config ?? { });
        this.users = new UserService(this.client);
        this.predictors = new PredictorService(this.client);
        this.predictions = new PredictionService(this.client);
        this.beta = new BetaClient(this.client, this.predictions);
    }
}