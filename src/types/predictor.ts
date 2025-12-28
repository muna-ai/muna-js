/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { Parameter } from "./parameter"
import type { User } from "./user"

/**
 * Predictor access mode.
 */
export type PredictorAccess = "private" | "public" | "unlisted";

/**
 * Predictor status.
 */
export type PredictorStatus = "compiling" | "active" | "archived";

/**
 * Prediction function.
 */
export interface Predictor {
    /**
     * Predictor tag.
     */
    tag: string;
    /**
     * Predictor owner.
     */
    owner: User;
    /**
     * Predictor name.
     */
    name: string;
    /**
     * Predictor description.
     */
    description: string;
    /**
     * Predictor status.
     */
    status: PredictorStatus;
    /**
     * Predictor access mode.
     */
    access: PredictorAccess;
    /**
     * Predictor signature.
     */
    signature: Signature;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Predictor card.
     */
    card?: string;
    /**
     * Predictor media URL.
     * We encourage animated GIF's where possible.
     */
    media?: string;
    /**
     * Predictor license URL.
     */
    license?: string;
}

/**
 * Prediction signature.
 */
export interface Signature {
    /**
     * Prediction inputs.
     */
    inputs: Parameter[];
    /**
     * Prediction outputs.
     */
    outputs: Parameter[];
}