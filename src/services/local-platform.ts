/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { Prediction } from "../types"
import { LocalPredictionService } from "./local"
import type { CreatePredictionInput, DeletePredictionInput } from "./prediction"

export interface LocalPredictionLike {
    create(input: CreatePredictionInput): Promise<Prediction>;
    stream(input: CreatePredictionInput): AsyncGenerator<Prediction>;
    delete(input: DeletePredictionInput): Promise<boolean>;
}

export function createLocalPredictionService(client: MunaClient): LocalPredictionLike {
    return new LocalPredictionService(client);
}
