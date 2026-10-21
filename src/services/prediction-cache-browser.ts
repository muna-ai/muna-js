/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { PredictionCacheStorage } from "./prediction-cache"

const CACHE_NAME = "muna-predictions-v1";
const KEY_PREFIX = "muna:predictions:v1:";
const CACHE_URL = "https://cache.muna.invalid/predictions/";

export class BrowserPredictionCacheStorage implements PredictionCacheStorage {

    public async get(key: string): Promise<string | null> {
        if (typeof caches !== "undefined") {
            const cache = await caches.open(CACHE_NAME);
            const response = await cache.match(createRequest(key));
            return response ? response.text() : null;
        }
        return getLocalStorage()?.getItem(KEY_PREFIX + key) ?? null;
    }

    public async set(key: string, value: string): Promise<void> {
        if (typeof caches !== "undefined") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(
                createRequest(key),
                new Response(value, {
                    headers: { "Content-Type": "application/json" }
                })
            );
            return;
        }
        getLocalStorage()?.setItem(KEY_PREFIX + key, value);
    }

    public async delete(key: string): Promise<void> {
        if (typeof caches !== "undefined") {
            const cache = await caches.open(CACHE_NAME);
            await cache.delete(createRequest(key));
            return;
        }
        getLocalStorage()?.removeItem(KEY_PREFIX + key);
    }
}

export function createBrowserPredictionCacheStorage(): PredictionCacheStorage {
    return new BrowserPredictionCacheStorage();
}

function createRequest(key: string): Request {
    return new Request(CACHE_URL + encodeURIComponent(key));
}

function getLocalStorage(): Storage | null {
    try {
        return typeof localStorage !== "undefined" ? localStorage : null;
    } catch {
        return null;
    }
}
