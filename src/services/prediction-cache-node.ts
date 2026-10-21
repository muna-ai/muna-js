/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import type { PredictionCacheStorage } from "./prediction-cache"

export class NodePredictionCacheStorage implements PredictionCacheStorage {

    private readonly directory: string;

    public constructor(directory: string = getPredictionCacheDirectory()) {
        this.directory = directory;
    }

    public async get(key: string): Promise<string | null> {
        try {
            return await readFile(this.path(key), "utf8");
        } catch (error: any) {
            if (error?.code === "ENOENT")
                return null;
            throw error;
        }
    }

    public async set(key: string, value: string): Promise<void> {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const path = this.path(key);
        const temporaryPath = `${path}.${randomBytes(6).toString("hex")}.tmp`;
        try {
            await writeFile(temporaryPath, value, { encoding: "utf8", mode: 0o600 });
            await rename(temporaryPath, path);
        } finally {
            await rm(temporaryPath, { force: true });
        }
    }

    public async delete(key: string): Promise<void> {
        await rm(this.path(key), { force: true });
    }

    private path(key: string): string {
        const digest = createHash("sha256").update(key).digest("hex");
        return join(this.directory, `${digest}.json`);
    }
}

export function createNodePredictionCacheStorage(): PredictionCacheStorage {
    return new NodePredictionCacheStorage();
}

function getPredictionCacheDirectory(): string {
    if (process.env.MUNA_CACHE_DIR)
        return join(process.env.MUNA_CACHE_DIR, "predictions");
    if (process.env.MUNA_HOME)
        return join(process.env.MUNA_HOME, "cache", "predictions");
    const home = homedir();
    const root = home ? join(home, ".fxn") : join(tmpdir(), ".fxn");
    return join(root, "cache", "predictions");
}
