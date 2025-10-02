/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { Dtype } from "./dtype"
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

export type ParameterDenotation = "audio" | "embedding" | "embedding.dims";

/**
 * Prediction parameter.
 * This describes a value that is consumed or produced by a predictor.
 */
export interface Parameter {
    /**
     * Parameter name.
     */
    name: string;
    /**
     * Parameter type.
     * This is `null` if the type is unknown or unsupported by Muna.
     */
    type?: Dtype;
    /**
     * Parameter description.
     */
    description?: string;
    /**
     * Parameter denotation for specialized data types.
     */
    denotation?: ParameterDenotation;
    /**
     * Parameter is optional.
     */
    optional?: boolean;
    /**
     * Parameter value range for numeric parameters.
     */
    range?: [number, number];
    /**
     * Parameter value choices for enumeration parameters.
     */
    enumeration?: EnumerationMember[];
    /**
     * Parameter JSON schema.
     * This is only populated for `list` and `dict` parameters.
     */
    schema?: Record<string, any>;
}

/**
 * Prediction parameter enumeration member.
 */
export interface EnumerationMember {
    /**
     * Enumeration member name.
     */
    name: string;
    /**
     * Enumeration member value.
     */
    value: string | number;
}