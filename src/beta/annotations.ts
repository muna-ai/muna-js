/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { Dtype, Parameter } from "../types"

export const INTEGER_DTYPES: Dtype[] = [
    "int8", "int16", "int32", "int64",
    "uint8", "uint16", "uint32", "uint64"
];

export const FLOAT_DTYPES: Dtype[] = ["float32", "float64"];

export interface GetParameterInput {
    /**
     * Data type or set of data types to accept.
     */
    dtype: Dtype | Dtype[];
    /**
     * Parameter denotation.
     * When omitted, any denotation is accepted.
     */
    denotation?: string;
}

/**
 * Get the first parameter with the given data type and denotation.
 * Mirrors `get_parameter` in muna-py (`muna/beta/annotations.py`).
 * @returns Parameter index and parameter, or `[null, null]` if no parameter matches.
 */
export function getParameter(
    parameters: Parameter[],
    { dtype, denotation }: GetParameterInput
): [number, Parameter] | [null, null] {
    const dtypes = Array.isArray(dtype) ? dtype : [dtype];
    const index = parameters.findIndex(param =>
        dtypes.includes(param.dtype) &&
        (!denotation || param.denotation === denotation)
    );
    return index >= 0 ? [index, parameters[index]] : [null, null];
}
