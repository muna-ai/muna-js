/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { MunaAPIError } from "../client"
import type { Prediction, Signature } from "../types"

/**
 * Hugging Face predictor tag.
 */
export interface HfTag {
    /**
     * Hugging Face repository identifier.
     */
    repoId: string;
    /**
     * Repository revision.
     */
    revision?: string;
}

/**
 * Predictor manifest stored in a Hugging Face repository.
 * This is a raw prediction with the predictor signature added, so that beta
 * clients like `muna.beta.openai` work with community predictors.
 */
export interface HfManifest extends Prediction {
    /**
     * Predictor signature.
     */
    signature: Signature;
}

/**
 * Parse a Hugging Face predictor tag, like `hf:owner/repo[@revision]`.
 * @returns Hugging Face tag, or `null` if the tag is not a Hugging Face tag.
 */
export function parseHfTag(tag: string): HfTag | null {
    if (!tag.startsWith(HF_TAG_PREFIX))
        return null;
    const rest = tag.slice(HF_TAG_PREFIX.length);
    const separator = rest.indexOf("@");
    const repoId = separator >= 0 ? rest.slice(0, separator) : rest;
    const revision = separator >= 0 ? rest.slice(separator + 1) : "";
    const [owner, name, ...extra] = repoId.split("/");
    if (!owner || !name || extra.length > 0)
        return null;
    return { repoId, revision: revision || undefined };
}

/**
 * Load a predictor manifest from Hugging Face.
 */
export async function loadHfManifest(hfTag: HfTag): Promise<HfManifest> {
    const filename = "muna.json";
    const url = hfFileUrl(hfTag, filename);
    const token = getEnv("HF_TOKEN");
    const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : undefined
    });
    if (!response.ok) {
        const hint = (
            response.status === 401 ? " Set `HF_TOKEN` to access private and gated repositories." :
            response.status === 403 ? " Check that your Hugging Face account has accepted the repository's terms, and that your token can read gated repositories." :
            ""
        );
        throw new MunaAPIError(
            `Failed to download ${filename} from Hugging Face repository ${hfTag.repoId}: ${response.status}.${hint}`,
            response.status
        );
    }
    return await response.json() as HfManifest;
}

/**
 * Get the URL of a file in a Hugging Face repository.
 */
export function hfFileUrl(hfTag: HfTag, filename: string): string {
    const endpoint = (getEnv("HF_ENDPOINT") ?? "https://huggingface.co").replace(/\/+$/, "");
    const revision = encodeURIComponent(hfTag.revision ?? "main");
    const path = filename.split("/").map(encodeURIComponent).join("/");
    return `${endpoint}/${hfTag.repoId}/resolve/${revision}/${path}`;
}

function getEnv(name: string): string | undefined {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

const HF_TAG_PREFIX = "hf:";
