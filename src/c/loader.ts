/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { FXNC } from "./types"

let fxnc: FXNC = undefined;
let fxncInput: GetFxncInput | undefined;
const FXNC_VERSION = "0.0.45";

export interface GetFxncInput {
    url?: string;
    version?: string;
}

/**
 * Get the input that was used (or will be used) to load FXNC.
 * `LocalWorkerPredictionService` uses this to forward the URL to the worker
 * so it loads the same build (e.g. a local threaded build instead of the CDN).
 */
export function getFxncInput(): GetFxncInput | undefined {
    return fxncInput;
}

export async function getFxnc(input?: GetFxncInput): Promise<FXNC> {
    if (fxnc)
        return fxnc;
    fxncInput ??= input;
    if (
        typeof self !== "undefined" &&
        typeof (self as any).importScripts === "function"
    )
        fxnc = await createWebWorkerFxnc(input);
    else if (
        typeof (globalThis as any).document !== "undefined"
    )
        fxnc = await createWebFxnc(input);
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

function createWebFxnc(input?: GetFxncInput): Promise<FXNC> {
    const version = input?.version ?? FXNC_VERSION;
    const url = input?.url ?? `https://cdn.fxn.ai/fxnc/${version}`;
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
            // Create module
            const scriptResponse = await fetch(`${url}/Function.js`);
            const scriptBlob = await scriptResponse.blob();
            const mainScriptUrlOrBlob = URL.createObjectURL(scriptBlob);
            try {
                const fxnc = await moduleLoader({ locateFile, mainScriptUrlOrBlob });
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

async function createWebWorkerFxnc(input?: GetFxncInput): Promise<FXNC> {
    const version = input?.version ?? FXNC_VERSION;
    const url = input?.url ?? `https://cdn.fxn.ai/fxnc/${version}`;
    const name = "__fxn";
    // Polyfill localStorage before importing (some code references it at top level)
    if (typeof (globalThis as any).localStorage === "undefined") {
        const store = new Map<string, string>();
        (globalThis as any).localStorage = {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => { store.clear(); },
            get length() { return store.size; },
            key: (index: number) => [...store.keys()][index] ?? null,
        };
    }
    (self as any).importScripts(`${url}/Function.js`);
    // Polyfill `window` after import for embind code that accesses `window.navigator` at runtime.
    if (typeof (globalThis as any).window === "undefined")
        (globalThis as any).window = self;
    const moduleLoader = (self as any)[name];
    (self as any)[name] = null;
    // Create module
    const scriptResponse = await fetch(`${url}/Function.js`);
    const scriptBlob = await scriptResponse.blob();
    const mainScriptUrlOrBlob = URL.createObjectURL(scriptBlob);
    const locateFile = (path: string) => path === "Function.wasm" ? `${url}/Function.wasm` : path;
    return moduleLoader({ mainScriptUrlOrBlob, locateFile });
}

function createNodeFxnc(input?: GetFxncInput): Promise<FXNC> { // CHECK // Fix this
    const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
    (globalThis as any).__require = requireFunc;
    try { return requireFunc("../../lib/Function.node"); } catch { }
    try { return requireFunc("../../../lib/Function.node"); } catch { return null; }
}

declare var __webpack_require__: any;
declare var __non_webpack_require__: any;