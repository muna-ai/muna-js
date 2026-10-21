/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

/**
 * Classify a predictor's `prediction.error` string.
 *
 * Predictors raise Python exceptions; the runtime formats them as
 * `Type: message`, optionally preceded by a traceback and a chain of causes
 * (innermost first). Python's caller-fault exceptions (`ValueError` and
 * `TypeError`) become a `TypeError` carrying only the message, since the
 * traceback belongs in server logs rather than a caller-facing error. Anything
 * else is an opaque `Error` with the full text. Mirrors
 * `prediction_error_to_exception` in muna-py and
 * `MunaError::from_prediction_error` in muna-rs.
 */
export function predictionErrorToError(error: string): Error {
    // The outermost exception is the last one in the chain; only its first
    // non-traceback line carries the `Type: message` header.
    const outermost = error.split(CAUSE_SEPARATOR).pop() ?? "";
    const header = outermost
        .split("\n")
        .find(line => line && !line.startsWith(" ") && !line.startsWith("Traceback")) ?? "";
    const separator = header.indexOf(": ");
    if (separator >= 0 && CALLER_FAULTS.has(header.slice(0, separator)))
        return new TypeError(header.slice(separator + 2).trim());
    return new Error(error);
}

const CAUSE_SEPARATOR = "\n\nThe above exception was the direct cause of the following exception:\n\n";
const CALLER_FAULTS = new Set(["ValueError", "TypeError"]);
