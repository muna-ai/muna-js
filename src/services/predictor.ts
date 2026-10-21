/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { MunaAPIError, type MunaClient } from "../client"
import type { Predictor } from "../types"
import { loadHfManifest, parseHfTag } from "./hf"

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
        const hfTag = parseHfTag(tag);
        if (hfTag) {
            const manifest = await loadHfManifest(hfTag);
            const [username, name] = manifest.tag.replace(/^@/, "").split("/");
            if (!username || !name)
                throw new Error(`Failed to retrieve ${tag} because its manifest has an invalid tag: ${manifest.tag}`);
            return {
                tag: manifest.tag,
                owner: { username, created: manifest.created },
                name,
                description: "",
                status: "active",
                access: "unlisted",
                signature: manifest.signature,
                created: manifest.created
            };
        }
        try {
            const predictor = await this.client.request<Predictor>({ path: `/predictors/${tag}` });
            return predictor;
        } catch (error: unknown) {
            if (error instanceof MunaAPIError && error.status === 404)
                return null;
            throw error;
        }
    }
}
