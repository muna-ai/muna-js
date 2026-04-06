/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { Acceleration, Prediction, Value } from "../types"
import { LocalPredictionService } from "./local"
import { LocalWorkerPredictionService } from "./local_worker"
import { RemotePredictionService } from "./remote"

export interface CreatePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Input values.
     */
    inputs?: Record<string, Value>;
    /**
     * Prediction acceleration.
     */
    acceleration?: Acceleration;
    /**
     * Muna client identifier.
     * Specify this to override the current client identifier.
     */
    clientId?: string;
    /**
     * Configuration identifier.
     * Specify this to override the current client configuration identifier.
     */
    configurationId?: string;
}

export interface DeletePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export class PredictionService {

    private readonly local: LocalPredictionService | LocalWorkerPredictionService;
    private readonly remote: RemotePredictionService;

    public constructor(client: MunaClient) {
        this.local = typeof (globalThis as any).document !== "undefined"
            ? new LocalWorkerPredictionService(client)
            : new LocalPredictionService(client);
        this.remote = new RemotePredictionService(client);
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create(input: CreatePredictionInput): Promise<Prediction> {
        const { inputs, acceleration = "local_auto" } = input;
        if (!inputs || acceleration.startsWith("local_"))
            return this.local.create(input);
        else
            return this.remote.create(input);
    }

    /**
     * Create a streaming prediction.
     * @param input Prediction input.
     * @returns Prediction stream.
     */
    public async * stream(input: CreatePredictionInput): AsyncGenerator<Prediction> {
        const { acceleration = "local_auto" } = input;
        if (acceleration.startsWith("local_"))
            return this.local.create(input);
        else
            return this.remote.create(input);
    }

    /**
     * Delete a predictor that is loaded in memory.
     * @param input Input arguments.
     * @returns Whether the predictor was successfully deleted from memory.
     */
    public async delete(input: DeletePredictionInput): Promise<boolean> {
        return this.local.delete(input);
    }
}