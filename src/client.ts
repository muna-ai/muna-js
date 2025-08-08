/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaConfig } from "./muna"

export interface RequestInput {
    /**
     * Request path.
     */
    path: string;
    /**
     * Request method.
     * Defaults to `GET`.
     */
    method?: string;
    /**
     * Request headers.
     */
    headers?: Record<string, string>;
    /**
     * Request body.
     */
    body?: Record<string, any>;
}

/**
 * Muna API client.
 */
export class MunaClient {

    /**
     * Muna API URL.
     */
    public readonly url: string;

    private readonly auth: string;
    private static readonly URL: string = "https://api.muna.ai/v1";

    /**
     * Create a Muna API client.
     * @param config Muna client configuration.
     */
    public constructor({
        accessKey = process.env.MUNA_ACCESS_KEY,
        url = process.env.MUNA_API_URL ?? MunaClient.URL
    }: MunaConfig) {
        this.url = url;
        this.auth = accessKey != null ? `Bearer ${accessKey}` : "";
    }

    /**
     * Make a request.
     */
    public async request<T = any>({
        path,
        method = "GET",
        headers,
        body
    }: RequestInput): Promise<T> {
        const response = await fetch(
            `${this.url}${path}`,
            {
                method,
                headers: { ...headers, "Authorization": this.auth },
                body: body ? JSON.stringify(body) : undefined
            }
        );
        const payload = await response.json();
        if (!response.ok)
            throw new MunaAPIError(
                payload?.errors?.[0].message ?? "An unknown error occurred",
                response.status
            );
        return payload;
    }
}

export class MunaAPIError extends Error {

    /**
     * Request status code.
     */
    public readonly status: number;

    public constructor (message: string, status: number) {
        super(message);
        this.name = "MunaAPIError";
        this.status = status;
        Error.captureStackTrace(this, this.constructor);
    }
}