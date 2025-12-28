/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { Value } from "./value"

/**
 * Prediction acceleration.
 */
export type Acceleration = "local_auto" | "local_cpu" | "local_gpu" | "local_npu";

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