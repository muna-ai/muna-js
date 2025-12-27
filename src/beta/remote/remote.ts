/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { decode, encode } from "base64-arraybuffer"
import { getFxnc, type FXNC } from "../../c"
import type { MunaClient } from "../../client"
import { BoolArray, isImage, isTensor, isTypedArray } from "../../types"
import type { Dtype, Prediction, Tensor, TypedArray, Value } from "../../types"
import type { RemoteAcceleration, RemotePrediction, RemotePredictionEvent, RemoteValue } from "./types"

export interface CreateRemotePredictionInput {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Input values.
     */
    inputs: Record<string, Value>;
    /**
     * Prediction acceleration.
     */
    acceleration?: RemoteAcceleration;
}

export class RemotePredictionService {

    private readonly client: MunaClient;
    private fxnc: FXNC;

    public constructor(client: MunaClient) {
        this.client = client;
    }

    /**
     * Create a remote prediction.
     * @param input Prediction input.
     * @returns Prediction.
     */
    public async create(input: CreateRemotePredictionInput): Promise<Prediction> {
        const { tag, inputs, acceleration = "remote_auto" } = input;
        const inputMap = Object.fromEntries(await Promise.all(Object
            .entries(inputs)
            .map(async ([name, object]) => [
                name,
                await this.toValue({ object })
            ] satisfies [string, RemoteValue])
        ));
        this.fxnc ??= await getFxnc();
        const clientId = this.fxnc?.FXNConfiguration.getClientId() ?? "node";
        const remotePrediction = await this.client.request<RemotePrediction>({
            path: "/predictions/remote",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { tag, inputs: inputMap, acceleration, clientId }
        });
        const prediction = await downloadPrediction(remotePrediction);
        return prediction;
    }

    /**
     * Stream a remote prediction.
     * @param input Prediction input.
     */
    public async * stream(input: CreateRemotePredictionInput): AsyncGenerator<Prediction> { // DEPLOY
        const { tag, inputs, acceleration = "remote_auto" } = input;
        const inputMap = Object.fromEntries(await Promise.all(Object
            .entries(inputs)
            .map(async ([name, object]) => [
                name,
                await this.toValue({ object })
            ] satisfies [string, RemoteValue])
        ));
        this.fxnc ??= await getFxnc();
        const clientId = this.fxnc?.FXNConfiguration.getClientId() ?? "node";
        const stream = await this.client.stream<RemotePredictionEvent>({
            path: "/predictions/remote",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { tag, inputs: inputMap, acceleration, clientId, stream: true }
        });
        for await (const event of stream) {
            const prediction = await downloadPrediction(event.data);
            yield prediction;
        }
    }

    private async toValue(input: ToValueInput): Promise<RemoteValue> {
        const { object } = input;
        if (object === null)
            return { data: null, type: "null" };
        if (typeof(object) === "number") {
            const type: Dtype = Number.isInteger(object) ? "int32" : "float32";
            const data = type === "int32" ? new Int32Array([ object ]) : new Float32Array([ object ]);
            const tensor: Tensor = { data, shape: [] };
            return await this.toValue({ ...input, object: tensor });
        }
        if (typeof(object) === "boolean") {
            const data = new BoolArray([ object ]);
            const tensor: Tensor = { data, shape: [] };
            return await this.toValue({ ...input, object: tensor });
        }
        if (isTypedArray(object)) {
            const tensor: Tensor = { data: object, shape: [object.length] };
            return await this.toValue({ ...input, object: tensor });
        }
        if (isTensor(object)) { // INCOMPLETE
            const { data: { buffer }, shape } = object;
            const data = await this.upload({ buffer: buffer as ArrayBuffer });
            const type = getTypedArrayDtype(object.data);
            return { data, type };
        }
        if (typeof(object) === "string") {
            const buffer = new TextEncoder().encode(object).buffer;
            const data = await this.upload({ buffer, mime: "text/plain" });
            return { data, type: "string" };
        }
        if (Array.isArray(object)) {
            const listStr = JSON.stringify(object);
            const buffer = new TextEncoder().encode(listStr).buffer;
            const data = await this.upload({ buffer, mime: "application/json" });
            return { data, type: "list" };
        }
        if (isImage(object)) { // INCOMPLETE
            throw new Error("Failed to serialize image because it is not yet supported");
        }
        if (object instanceof ArrayBuffer) {
            const data = await this.upload({ buffer: object });
            return { data, type: "binary" };
        }
        if (typeof(object) === "object") {
            const dictStr = JSON.stringify(object);
            const buffer = new TextEncoder().encode(dictStr).buffer;
            const data = await this.upload({ buffer, mime: "application/json" });
            return { data, type: "dict" };
        }
        throw new Error(`Failed to serialize value '${object}' of type \`${typeof(object)}\` because it is not supported`);
    }

    private async toObject({ data: url, type }: RemoteValue): Promise<Value> {
        const shape: number[] = []; // INCOMPLETE
        if (type === "null")
            return null;
        const buffer = await this.download(url);
        if (type === "float16")
            throw new Error("Failed to deserialize value because JavaScript does not support half-precision floating point numbers");
        if (type === "float32") {
            const data = new Float32Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "float64") {
            const data = new Float64Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "int8") {
            const data = new Int8Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "int16") {
            const data = new Int16Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "int32") {
            const data = new Int32Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "int64") {
            const data = new BigInt64Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "uint8") {
            const data = new Uint8Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "uint16") {
            const data = new Uint16Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "uint32") {
            const data = new Uint32Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "uint64") {
            const data = new BigUint64Array(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
        }
        if (type === "bool") {
            const data = new BoolArray(buffer);
            return shape.length > 0 ? { data, shape } satisfies Tensor : !!data[0];
        }
        if (type === "string")
            return new TextDecoder().decode(buffer);
        if (type === "list" || type === "dict") {
            const json = new TextDecoder().decode(buffer);
            return JSON.parse(json);
        }
        if (type === "image") // INCOMPLETE
            throw new Error("Failed to deserialize image because it is not yet supported");
        if (type === "binary")
            return buffer;
        throw new Error(`Failed to deserialize value with type \`${type}\` because it is not supported`);
    }

    private async upload({
        buffer,
        mime = "application/octet-stream"
    }: UploadInput): Promise<string> {
        return `data:${mime};base64,${encode(buffer)}`;
    }

    private async download(url: string): Promise<ArrayBuffer> {
        if (url.startsWith("data:"))
            return decode(url.split(",")[1]);
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return buffer;
    }
}

interface ToValueInput {
    object: Value;
}

interface UploadInput {
    buffer: ArrayBuffer;
    mime?: string;
}

async function downloadPrediction(prediction: RemotePrediction): Promise<Prediction> {
    const results = prediction.results && await Promise.all(prediction.results.map(downloadValue));
    return { ...prediction, results };
}

async function downloadValue({ data: url, type}: RemoteValue): Promise<Value> { // INCOMPLETE
    const shape: number[] = []; // INCOMPLETE // Shape handling
    if (type === "null")
        return null;
    const buffer = await download(url);
    if (type === "bfloat16")
        throw new Error("Failed to deserialize value because JavaScript does not support bfloat16");
    if (type === "float16")
        throw new Error("Failed to deserialize value because JavaScript does not support half-precision floating point numbers");
    if (type === "float32") {
        const data = new Float32Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "float64") {
        const data = new Float64Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "int8") {
        const data = new Int8Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "int16") {
        const data = new Int16Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "int32") {
        const data = new Int32Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "int64") {
        const data = new BigInt64Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "uint8") {
        const data = new Uint8Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "uint16") {
        const data = new Uint16Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "uint32") {
        const data = new Uint32Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "uint64") {
        const data = new BigUint64Array(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : data[0];
    }
    if (type === "bool") {
        const data = new BoolArray(buffer);
        return shape.length > 0 ? { data, shape } satisfies Tensor : !!data[0];
    }
    if (type === "string")
        return new TextDecoder().decode(buffer);
    if (type === "list" || type === "dict") {
        const json = new TextDecoder().decode(buffer);
        return JSON.parse(json);
    }
    if (type === "image") // INCOMPLETE
        throw new Error("Failed to deserialize image because it is not yet supported");
    if (type === "binary")
        return buffer;
    throw new Error(`Failed to deserialize value with type \`${type}\` because it is not supported`);
}

async function download(url: string): Promise<ArrayBuffer> {
    if (url.startsWith("data:"))
        return decode(url.split(",")[1]);
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return buffer;
}

function getTypedArrayDtype(data: TypedArray): Dtype {
    if (data instanceof BoolArray)          return "bool"; // This MUST be first
    if (data instanceof Float32Array)       return "float32";
    if (data instanceof Float64Array)       return "float64";
    if (data instanceof Int8Array)          return "int8";
    if (data instanceof Int16Array)         return "int16";
    if (data instanceof Int32Array)         return "int32";
    if (data instanceof BigInt64Array)      return "int64";
    if (data instanceof Uint8Array)         return "uint8";
    if (data instanceof Uint8ClampedArray)  return "uint8";
    if (data instanceof Uint16Array)        return "uint16";
    if (data instanceof Uint32Array)        return "uint32";
    if (data instanceof BigUint64Array)     return "uint64";
    throw new Error(`Array is not TypedArray: ${data}`);
}