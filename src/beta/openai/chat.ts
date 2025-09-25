/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { PredictionService } from "../../services"
import type { RemotePredictionService } from "../remote"
import { ChatCompletionsService } from "./completions"

export class ChatService {

    /**
     * Create completions.
     */
    public readonly completions: ChatCompletionsService;

    public constructor(
        predictions: PredictionService,
        remotePredictions: RemotePredictionService
    ) {
        this.completions = new ChatCompletionsService(predictions, remotePredictions);
    }
}