/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { FXNC } from "./types"

let fxnc: FXNC = undefined;

export interface GetFxncInput {
    url?: string;
    version?: string;
}

export async function getFxnc(input?: GetFxncInput): Promise<FXNC> {
    if (fxnc)
        return fxnc;
    if (
        typeof window !== "undefined" &&
        typeof window.document !== "undefined"
    )
        fxnc = await createWasmFxnc(input);
    else if (
        typeof process !== "undefined" &&
        process.versions != null &&
        process.versions.node != null
    )
        fxnc = await createNodeFxnc(input);
    else
        throw new Error("Failed to load Muna implementation because current environment is not supported");
    return fxnc;
}

function createWasmFxnc(input?: GetFxncInput): Promise<FXNC> {
    const {
        version = "0.0.39",
        url = `https://cdn.fxn.ai/fxnc/${version}`
    } = input ?? { };
    return new Promise<FXNC>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `${url}/Function.js`;
        script.onerror = error => reject(`Failed to load Muna implementation for in-browser predictions with error: ${error}`);
        script.onload = async () => {
            // Get loader
            const name = "__fxn";
            const locateFile = (path: string) => path === "Function.wasm" ? `${url}/Function.wasm` : path;
            const moduleLoader = (window as any)[name];
            (window as any)[name] = null;
            // Load
            try {
                const fxnc = await moduleLoader({ locateFile });
                resolve(fxnc);
            } catch (error) {
                reject(`Failed to load Muna implementation for in-browser predictions with error: ${error}`);
            } finally {
                script.remove();
            }
        };
        document.body.appendChild(script);
    });
}

function createNodeFxnc(input?: GetFxncInput): Promise<FXNC> { // CHECK // Fix this
    const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
    (globalThis as any).__require = requireFunc;
    try { return requireFunc("../../lib/Function.node"); } catch { }
    try { return requireFunc("../../../lib/Function.node"); } catch { return null; }
}

declare var __webpack_require__: any;
declare var __non_webpack_require__: any;