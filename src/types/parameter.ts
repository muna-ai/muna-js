/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { Dtype } from "./dtype"

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
     * Parameter data type.
     * This is `null` if the type is unknown or unsupported by Muna.
     */
    dtype?: Dtype;
    /**
     * Parameter description.
     */
    description?: string;
    /**
     * Parameter denotation for specialized data types.
     */
    denotation?: string;
    /**
     * Parameter is optional.
     */
    optional?: boolean;
    /**
     * Parameter value choices for enumeration parameters.
     */
    enumeration?: EnumerationMember[];
    /**
     * Parameter JSON schema.
     * This is only populated for `list` and `dict` parameters.
     */
    schema?: Record<string, any>;
    /**
     * Parameter minimum value.
     */
    min?: number;
    /**
     * Parameter maximum value.
     */
    max?: number;
    /**
     * Audio sample rate in Hertz.
     */
    sampleRate?: number;
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