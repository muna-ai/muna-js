/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect } from "chai"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalPredictionService } from "../src/services/local"
import {
    createPredictionCacheKey,
    parseJwtExpiration,
    PredictionCache,
    type PredictionCacheStorage
} from "../src/services/prediction-cache"
import { BrowserPredictionCacheStorage } from "../src/services/prediction-cache-browser"
import { NodePredictionCacheStorage } from "../src/services/prediction-cache-node"
import type { Prediction } from "../src/types"

describe("Prediction cache", () => {

    it("contacts the API on first load and persists the response", async () => {
        const storage = new MemoryStorage();
        let requests = 0;
        const now = seconds(100);
        const prediction = createPrediction("token", 100, 300);
        const firstCache = new PredictionCache(storage, () => now);
        const first = await firstCache.get(CACHE_INPUT, async () => {
            requests += 1;
            return prediction;
        });
        const secondCache = new PredictionCache(storage, () => now);
        const second = await secondCache.get(CACHE_INPUT, async () => {
            requests += 1;
            return prediction;
        });

        expect(first.source).to.equal("network");
        expect(second.source).to.equal("cache");
        expect(requests).to.equal(1);
    });

    it("keys entries by tag, client ID, and configuration ID", async () => {
        const storage = new MemoryStorage();
        const cache = new PredictionCache(storage, () => seconds(100));
        const prediction = createPrediction("token", 100, 300);
        let requests = 0;
        for (const input of [
            CACHE_INPUT,
            { ...CACHE_INPUT, tag: "@muna/other" },
            { ...CACHE_INPUT, clientId: "wasm" },
            { ...CACHE_INPUT, configurationId: "device-2" }
        ])
            await cache.get(input, async () => {
                requests += 1;
                return prediction;
            });

        expect(requests).to.equal(4);
    });

    it("refreshes at token half-life", async () => {
        const storage = new MemoryStorage();
        let now = seconds(100);
        let requests = 0;
        const cache = new PredictionCache(storage, () => now);
        const fetchPrediction = async () => {
            requests += 1;
            return createPrediction(`token-${requests}`, 100, 300);
        };
        await cache.get(CACHE_INPUT, fetchPrediction);
        now = seconds(199);
        expect((await cache.get(CACHE_INPUT, fetchPrediction)).source).to.equal("cache");
        now = seconds(200);
        expect((await cache.get(CACHE_INPUT, fetchPrediction)).source).to.equal("network");
        expect(requests).to.equal(2);
    });

    it("uses stale data after expiry when refresh fails", async () => {
        const storage = new MemoryStorage();
        let now = seconds(100);
        const cache = new PredictionCache(storage, () => now);
        const prediction = createPrediction("stale", 100, 300);
        await cache.get(CACHE_INPUT, async () => prediction);
        now = seconds(400);

        const result = await cache.get(CACHE_INPUT, async () => {
            throw new Error("offline");
        });

        expect(result.source).to.equal("cache");
        expect(result.prediction.configuration).to.equal(prediction.configuration);
    });

    it("persists legacy tokens without an expiration claim", async () => {
        const storage = new MemoryStorage();
        const prediction = createPrediction("legacy", 100, 300);
        prediction.configuration = createToken("legacy", 100);
        let requests = 0;
        const fetchPrediction = async () => {
            requests += 1;
            return prediction;
        };

        await new PredictionCache(storage, () => seconds(100)).get(
            CACHE_INPUT,
            fetchPrediction
        );
        const cached = await new PredictionCache(storage, () => seconds(10_000)).get(
            CACHE_INPUT,
            fetchPrediction
        );

        expect(cached.source).to.equal("cache");
        expect(requests).to.equal(1);
    });

    it("deduplicates concurrent refreshes", async () => {
        const storage = new MemoryStorage();
        const cache = new PredictionCache(storage, () => seconds(100));
        let requests = 0;
        const fetchPrediction = async () => {
            requests += 1;
            await Promise.resolve();
            return createPrediction("shared", 100, 300);
        };

        await Promise.all([
            cache.get(CACHE_INPUT, fetchPrediction),
            cache.get(CACHE_INPUT, fetchPrediction)
        ]);

        expect(requests).to.equal(1);
    });

    it("invalidates and refetches once when predictor rejects a token", async () => {
        const storage = new MemoryStorage();
        const now = Date.now();
        const issuedAt = Math.floor(now / 1000);
        const oldPrediction = createPrediction("old", issuedAt, issuedAt + 3600);
        const freshPrediction = createPrediction("fresh", issuedAt, issuedAt + 3600);
        await new PredictionCache(storage, () => now).get(
            CACHE_INPUT,
            async () => oldPrediction
        );
        const tokens: string[] = [];
        let requests = 0;
        let requestBody: Record<string, unknown>;
        class Configuration {
            tag: string;
            token: string;
            acceleration: number;
            static create() { return new Configuration(); }
            static getClientId() { return CACHE_INPUT.clientId; }
            static getUniqueId() { return CACHE_INPUT.configurationId; }
            async addResource() { }
            dispose() { }
        }
        const predictor = { dispose() { } };
        const fxnc = {
            FXNConfiguration: Configuration,
            FXNPredictor: {
                create(configuration: Configuration) {
                    tokens.push(configuration.token);
                    if (configuration.token === oldPrediction.configuration)
                        throw new Error("configuration token could not be verified");
                    return predictor;
                }
            }
        };
        const client = {
            async request({ body }: { body: Record<string, unknown> }) {
                requests += 1;
                requestBody = body;
                return freshPrediction;
            }
        };
        const service = new LocalPredictionService(
            client as any,
            storage,
            async () => fxnc as any
        );

        const result = await (service as any).getPredictor({
            tag: CACHE_INPUT.tag
        });

        expect(result).to.equal(predictor);
        expect(tokens).to.deep.equal([
            oldPrediction.configuration,
            freshPrediction.configuration
        ]);
        expect(requests).to.equal(1);
        // The refetch after a rejected token is unpinned so the API can issue
        // a configuration for the current predictor build.
        expect(requestBody).to.deep.equal({
            tag: CACHE_INPUT.tag,
            clientId: CACHE_INPUT.clientId,
            configurationId: CACHE_INPUT.configurationId,
            predictionId: undefined
        });
    });

    it("pins the cached prediction ID when refreshing", async () => {
        const storage = new MemoryStorage();
        let now = seconds(100);
        const cache = new PredictionCache(storage, () => now);
        const pinned: (string | undefined)[] = [];
        const fetchPrediction = async (predictionId?: string) => {
            pinned.push(predictionId);
            return createPrediction(`token-${pinned.length}`, 100, 300);
        };
        await cache.get(CACHE_INPUT, fetchPrediction);
        now = seconds(200);
        await cache.get(CACHE_INPUT, fetchPrediction);
        await cache.get(CACHE_INPUT, fetchPrediction, { force: true });

        expect(pinned).to.deep.equal([undefined, "pred-token-1", undefined]);
    });

    it("backs off for an hour when a due refresh fails", async () => {
        const storage = new MemoryStorage();
        let now = seconds(100);
        const cache = new PredictionCache(storage, () => now);
        await cache.get(CACHE_INPUT, async () => createPrediction("stale", 100, 300));
        now = seconds(250);

        const result = await cache.get(CACHE_INPUT, async () => {
            throw new Error("offline");
        });
        const nextRefresh = await cache.refresh(CACHE_INPUT, async () => {
            throw new Error("offline");
        });

        expect(result.refreshAt).to.equal(seconds(250 + 3600));
        expect(nextRefresh).to.equal(seconds(250 + 3600));
    });

    it("reports no refresh time for tokens without an expiration claim", async () => {
        const storage = new MemoryStorage();
        const prediction = createPrediction("legacy", 100, 300);
        prediction.configuration = createToken("legacy", 100);
        const result = await new PredictionCache(storage, () => seconds(100)).get(
            CACHE_INPUT,
            async () => prediction
        );

        expect(result.refreshAt).to.be.null;
    });

    it("persists entries with Node storage", async () => {
        const directory = await mkdtemp(join(tmpdir(), "muna-prediction-cache-"));
        const key = createPredictionCacheKey(CACHE_INPUT);
        try {
            await new NodePredictionCacheStorage(directory).set(key, "value");
            expect(await new NodePredictionCacheStorage(directory).get(key)).to.equal("value");
            await new NodePredictionCacheStorage(directory).delete(key);
            expect(await new NodePredictionCacheStorage(directory).get(key)).to.be.null;
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("persists entries with browser Cache Storage", async () => {
        const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
        const values = new Map<string, Response>();
        const cache = {
            async match(request: Request) {
                return values.get(request.url)?.clone();
            },
            async put(request: Request, response: Response) {
                values.set(request.url, response.clone());
            },
            async delete(request: Request) {
                return values.delete(request.url);
            }
        };
        Object.defineProperty(globalThis, "caches", {
            configurable: true,
            value: { open: async () => cache }
        });
        try {
            const key = createPredictionCacheKey(CACHE_INPUT);
            await new BrowserPredictionCacheStorage().set(key, "value");
            expect(await new BrowserPredictionCacheStorage().get(key)).to.equal("value");
            await new BrowserPredictionCacheStorage().delete(key);
            expect(await new BrowserPredictionCacheStorage().get(key)).to.be.null;
        } finally {
            if (originalCaches)
                Object.defineProperty(globalThis, "caches", originalCaches);
            else
                delete (globalThis as any).caches;
        }
    });

    it("parses JWT expiration claims", () => {
        const token = createToken("claims", 123, 456);
        expect(parseJwtExpiration(token)).to.deep.equal({
            issuedAt: seconds(123),
            expiresAt: seconds(456)
        });
    });
});

class MemoryStorage implements PredictionCacheStorage {

    private readonly values = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.values.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        this.values.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.values.delete(key);
    }
}

const CACHE_INPUT = {
    tag: "@muna/test",
    clientId: "node",
    configurationId: "device-1"
};

function createPrediction(name: string, issuedAt: number, expiresAt: number): Prediction {
    return {
        id: `pred-${name}`,
        tag: CACHE_INPUT.tag,
        created: new Date(),
        configuration: createToken(name, issuedAt, expiresAt),
        resources: []
    };
}

function createToken(name: string, issuedAt: number, expiresAt?: number): string {
    const encode = (value: unknown) => Buffer
        .from(JSON.stringify(value))
        .toString("base64url");
    const payload: Record<string, unknown> = { name, iat: issuedAt };
    if (expiresAt != null)
        payload.exp = expiresAt;
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

function seconds(value: number): number {
    return value * 1000;
}
