/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { Dtype, Image, PredictionResource, Tensor, TypedArray } from "../types"

declare global {
    
    function FXNGetVersion(): string;

    class FXNConfiguration {
        tag: string | null;
        token: string | null;
        acceleration: number;
        addResource(resource: PredictionResource): Promise<void>;
        dispose(): void;
        static create(): FXNConfiguration;
        static getClientId(): string;
        static getUniqueId(): string;
    }

    class FXNValue {
        readonly data: ArrayBuffer | null;
        readonly dtype: Dtype;
        readonly shape: number[] | null;
        serialize(mime?: string): ArrayBuffer;
        toObject(): number | string | boolean | Tensor | Image | any[] | Record<string, any> | ArrayBuffer;
        dispose(): void;
        static createArray(data: TypedArray, shape: number[] | null, flags: number): FXNValue;
        static createString(data: string): FXNValue;
        static createList(data: any[]): FXNValue;
        static createDict(data: Record<string, any>): FXNValue;
        static createImage(image: Image, flags: number): FXNValue;
        static createImageList(images: Image[], flags: number): FXNValue;
        static createBinary(data: ArrayBuffer, flags: number): FXNValue;
        static createNull(): FXNValue;
        static createFromBuffer(data: ArrayBuffer, mime: string): FXNValue;
    }

    class FXNValueMap {
        readonly size: number;
        key(index: number): string;
        get(key: string): FXNValue;
        set(key: string, value: FXNValue | null): void;
        dispose(): void;
        static create(): FXNValueMap;
    }

    class FXNPrediction {
        readonly id: string;
        readonly latency: number;
        readonly results: FXNValueMap | null;
        readonly error: string | null;
        readonly logs: string | null;
        dispose(): void;
    }

    class FXNPredictionStream {
        readNext(): FXNPrediction | null;
        dispose(): void;
    }

    class FXNPredictor {
        createPrediction(inputs: FXNValueMap): FXNPrediction;
        streamPrediction(inputs: FXNValueMap): FXNPredictionStream;
        dispose(): void;
        static create(configuration: FXNConfiguration): FXNPredictor;
    }
}

export interface FXNC {
    FXNGetVersion: typeof FXNGetVersion;
    FXNConfiguration: typeof FXNConfiguration;
    FXNValue: typeof FXNValue;
    FXNValueMap: typeof FXNValueMap;
    FXNPrediction: typeof FXNPrediction;
    FXNPredictionStream: typeof FXNPredictionStream;
    FXNPredictor: typeof FXNPredictor;
}