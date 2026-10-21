/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { stream } from "fetch-event-stream"
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
     * Muna access key.
     */
    public readonly accessKey: string | undefined;

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
        accessKey = getEnv("MUNA_ACCESS_KEY") ?? getEnv("FXN_ACCESS_KEY"),
        url = getEnv("MUNA_API_URL") ?? getEnv("FXN_API_URL") ?? MunaClient.URL
    }: MunaConfig) {
        this.accessKey = accessKey;
        this.url = url;
        this.auth = accessKey != null ? `Bearer ${accessKey}` : "";
    }

    /**
     * Make a request to a REST endpoint.
     */
    public async request<T = any>({
        path,
        method = "GET",
        headers,
        body
    }: RequestInput): Promise<T> {
        const response = await fetch(`${this.url}${path}`, {
            method,
            headers: this.createHeaders(headers, body),
            body: body ? JSON.stringify(body) : undefined
        });
        const payload = await readPayload(response);
        if (!response.ok)
            throw new MunaAPIError(getErrorMessage(payload), response.status);
        return payload as T;
    }

    /**
     * Make a request to a REST endpoint and consume the response as a server-sent events stream.
     */
    public async * stream<T = any>({
        path,
        method = "GET",
        headers,
        body
    }: RequestInput): AsyncGenerator<T> {
        let events: Awaited<ReturnType<typeof stream>>;
        try {
            events = await stream(`${this.url}${path}`, {
                method,
                headers: {
                    ...this.createHeaders(headers, body),
                    "Accept": "text/event-stream"
                },
                body: body ? JSON.stringify(body) : undefined
            });
        } catch (error) {
            // `fetch-event-stream` throws the raw `Response` for non-2xx statuses.
            if (error instanceof Response)
                throw new MunaAPIError(getErrorMessage(await readPayload(error)), error.status);
            throw error;
        }
        for await (const { event, data } of events)
            yield { event, data: data ? JSON.parse(data) : null } as T;
    }

    private createHeaders(
        headers: Record<string, string> | undefined,
        body: Record<string, any> | undefined
    ): Record<string, string> {
        const result: Record<string, string> = { ...headers };
        if (body && !Object.keys(result).some(key => key.toLowerCase() === "content-type"))
            result["Content-Type"] = "application/json";
        if (this.auth)
            result["Authorization"] = this.auth;
        return result;
    }
}

/**
 * Muna API error.
 */
export class MunaAPIError extends Error {

    /**
     * Request status code.
     */
    public readonly status: number;

    public constructor(message: string, status: number) {
        super(message);
        this.name = "MunaAPIError";
        this.status = status;
        // `captureStackTrace` is V8-only; Safari and Firefox populate `stack` on construction.
        (Error as any).captureStackTrace?.(this, this.constructor);
    }
}

async function readPayload(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function getErrorMessage(payload: unknown): string {
    if (typeof payload === "string" && payload.trim())
        return payload;
    const message = (payload as any)?.errors?.[0]?.message;
    return typeof message === "string" ? message : "An unknown error occurred";
}

function getEnv(name: string): string | undefined {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
}
