/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { decode } from "base64-arraybuffer"
import type { Prediction } from "../types"

const CACHE_VERSION = 1;
const REFRESH_FRACTION = 0.5;
const REFRESH_RETRY_MS = 60 * 60 * 1000;

export interface PredictionCacheKey {
    tag: string;
    clientId: string;
    configurationId?: string;
}

export interface PredictionCacheStorage {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

/**
 * Fetch a raw prediction from the API.
 * When `predictionId` is provided, the API re-issues the configuration of that
 * prediction instead of resolving the tag again, so a token refresh never
 * silently switches a long-lived process to a different predictor build.
 */
export type FetchPrediction = (predictionId?: string) => Promise<Prediction>;

export interface PredictionResolution {
    prediction: Prediction;
    source: "cache" | "network";
    /**
     * Time (in milliseconds since epoch) at which the configuration should next
     * be refreshed. This is `null` when the configuration never expires.
     */
    refreshAt: number | null;
}

export interface GetPredictionOptions {
    /**
     * Skip the cached entry and fetch an unpinned prediction.
     */
    force?: boolean;
}

interface PredictionCacheEntry {
    version: typeof CACHE_VERSION;
    prediction: Prediction;
    expiresAt: number;
    refreshAt: number;
}

/**
 * Persistent cache of raw predictions, keyed by tag, client, and configuration.
 * Mirrors `PredictionService::get_or_refresh_prediction` in muna-rs.
 */
export class PredictionCache {

    private readonly storage: PredictionCacheStorage;
    private readonly now: () => number;
    private readonly fetches = new Map<string, Promise<PredictionResolution>>();

    public constructor(
        storage: PredictionCacheStorage,
        now: () => number = Date.now
    ) {
        this.storage = storage;
        this.now = now;
    }

    /**
     * Resolve a prediction, using the cached entry until its refresh time.
     * When a due refresh fails, the cached configuration remains the best
     * available option (even after its token has expired) and the refresh is
     * retried later.
     */
    public async get(
        input: PredictionCacheKey,
        fetchPrediction: FetchPrediction,
        { force = false }: GetPredictionOptions = { }
    ): Promise<PredictionResolution> {
        const key = createPredictionCacheKey(input);
        const cached = force ? null : await this.read(key);
        if (!cached)
            return this.fetch(key, fetchPrediction);
        const refreshAt = toRefreshAt(cached);
        if (refreshAt == null || this.now() < refreshAt)
            return { prediction: cached.prediction, source: "cache", refreshAt };
        try {
            return await this.fetch(key, fetchPrediction, cached.prediction.id);
        } catch {
            return {
                prediction: cached.prediction,
                source: "cache",
                refreshAt: this.now() + REFRESH_RETRY_MS
            };
        }
    }

    /**
     * Refresh the persisted configuration for a predictor that is already loaded.
     * @returns Next refresh time.
     */
    public async refresh(
        input: PredictionCacheKey,
        fetchPrediction: FetchPrediction
    ): Promise<number | null> {
        const key = createPredictionCacheKey(input);
        const cached = await this.read(key);
        try {
            const { refreshAt } = await this.fetch(key, fetchPrediction, cached?.prediction.id);
            return refreshAt;
        } catch {
            return this.now() + REFRESH_RETRY_MS;
        }
    }

    public async invalidate(input: PredictionCacheKey): Promise<void> {
        const key = createPredictionCacheKey(input);
        try {
            await this.storage.delete(key);
        } catch {
            // Cache failures must not prevent a prediction from reaching the API.
        }
    }

    private async read(key: string): Promise<PredictionCacheEntry | null> {
        let value: string | null;
        try {
            value = await this.storage.get(key);
        } catch {
            return null;
        }
        if (!value)
            return null;
        try {
            const entry = JSON.parse(value) as PredictionCacheEntry;
            if (
                entry.version !== CACHE_VERSION ||
                !entry.prediction ||
                typeof entry.prediction.configuration !== "string" ||
                typeof entry.expiresAt !== "number" ||
                typeof entry.refreshAt !== "number"
            )
                throw new Error("Invalid prediction cache entry");
            return entry;
        } catch {
            try {
                await this.storage.delete(key);
            } catch { }
            return null;
        }
    }

    private async fetch(
        key: string,
        fetchPrediction: FetchPrediction,
        predictionId?: string
    ): Promise<PredictionResolution> {
        const existing = this.fetches.get(key);
        if (existing)
            return existing;
        const fetch = (async (): Promise<PredictionResolution> => {
            const prediction = await fetchPrediction(predictionId);
            const entry = createPredictionCacheEntry(prediction, this.now());
            if (entry)
                try {
                    await this.storage.set(key, JSON.stringify(entry));
                } catch {
                    // Persistence is an optimization; the fetched prediction is valid.
                }
            return {
                prediction,
                source: "network",
                refreshAt: entry ? toRefreshAt(entry) : null
            };
        })();
        this.fetches.set(key, fetch);
        try {
            return await fetch;
        } finally {
            this.fetches.delete(key);
        }
    }
}

export function createPredictionCacheKey({
    tag,
    clientId,
    configurationId
}: PredictionCacheKey): string {
    return JSON.stringify([tag, clientId, configurationId ?? null]);
}

export function parseJwtExpiration(token: string): {
    issuedAt?: number;
    expiresAt?: number;
} {
    const payload = parseJwtPayload(token);
    if (!payload)
        return { };
    const issuedAt = typeof payload.iat === "number" ?
        payload.iat * 1000 :
        undefined;
    const expiresAt = typeof payload.exp === "number" ?
        payload.exp * 1000 :
        undefined;
    return { issuedAt, expiresAt };
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const segment = token.split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const padded = segment + "=".repeat((4 - segment.length % 4) % 4);
        const payload: unknown = JSON.parse(
            new TextDecoder().decode(decode(padded))
        );
        return payload && typeof payload === "object" ?
            payload as Record<string, unknown> :
            null;
    } catch {
        return null;
    }
}

function toRefreshAt(entry: PredictionCacheEntry): number | null {
    return entry.refreshAt >= Number.MAX_SAFE_INTEGER ? null : entry.refreshAt;
}

function createPredictionCacheEntry(
    prediction: Prediction,
    fetchedAt: number
): PredictionCacheEntry | null {
    if (!prediction.configuration)
        return null;
    const payload = parseJwtPayload(prediction.configuration);
    if (!payload)
        return null;
    const { issuedAt, expiresAt } = parseJwtExpiration(prediction.configuration);
    if (!Object.prototype.hasOwnProperty.call(payload, "exp"))
        return {
            version: CACHE_VERSION,
            prediction,
            expiresAt: Number.MAX_SAFE_INTEGER,
            refreshAt: Number.MAX_SAFE_INTEGER
        };
    if (expiresAt == null)
        return null;
    const lifetimeStart = issuedAt != null && issuedAt < expiresAt ?
        issuedAt :
        fetchedAt;
    const lifetime = Math.max(0, expiresAt - lifetimeStart);
    const refreshAt = lifetimeStart + lifetime * REFRESH_FRACTION;
    return {
        version: CACHE_VERSION,
        prediction,
        expiresAt,
        refreshAt
    };
}
