/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { getFxnc } from "../c"
import { MunaClient } from "../client"
import { LocalPredictionService } from "./local"

let service: LocalPredictionService | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { id, method, args } = e.data;
    try {
        if (method === "init") {
            const { accessKey, url, fxnc: fxncInput } = args[0];
            await getFxnc(fxncInput);
            const client = new MunaClient({ accessKey, url });
            service = new LocalPredictionService(client);
            self.postMessage({ id, result: true });
            return;
        }
        if (method === "stream") {
            for await (const chunk of service.stream(args[0]))
                self.postMessage({ id, chunk });
            self.postMessage({ id, done: true });
            return;
        }
        const result = await (service as any)[method](...args);
        self.postMessage({ id, result });
    } catch (err: any) {
        self.postMessage({
            id,
            error: err?.message ?? String(err),
            stack: err?.stack,
        });
    }
};
