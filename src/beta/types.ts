/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

/**
 * Audio buffer.
 */
export interface Audio {
    /**
     * Linear PCM audio samples with shape `(F,C)`.
     */
    samples: Float32Array;
    /**
     * Audio sample rate.
     */
    sampleRate: number;
    /**
     * Audio channel count.
     */
    channelCount: number;
}

/**
 * Check whether an input value is an `Audio` buffer.
 * @param value Input value.
 * @returns Whether the input value is an audio buffer.
 */
export function isAudio(value: any): value is Audio {
    return value != null                                &&
        value.samples instanceof Float32Array           &&
        Number.isInteger(value.sampleRate)              &&
        Number.isInteger(value.channelCount)            &&
        value.sampleRate > 0                            &&
        value.channelCount > 0;
}
