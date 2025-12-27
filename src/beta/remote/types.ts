/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { Dtype, Prediction } from "../../types"

export type RemoteAcceleration = "remote_auto" | "remote_cpu" | "remote_a40" | "remote_a100";

export interface RemoteValue {
    data: string | null;
    type: Dtype;
}

export type RemotePrediction = 
    Pick<Prediction, "id" | "tag" | "created" | "latency" | "error" | "logs"> &
    { results: RemoteValue[] };

export interface RemotePredictionEvent {
    event: "prediction";
    data: RemotePrediction;
}