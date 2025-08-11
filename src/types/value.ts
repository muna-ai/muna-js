/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

/**
 * Value data type.
 */
export type Dtype =
    "bfloat16"  |
    "float16"   |
    "float32"   |
    "float64"   |
    "int8"      |
    "int16"     |
    "int32"     |
    "int64"     |
    "uint8"     |
    "uint16"    |
    "uint32"    |
    "uint64"    |
    "bool"      |
    "string"    |
    "list"      |
    "dict"      |
    "image"     |
    "audio"     |
    "video"     |
    "model"     |
    "binary"    |
    "null";

/**
 * Boolean typed array.
 */
export class BoolArray extends Uint8Array {

    constructor(values: ArrayBuffer | boolean[]) {
        super(Array.isArray(values) ? values.map(v => +v) : values);
    }
}

Object.defineProperty(
    BoolArray,
    "name",
    { value: "BoolArray", writable: false }
);

/**
 * A `TypedArray` instance.
 */
export type TypedArray =
    Float32Array        |
    Float64Array        |
    Int8Array           |
    Int16Array          |
    Int32Array          |
    BigInt64Array       |
    Uint8Array          |
    Uint8ClampedArray   |
    Uint16Array         |
    Uint32Array         |
    BigUint64Array      |
    BoolArray;

/**
 * Image.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ImageData
 */
export interface Image {
    /**
     * Pixel buffer.
     */
    data: Uint8ClampedArray;
    /**
     * Image width.
     */
    width: number;
    /**
     * Image height.
     */
    height: number;
    /**
     * Image channels.
     */
    channels: number;
}

/**
 * Tensor.
 */
export interface Tensor {
    /**
     * Tensor data.
     */
    data: TypedArray;
    /**
     * Tensor shape.
     */
    shape: number[];
}

/**
 * Prediction value.
 */
export type Value =
    string                          |
    number                          |
    number[]                        |
    bigint                          |
    boolean                         |
    boolean[]                       |
    (string | number | boolean)[]   |
    { [key: string]: any }          |
    TypedArray                      |
    Tensor                          |
    Image                           |
    ArrayBuffer                     |
    null;

/**
 * Check whether an input value is a Muna `Tensor`.
 * @param value Input value.
 * @returns Whether the input value is a tensor.
 */
export function isTensor(value: any): value is Tensor {
    return value != null            &&
        isTypedArray(value.data)    &&
        Array.isArray(value.shape);
}

/**
 * Check whether an input value is a Muna `Image`.
 * @param value Input value.
 * @returns Whether the input value is an image.
 */
export function isImage(value: any): value is Image {
    return value != null                                &&
        (
            value.data instanceof Uint8Array            ||
            value.data instanceof Uint8ClampedArray
        )                                               &&
        Number.isInteger(value.width)                   &&
        Number.isInteger(value.height)                  &&
        [1, 3, 4].includes(value.channels);
}

/**
 * Check whether an input value is a `TypedArray`
 * @param value Input value.
 * @returns Whether the input value is a typed array.
 */
export function isTypedArray(value: any): value is TypedArray {
    if (value instanceof Float32Array)      return true;
    if (value instanceof Float64Array)      return true;
    if (value instanceof Int8Array)         return true;
    if (value instanceof Int16Array)        return true;
    if (value instanceof Int32Array)        return true;
    if (value instanceof BigInt64Array)     return true;
    if (value instanceof Uint8Array)        return true;
    if (value instanceof Uint8ClampedArray) return true;
    if (value instanceof Uint16Array)       return true;
    if (value instanceof Uint32Array)       return true;
    if (value instanceof BigUint64Array)    return true;
    return false;
}