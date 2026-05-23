/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import type { MunaClient } from "../client"
import type { LocalPredictionLike } from "./local-platform"
import { LocalWorkerPredictionService } from "./local_worker"

export function createLocalPredictionService(client: MunaClient): LocalPredictionLike {
    return new LocalWorkerPredictionService(client);
}
