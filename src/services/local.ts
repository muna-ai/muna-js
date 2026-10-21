/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxnc, type FXNC } from "../c"
import type { MunaClient } from "../client"
import { BoolArray, isImage, isTensor } from "../types"
import type { Acceleration, Image, Prediction, Tensor, TypedArray, Value } from "../types"
import { hfFileUrl, loadHfManifest, parseHfTag, type HfTag } from "./hf"
import type { CreatePredictionInput, DeletePredictionInput } from "./prediction"
import {
    createPredictionCacheKey,
    parseJwtPayload,
    PredictionCache,
    type PredictionCacheKey,
    type PredictionCacheStorage,
    type PredictionResolution
} from "./prediction-cache"
import { RemotePredictionService } from "./remote"

interface PredictorCacheEntry {
    tag: string;
    predictor: FXNPredictor;
    refreshAt: number | null;
}

interface PreloadEntry {
    tag: string;
    acceleration: Acceleration;
    metadata: string;
}

export class LocalPredictionService {

    private readonly client: MunaClient;
    private readonly cache: Map<string, PredictorCacheEntry>;
    private readonly locks: Map<string, Promise<void>>;
    private readonly predictionCache: PredictionCache;
    private readonly remote: RemotePredictionService;
    private readonly loadFxnc: typeof getFxnc;

    public constructor(
        client: MunaClient,
        cacheStorage: PredictionCacheStorage,
        loadFxnc: typeof getFxnc = getFxnc
    ) {
        this.client = client;
        this.cache = new Map<string, PredictorCacheEntry>();
        this.locks = new Map<string, Promise<void>>();
        this.predictionCache = new PredictionCache(cacheStorage);
        this.remote = new RemotePredictionService(client);
        this.loadFxnc = loadFxnc;
    }

    /**
     * Create a prediction.
     * When `inputs` is empty, the predictor resources are downloaded without
     * loading the predictor or running a prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create(input: CreatePredictionInput): Promise<Prediction> {
        const { tag, inputs } = input;
        if (!inputs)
            return this.createRawPrediction(input);
        if (Object.keys(inputs).length === 0)
            return this.createDownloadPrediction(input);
        const predictor = await this.getPredictor(input);
        let inputMap: FXNValueMap;
        let prediction: FXNPrediction;
        try {
            inputMap = await toValueMap(inputs);
            prediction = predictor.createPrediction(inputMap);
            return toPrediction(tag, prediction);
        } finally {
            prediction?.dispose();
            inputMap?.dispose();
        }
    }

    /**
     * Create a streaming prediction.
     * NOTE: This feature is currently experimental.
     * @param input Prediction input.
     * @returns Generator which asynchronously returns prediction results as they are streamed from the predictor.
     */
    public async * stream(input: CreatePredictionInput): AsyncGenerator<Prediction> {
        const { tag, inputs } = input;
        assert(!!inputs, `Failed to stream ${tag} prediction because prediction inputs were not provided`);
        const predictor = await this.getPredictor(input);
        let inputMap: FXNValueMap;
        let stream: FXNPredictionStream;
        try {
            inputMap = await toValueMap(inputs);
            stream = predictor.streamPrediction(inputMap);
            while (true) {
                const prediction = stream.readNext();
                if (!prediction)
                    break;
                yield toPrediction(tag, prediction);
                prediction.dispose();
            }
        } finally {
            stream?.dispose();
            inputMap?.dispose();
        }
    }

    /**
     * Delete a predictor that is loaded in memory.
     * @param input Input arguments.
     * @returns Whether the predictor was successfully deleted from memory.
     */
    public async delete(input: DeletePredictionInput): Promise<boolean> {
        const { tag } = input;
        let deleted = false;
        for (const [key, entry] of this.cache)
            if (entry.tag === tag) {
                this.cache.delete(key);
                entry.predictor.dispose();
                deleted = true;
            }
        return deleted;
    }

    private async createRawPrediction(input: CreatePredictionInput): Promise<Prediction> {
        const fxnc = await this.loadFxnc();
        return this.requestRawPrediction(this.resolveCacheInput(input, fxnc));
    }

    private async requestRawPrediction(
        { tag, clientId, configurationId }: PredictionCacheKey,
        predictionId?: string
    ): Promise<Prediction> {
        return this.client.request<Prediction>({
            path: "/predictions",
            method: "POST",
            body: { tag, clientId, configurationId, predictionId }
        });
    }

    private async createDownloadPrediction(input: CreatePredictionInput): Promise<Prediction> {
        const { tag } = input;
        const fxnc = await this.loadFxnc();
        assert(fxnc, `Failed to download ${tag} because Muna implementation has not been loaded`);
        const hfTag = parseHfTag(tag);
        const prediction = hfTag ?
            await createHfPrediction(hfTag) :
            (await this.resolvePrediction(this.resolveCacheInput(input, fxnc))).prediction;
        // Adding a resource to a configuration downloads it into the native
        // resource cache, which is what the predictor loads from later.
        let configuration: FXNConfiguration;
        try {
            configuration = fxnc.FXNConfiguration.create();
            for (const resource of prediction.resources ?? [])
                await configuration.addResource(resource);
        } finally {
            configuration?.dispose();
        }
        return prediction;
    }

    private async getPredictor(input: CreatePredictionInput): Promise<FXNPredictor> {
        const { tag } = input;
        const fxnc = await this.loadFxnc();
        assert(fxnc, `Failed to create ${tag} prediction because Muna implementation has not been loaded`);
        const cacheInput = this.resolveCacheInput(input, fxnc);
        const cacheKey = createPredictionCacheKey(cacheInput);
        const loaded = this.cache.get(cacheKey);
        if (loaded) {
            await this.refreshLoadedPrediction(cacheInput, loaded);
            return loaded.predictor;
        }
        return this.withLock(cacheKey, async () => {
            const loaded = this.cache.get(cacheKey);
            if (loaded)
                return loaded.predictor;
            const hfTag = parseHfTag(tag);
            let resolution: PredictionResolution = hfTag ?
                { prediction: await createHfPrediction(hfTag), source: "network", refreshAt: null } :
                await this.resolvePrediction(cacheInput);
            let predictor: FXNPredictor;
            try {
                predictor = await this.createPredictor(input, resolution.prediction, fxnc);
            } catch (error) {
                if (hfTag)
                    throw error;
                // The native API does not expose enough detail to distinguish a
                // bad cached token or resource from other creation failures, so
                // evict the entry and perform one unpinned refetch.
                await this.predictionCache.invalidate(cacheInput);
                resolution = await this.resolvePrediction(cacheInput, true);
                predictor = await this.createPredictor(input, resolution.prediction, fxnc);
            }
            this.cache.set(cacheKey, { tag, predictor, refreshAt: resolution.refreshAt });
            return predictor;
        });
    }

    private async createPredictor(
        input: CreatePredictionInput,
        prediction: Prediction,
        fxnc: FXNC
    ): Promise<FXNPredictor> {
        const { tag, acceleration } = input;
        const { FXNConfiguration, FXNPredictor } = fxnc;
        const token = prediction.configuration;
        let configuration: FXNConfiguration;
        try {
            configuration = FXNConfiguration.create();
            configuration.tag = prediction.tag ?? tag;
            if (token)
                configuration.token = token;
            configuration.acceleration = toAcceleration(acceleration);
            for (const resource of prediction.resources ?? [])
                await configuration.addResource(resource);
            for (const entry of parsePreloadClaim(token)) {
                assert(
                    typeof configuration.setMetadata === "function",
                    `Failed to create ${tag} prediction because it requires preloading ${entry.tag}, which the current Muna implementation does not support`
                );
                const preload = await this.createPreloadPrediction({
                    tag: entry.tag,
                    inputs: { _: null },
                    acceleration: entry.acceleration
                });
                configuration.setMetadata(entry.metadata, getPreloadOutput(preload, entry.tag));
            }
            return FXNPredictor.create(configuration);
        } finally {
            configuration?.dispose();
        }
    }

    private async createPreloadPrediction(input: CreatePredictionInput): Promise<Prediction> {
        const { acceleration = "local_auto" } = input;
        return acceleration.startsWith("local_") ?
            this.create(input) :
            this.remote.create(input);
    }

    private async resolvePrediction(
        cacheInput: PredictionCacheKey,
        force: boolean = false
    ): Promise<PredictionResolution> {
        return this.predictionCache.get(
            cacheInput,
            predictionId => this.requestRawPrediction(cacheInput, predictionId),
            { force }
        );
    }

    private async refreshLoadedPrediction(
        cacheInput: PredictionCacheKey,
        loaded: PredictorCacheEntry
    ): Promise<void> {
        if (!isRefreshDue(loaded.refreshAt))
            return;
        await this.withLock(createPredictionCacheKey(cacheInput), async () => {
            if (!isRefreshDue(loaded.refreshAt))
                return;
            loaded.refreshAt = await this.predictionCache.refresh(
                cacheInput,
                predictionId => this.requestRawPrediction(cacheInput, predictionId)
            );
        });
    }

    private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const previous = this.locks.get(key) ?? Promise.resolve();
        let release: () => void;
        const current = new Promise<void>(resolve => release = resolve);
        const tail = previous.then(() => current);
        this.locks.set(key, tail);
        await previous;
        try {
            return await fn();
        } finally {
            release();
            if (this.locks.get(key) === tail)
                this.locks.delete(key);
        }
    }

    private resolveCacheInput(
        input: CreatePredictionInput,
        fxnc: FXNC | null | undefined
    ): PredictionCacheKey {
        return {
            tag: input.tag,
            clientId: input.clientId ?? fxnc?.FXNConfiguration.getClientId() ?? "node",
            configurationId: input.configurationId ?? fxnc?.FXNConfiguration.getUniqueId()
        };
    }
}

/**
 * Create a raw prediction for a Hugging Face predictor.
 * Community predictors have no configuration token, and the native resource
 * cache downloads their resources from the repository itself.
 */
async function createHfPrediction(hfTag: HfTag): Promise<Prediction> {
    const { signature, ...prediction } = await loadHfManifest(hfTag);
    const resources = prediction.resources?.map(resource => {
        const filename = resource.url.split("/").pop();
        return { ...resource, url: hfFileUrl(hfTag, filename) };
    });
    return { ...prediction, configuration: undefined, resources };
}

function isRefreshDue(refreshAt: number | null): boolean {
    return refreshAt != null && Date.now() >= refreshAt;
}

export function parsePreloadClaim(token: string | null | undefined): PreloadEntry[] {
    if (!token)
        return [];
    const preload = parseJwtPayload(token)?.preload;
    if (!Array.isArray(preload))
        return [];
    const entries = preload.filter((entry): entry is PreloadEntry =>
        typeof entry?.tag === "string" &&
        typeof entry?.acceleration === "string" &&
        typeof entry?.metadata === "string"
    );
    // A malformed entry invalidates the whole claim, matching serde in muna-rs.
    if (entries.length !== preload.length)
        return [];
    return entries.map(({ tag, acceleration, metadata }) => ({ tag, acceleration, metadata }));
}

export function getPreloadOutput(prediction: Prediction, tag: string): string {
    if (prediction.error)
        throw new Error(`Failed to preload ${tag}: ${prediction.error}`);
    const result = prediction.results?.[0];
    if (result === undefined)
        throw new Error(`Failed to preload ${tag} because it returned no results`);
    if (typeof result !== "string")
        throw new Error(`Failed to preload ${tag} because its first result is not a string`);
    return result;
}

async function toValueMap(inputs: Record<string, Value>): Promise<FXNValueMap> {
    const { FXNValueMap } = await getFxnc();
    const map = FXNValueMap.create();
    for (const [key, value] of Object.entries(inputs))
        map.set(key, await toValue(value));
    return map;
}

async function toValue(value: Value): Promise<FXNValue> {
    const { FXNValue } = await getFxnc();
    if (value == null)
        return FXNValue.createNull();
    if (isTensor(value))
        return FXNValue.createArray(value.data, value.shape, 0);
    if (ArrayBuffer.isView(value))
        return FXNValue.createArray(
            value as any,
            [value.byteLength / (value.constructor as unknown as TypedArray).BYTES_PER_ELEMENT],
            0
        );
    if (value instanceof ArrayBuffer)
        return FXNValue.createBinary(value, 0);
    if (typeof(value) === "string")
        return FXNValue.createString(value);
    if (typeof(value) === "number")
        return FXNValue.createArray(
            Number.isInteger(value) ? new Int32Array([value]) : new Float32Array([value]),
            null,
            1
        );
    if (typeof(value) === "bigint")
        return FXNValue.createArray(new BigInt64Array([value]), null, 1);
    if (typeof(value) === "boolean")
        return FXNValue.createArray(new BoolArray([value]), null, 1);
    if (isImage(value))
        return FXNValue.createImage(value, 0);
    if (Array.isArray(value) && value.length > 0 && value.every(isTensor))
        return FXNValue.createArrayList(value as Tensor[], 0);
    if (Array.isArray(value) && value.length > 0 && value.every(isImage))
        return FXNValue.createImageList(value as Image[], 0);
    if (Array.isArray(value))
        return FXNValue.createList(value);
    if (typeof(value) === "object")
        return FXNValue.createDict(value);
    throw new Error(`Failed to create prediction input value for unsupported type: ${typeof(value)}`);
}

function toPrediction(tag: string, prediction: FXNPrediction): Prediction {
    const { id, results: outputMap, latency, error, logs } = prediction;
    const results = outputMap ? Array.from(
        { length: outputMap.size },
        (_, idx) => outputMap.get(outputMap.key(idx)).toObject()
    ) : null;
    const created = new Date().toISOString() as unknown as Date;
    return { id, tag, created, results, latency, error, logs };
}

function toAcceleration(acceleration: Acceleration | Acceleration[] | undefined): number {
    acceleration = acceleration ?? [];
    const accelerations = Array.isArray(acceleration) ? acceleration : [acceleration];
    const constant = accelerations
        .map(a => toAccelerationConstant(a))
        .reduce((p, c) => p | c, 0);
    return constant;
}

function toAccelerationConstant(acceleration: Acceleration): number {
    switch (acceleration) {
        case "local_auto":  return 0;
        case "local_cpu":   return 1;
        case "local_gpu":   return 2;
        case "local_npu":   return 4;
        default:            return 0;
    }
}

function assert(condition: any, message: string) {
    if (!condition)
        throw new Error(message ?? "An unknown error occurred");
}
