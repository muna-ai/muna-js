/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { getParameter } from "../src/beta/annotations"
import { predictionErrorToError } from "../src/beta/errors"
import { ChatCompletionService } from "../src/beta/openai/completions"
import { EmbeddingService } from "../src/beta/openai/embeddings"
import { MunaAPIError, MunaClient } from "../src/client"
import { parseHfTag } from "../src/services/hf"
import { getPreloadOutput, LocalPredictionService, parsePreloadClaim } from "../src/services/local"
import type { PredictionCacheStorage } from "../src/services/prediction-cache"
import type { Parameter, Prediction, Predictor } from "../src/types"

use(chaiAsPromised);

describe("MunaClient", () => {

    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    it("raises a runtime MunaAPIError for non-JSON error bodies", async () => {
        globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
        const client = new MunaClient({ accessKey: "key", url: "https://api.test" });
        const error = await client.request({ path: "/x" }).catch(e => e);
        expect(error).to.be.instanceOf(MunaAPIError);
        expect(error.status).to.equal(502);
        expect(error.message).to.equal("Bad Gateway");
    });

    it("accepts empty success bodies", async () => {
        globalThis.fetch = async () => new Response(null, { status: 204 });
        const client = new MunaClient({ accessKey: "key", url: "https://api.test" });
        expect(await client.request({ path: "/x", method: "DELETE" })).to.be.null;
    });

    it("raises MunaAPIError for streaming HTTP errors", async () => {
        globalThis.fetch = async () => new Response(
            JSON.stringify({ errors: [{ message: "Not found" }] }),
            { status: 404 }
        );
        const client = new MunaClient({ accessKey: "key", url: "https://api.test" });
        const error = await (async () => {
            for await (const _ of client.stream({ path: "/x", method: "POST", body: { } })) { }
        })().catch(e => e);
        expect(error).to.be.instanceOf(MunaAPIError);
        expect(error.status).to.equal(404);
        expect(error.message).to.equal("Not found");
    });
});

describe("Predictions", () => {

    it("parses Hugging Face tags", () => {
        expect(parseHfTag("hf:owner/repo")).to.deep.equal({ repoId: "owner/repo", revision: undefined });
        expect(parseHfTag("hf:owner/repo@v1")).to.deep.equal({ repoId: "owner/repo", revision: "v1" });
        expect(parseHfTag("hf:owner/repo@")).to.deep.equal({ repoId: "owner/repo", revision: undefined });
        for (const tag of ["@owner/repo", "hf:owner", "hf:/repo", "hf:owner/", "hf:a/b/c", "hf:"])
            expect(parseHfTag(tag), tag).to.be.null;
    });

    it("parses preload claims", () => {
        const entry = { tag: "@user/model:decode", acceleration: "remote_b200", metadata: "decode_url" };
        expect(parsePreloadClaim(createToken({ preload: [{ ...entry, extra: true }] }))).to.deep.equal([entry]);
        expect(parsePreloadClaim(createToken({ }))).to.deep.equal([]);
        expect(parsePreloadClaim(createToken({ preload: [{ tag: "@user/model:decode" }] }))).to.deep.equal([]);
        expect(parsePreloadClaim("not-a-jwt")).to.deep.equal([]);
        expect(parsePreloadClaim(undefined)).to.deep.equal([]);
    });

    it("requires a string preload output", () => {
        const prediction = (results: any[], error?: string) => ({
            id: "p", tag: "t", created: new Date(), results, error
        }) satisfies Prediction;
        expect(getPreloadOutput(prediction(["url"]), "t")).to.equal("url");
        expect(() => getPreloadOutput(prediction([]), "t")).to.throw("no results");
        expect(() => getPreloadOutput(prediction([1]), "t")).to.throw("not a string");
        expect(() => getPreloadOutput(prediction(["url"], "boom"), "t")).to.throw("boom");
    });

    it("downloads resources without loading a predictor for empty inputs", async () => {
        const added: string[] = [];
        let predictorsCreated = 0;
        class Configuration {
            static create() { return new Configuration(); }
            static getClientId() { return "node"; }
            static getUniqueId() { return "device"; }
            async addResource(resource: { url: string }) { added.push(resource.url); }
            dispose() { }
        }
        const fxnc = {
            FXNConfiguration: Configuration,
            FXNPredictor: { create() { predictorsCreated += 1; } }
        };
        const prediction: Prediction = {
            id: "pred",
            tag: "@muna/test",
            created: new Date(),
            configuration: createToken({ exp: Math.floor(Date.now() / 1000) + 3600 }),
            resources: [{ type: "dso", url: "https://cdn/a" }, { type: "bin", url: "https://cdn/b" }]
        };
        const client = { request: async () => prediction };
        const service = new LocalPredictionService(client as any, new MemoryStorage(), async () => fxnc as any);
        const result = await service.create({ tag: "@muna/test", inputs: { } });
        expect(result.id).to.equal("pred");
        expect(added).to.deep.equal(["https://cdn/a", "https://cdn/b"]);
        expect(predictorsCreated).to.equal(0);
    });
});

describe("Beta helpers", () => {

    it("gets parameters by dtype and denotation", () => {
        const params: Parameter[] = [
            { name: "a", dtype: "float32" },
            { name: "b", dtype: "int32", denotation: "openai.embeddings.dims" }
        ];
        expect(getParameter(params, { dtype: ["int32", "int64"], denotation: "openai.embeddings.dims" }))
            .to.deep.equal([1, params[1]]);
        expect(getParameter(params, { dtype: "float32" })).to.deep.equal([0, params[0]]);
        expect(getParameter(params, { dtype: "string" })).to.deep.equal([null, null]);
    });

    it("classifies prediction errors", () => {
        const valueError = predictionErrorToError("Traceback (most recent call last):\n  File x\nValueError: bad input");
        expect(valueError).to.be.instanceOf(TypeError);
        expect(valueError.message).to.equal("bad input");
        const runtime = predictionErrorToError("RuntimeError: CUDA failure");
        expect(runtime).to.not.be.instanceOf(TypeError);
        expect(runtime.message).to.equal("RuntimeError: CUDA failure");
    });
});

describe("OpenAI", () => {

    it("forwards embedding dimensions", async () => {
        const predictor = createPredictor({
            inputs: [
                { name: "texts", dtype: "list" },
                { name: "dims", dtype: "int32", denotation: "openai.embeddings.dims", optional: true }
            ],
            outputs: [{ name: "embeddings", dtype: "float32", denotation: "embedding" }]
        });
        let inputs: Record<string, unknown>;
        const predictions = {
            async create(input: { inputs: Record<string, unknown> }) {
                inputs = input.inputs;
                return { results: [{ data: new Float32Array(4), shape: [1, 4] }] };
            }
        };
        const service = new EmbeddingService(fakePredictors(predictor), predictions as any);
        await service.create({ model: predictor.tag, input: "hi", dimensions: 4 });
        expect(inputs).to.deep.equal({ texts: ["hi"], dims: 4 });
    });

    it("rejects chat predictors that do not yield chunks", async () => {
        const predictor = createPredictor({
            inputs: [{ name: "messages", dtype: "list" }],
            outputs: [{ name: "completion", dtype: "dict", schema: { title: "ChatCompletion" } }]
        });
        const service = new ChatCompletionService(fakePredictors(predictor), { } as any);
        await expect(service.create({
            model: predictor.tag,
            messages: [{ role: "user", content: "hi" }]
        })).to.be.rejectedWith("ChatCompletionChunk");
    });

    it("merges chunks with reasoning and tool calls", async () => {
        const predictor = createPredictor({
            inputs: [
                { name: "messages", dtype: "list" },
                { name: "tools", dtype: "list", denotation: "openai.chat.completions.tools", optional: true },
                { name: "seed", dtype: "int32", denotation: "openai.chat.completions.seed", optional: true }
            ],
            outputs: [{ name: "chunk", dtype: "dict", schema: { title: "ChatCompletionChunk" } }]
        });
        const chunk = (delta: object, extra: object = { }) => ({
            object: "chat.completion.chunk", id: "c", model: "m", created: 1,
            choices: [{ index: 0, delta, ...extra }]
        });
        const outputs = [
            chunk({ role: "assistant", reasoning_content: "think" }),
            chunk({ tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "f", arguments: "{\"a\"" } }] }),
            chunk({ tool_calls: [{ index: 0, function: { arguments: ":1}" } }] }, { finish_reason: "tool_calls" }),
            { ...chunk({ }), choices: [] as object[], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }
        ];
        let inputs: Record<string, unknown>;
        const predictions = {
            async * stream(input: { inputs: Record<string, unknown> }) {
                inputs = input.inputs;
                for (const output of outputs)
                    yield { results: [output] };
            }
        };
        const tools = [{ type: "function" as const, function: { name: "f" } }];
        const service = new ChatCompletionService(fakePredictors(predictor), predictions as any);
        const completion = await service.create({
            model: predictor.tag,
            messages: [
                { role: "user", content: [{ type: "text", text: "hi" }] },
                { role: "assistant", content: null }
            ],
            tools,
            seed: 7
        });
        expect(inputs).to.deep.equal({
            messages: [
                { role: "user", content: [{ type: "text", text: "hi" }] },
                { role: "assistant", content: "" }
            ],
            tools,
            seed: 7
        });
        expect(completion.choices[0]).to.deep.equal({
            index: 0,
            message: {
                role: "assistant",
                content: "",
                reasoning_content: "think",
                tool_calls: [{ id: "call_1", type: "function", function: { name: "f", arguments: "{\"a\":1}" } }]
            },
            finish_reason: "tool_calls",
            logprobs: null
        });
        expect(completion.usage).to.deep.equal({ prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 });
    });

    it("validates chat messages and tool support", async () => {
        const predictor = createPredictor({
            inputs: [{ name: "messages", dtype: "list" }],
            outputs: [{ name: "chunk", dtype: "dict", schema: { title: "ChatCompletionChunk" } }]
        });
        const service = new ChatCompletionService(fakePredictors(predictor), { } as any);
        await expect(service.create({ model: predictor.tag, messages: [] }))
            .to.be.rejectedWith("at least one message");
        await expect(service.create({ model: predictor.tag, messages: [{ role: "user", content: "  " }] }))
            .to.be.rejectedWith("non-empty `content`");
        await expect(service.create({
            model: predictor.tag,
            messages: [{ role: "user", content: "hi" }],
            tools: [{ type: "function", function: { name: "f" } }]
        })).to.be.rejectedWith("does not support tool calling");
    });
});

class MemoryStorage implements PredictionCacheStorage {
    private readonly values = new Map<string, string>();
    async get(key: string) { return this.values.get(key) ?? null; }
    async set(key: string, value: string) { this.values.set(key, value); }
    async delete(key: string) { this.values.delete(key); }
}

function createPredictor(signature: Predictor["signature"]): Predictor {
    return {
        tag: "@muna/test",
        owner: { username: "muna", created: new Date() },
        name: "test",
        description: "",
        status: "active",
        access: "public",
        signature,
        created: new Date()
    };
}

function fakePredictors(predictor: Predictor): any {
    return { retrieve: async () => predictor };
}

function createToken(payload: Record<string, unknown>): string {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}
