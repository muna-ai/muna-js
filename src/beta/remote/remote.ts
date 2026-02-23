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
                await createRemoteValue(object)
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
        const prediction = await parseRemotePrediction(remotePrediction);
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
                await createRemoteValue({ object })
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
            const prediction = await parseRemotePrediction(event.data);
            yield prediction;
        }
    }
}

async function createRemoteValue(object: Value): Promise<RemoteValue> {
    const { FXNValue } = await getFxnc();
    if (object === null)
        return { data: null, dtype: "null" };
    if (typeof(object) === "number") {
        const type: Dtype = Number.isInteger(object) ? "int32" : "float32";
        const data = type === "int32" ? new Int32Array([ object ]) : new Float32Array([ object ]);
        const tensor: Tensor = { data, shape: [] };
        return await createRemoteValue(tensor);
    }
    if (typeof(object) === "boolean") {
        const data = new BoolArray([ object ]);
        const tensor: Tensor = { data, shape: [] };
        return await createRemoteValue(tensor);
    }
    if (isTypedArray(object)) {
        const tensor: Tensor = { data: object, shape: [object.length] };
        return await createRemoteValue(tensor);
    }
    if (isTensor(object)) {
        const value = FXNValue.createArray(object.data, object.shape, 0);
        const buffer = value.serialize();
        value.dispose();
        const data = await uploadValueData({ buffer });
        const dtype = getTypedArrayDtype(object.data);
        return { data, dtype };
    }
    if (typeof(object) === "string") {
        const buffer = new TextEncoder().encode(object).buffer;
        const data = await uploadValueData({ buffer, mime: "text/plain" });
        return { data, dtype: "string" };
    }
    if (Array.isArray(object)) {
        const listStr = JSON.stringify(object);
        const buffer = new TextEncoder().encode(listStr).buffer;
        const data = await uploadValueData({ buffer, mime: "application/json" });
        return { data, dtype: "list" };
    }
    if (isImage(object)) {
        const value = FXNValue.createImage(object, 0);
        const buffer = value.serialize();
        value.dispose();
        const data = await uploadValueData({ buffer, mime: "image/png" });
        return { data, dtype: "image" };
    }
    if (object instanceof ArrayBuffer) {
        const data = await uploadValueData({ buffer: object });
        return { data, dtype: "binary" };
    }
    if (typeof(object) === "object") {
        const dictStr = JSON.stringify(object);
        const buffer = new TextEncoder().encode(dictStr).buffer;
        const data = await uploadValueData({ buffer, mime: "application/json" });
        return { data, dtype: "dict" };
    }
    throw new Error(`Failed to serialize value '${object}' of type \`${typeof(object)}\` because it is not supported`);
}

async function parseRemoteValue({ data: url, dtype }: RemoteValue): Promise<Value> {
    const { FXNValue } = await getFxnc();
    if (dtype === "null")
        return null;
    const buffer = await downloadValueData(url);
    if (dtype === "bfloat16")
        throw new Error("Failed to deserialize value because JavaScript does not support bfloat16");
    if (dtype === "float16")
        throw new Error("Failed to deserialize value because JavaScript does not support half-precision floating point numbers");
    if (TENSOR_DTYPES.includes(dtype)) {
        const value = FXNValue.createFromBuffer(buffer, "application/vnd.muna.tensor");
        const object = value.toObject();
        value.dispose();
        return object;
    }
    if (dtype === "string")
        return new TextDecoder().decode(buffer);
    if (dtype === "list" || dtype === "dict") {
        const json = new TextDecoder().decode(buffer);
        return JSON.parse(json);
    }
    if (dtype === "image") {
        const value = FXNValue.createFromBuffer(buffer, "image/png");
        const object = value.toObject();
        value.dispose();
        return object;
    }
    if (dtype === "binary")
        return buffer;
    throw new Error(`Failed to deserialize value with type \`${dtype}\` because it is not supported`);
}

async function parseRemotePrediction(prediction: RemotePrediction): Promise<Prediction> {
    const results = (
        prediction.results &&
        await Promise.all(prediction.results.map(parseRemoteValue))
    );
    return { ...prediction, results };
}

async function uploadValueData({
    buffer,
    mime = "application/octet-stream"
}: { buffer: ArrayBuffer, mime?: string }): Promise<string> {
    return `data:${mime};base64,${encode(buffer)}`;
}

async function downloadValueData(url: string): Promise<ArrayBuffer> {
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

const TENSOR_DTYPES: Dtype[] = [
    "bfloat16", "float16", "float32", "float64",
    "int8", "int16", "int32", "int64",
    "uint8", "uint16", "uint32", "uint64",
    "bool"
] as const;