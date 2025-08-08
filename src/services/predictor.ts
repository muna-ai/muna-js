/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaAPIError, MunaClient } from "../client"
import type { Predictor } from "../types"

export interface RetrievePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export class PredictorService {

    private readonly client: MunaClient;

    public constructor(client: MunaClient) {
        this.client = client;
    }

    /**
     * Retrieve a predictor.
     * @param input Input arguments.
     * @returns Predictor.
     */
    public async retrieve({ tag }: RetrievePredictorInput): Promise<Predictor | null> {
        try {
            const predictor = await this.client.request<Predictor>({ path: `/predictors/${tag}` });
            return predictor;
        } catch (error: unknown) {
            if ((error as MunaAPIError).status === 404)
                return null;
            throw error;
        }
    }
}