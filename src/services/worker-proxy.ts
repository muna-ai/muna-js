/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

interface PendingCall {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

interface StreamController {
    push: (value: any) => void;
    finish: () => void;
    error: (reason: any) => void;
}

/**
 * Generic RPC proxy over a Web Worker. Post `{ id, method, args }` messages
 * and resolve the matching promise when `{ id, result }` or `{ id, error }`
 * comes back. Works with any worker that follows this message protocol.
 *
 * Pass a pre-constructed Worker so that bundlers (webpack/turbopack) can
 * statically detect the `new Worker(new URL(...))` pattern at the call site.
 */
export class WorkerProxy {

    private worker: Worker;
    private nextId = 0;
    private pending = new Map<number, PendingCall>();
    private streams = new Map<number, StreamController>();

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            const { id, result, error, stack, chunk, done } = e.data;
            const stream = this.streams.get(id);
            if (stream) {
                if (error !== undefined) {
                    const err = new Error(error);
                    if (stack) err.stack = stack;
                    this.streams.delete(id);
                    stream.error(err);
                } else if (done) {
                    this.streams.delete(id);
                    stream.finish();
                } else if (chunk !== undefined) {
                    stream.push(chunk);
                }
                return;
            }
            const p = this.pending.get(id);
            if (!p)
                return;
            this.pending.delete(id);
            if (error !== undefined) {
                const err = new Error(error);
                if (stack) err.stack = stack;
                p.reject(err);
            } else {
                p.resolve(result);
            }
        };
        this.worker.onerror = (e) => {
            console.error("[WorkerProxy] uncaught worker error:", e);
        };
    }

    call<T>(method: string, ...args: unknown[]): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, method, args });
        });
    }

    async * callStream<T>(method: string, ...args: unknown[]): AsyncGenerator<T> {
        const id = this.nextId++;
        const queue: T[] = [];
        let resolve: (() => void) | null = null;
        let finished = false;
        let streamError: Error | null = null;
        this.streams.set(id, {
            push: (value: T) => {
                queue.push(value);
                resolve?.();
                resolve = null;
            },
            finish: () => {
                finished = true;
                resolve?.();
                resolve = null;
            },
            error: (err: Error) => {
                streamError = err;
                resolve?.();
                resolve = null;
            },
        });
        this.worker.postMessage({ id, method, args });
        try {
            while (true) {
                while (queue.length > 0)
                    yield queue.shift()!;
                if (finished)
                    break;
                if (streamError)
                    throw streamError;
                await new Promise<void>(r => { resolve = r; });
            }
        } finally {
            this.streams.delete(id);
        }
    }

    terminate() {
        this.worker.terminate();
        for (const p of this.pending.values())
            p.reject(new Error("Worker terminated"));
        this.pending.clear();
        for (const s of this.streams.values())
            s.error(new Error("Worker terminated"));
        this.streams.clear();
    }
}
