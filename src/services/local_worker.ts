/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxncInput } from "../c/loader"
import type { MunaClient } from "../client"
import type { Prediction } from "../types"
import type { CreatePredictionInput, DeletePredictionInput } from "./prediction"
import { WorkerProxy } from "./worker-proxy"

export class LocalWorkerPredictionService {

    private proxy: WorkerProxy;
    private ready: Promise<void>;

    public constructor(client: MunaClient) {
        // @ts-ignore: `import.meta.url` is resolved by the consuming bundler (webpack/turbopack)
        const worker = new Worker(new URL("./local.worker.js", import.meta.url));
        this.proxy = new WorkerProxy(worker);
        this.ready = this.proxy.call("init", {
            accessKey: client.accessKey,
            url: client.url,
            fxnc: getFxncInput(),
        });
    }

    /**
     * Create a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create(input: CreatePredictionInput): Promise<Prediction> {
        await this.ready;
        return this.proxy.call("create", input);
    }

    /**
     * Create a streaming prediction.
     * @param input Prediction input.
     * @returns Prediction stream.
     */
    public async * stream(input: CreatePredictionInput): AsyncGenerator<Prediction> {
        await this.ready;
        yield* this.proxy.callStream("stream", input);
    }

    /**
     * Delete a predictor that is loaded in memory.
     * @param input Input arguments.
     * @returns Whether the predictor was successfully deleted from memory.
     */
    public async delete(input: DeletePredictionInput): Promise<boolean> {
        await this.ready;
        return this.proxy.call("delete", input);
    }
}
