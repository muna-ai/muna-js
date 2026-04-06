/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { RemoteValue, Value } from "./value"

/**
 * Prediction acceleration.
 */
export type Acceleration = 
    "local_auto"        |
    "local_cpu"         |
    "local_gpu"         |
    "local_npu"         |
    "remote_auto"       |
    "remote_cpu"        |
    "remote_a10"        |
    "remote_l40s"       |
    "remote_a100"       |
    "remote_h100"       |
    "remote_h200"       |
    "remote_b200"       |
    "remote_mi350x"     |
    "remote_mi355x"     |
    "remote_qaic100"    |
    (string & {});

/**
 * Prediction.
 */
export interface Prediction {
    /**
     * Prediction ID.
     */
    id: string;
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Prediction configuration.
     */
    configuration?: string;
    /**
     * Predictor resources.
     */
    resources?: PredictionResource[];
    /**
     * Prediction results.
     */
    results?: Value[];
    /**
     * Prediction latency in milliseconds.
     */
    latency?: number;
    /**
     * Prediction error.
     * This is `null` if the prediction completed successfully.
     */
    error?: string;
    /**
     * Prediction logs.
     */
    logs?: string;    
}

/**
 * Prediction resource.
 */
export interface PredictionResource {
    /**
     * Resource type.
     */
    type: string;
    /**
     * Resource URL.
     */
    url: string;
    /**
     * Resource name.
     */
    name?: string;
}

/**
 * Remote prediction.
 */
export type RemotePrediction = 
    Pick<Prediction, "id" | "tag" | "created" | "latency" | "error" | "logs"> &
    { results: RemoteValue[] };

export interface RemotePredictionEvent {
    event: "prediction";
    data: RemotePrediction;
}