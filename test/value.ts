/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect } from "chai"
import { readFileSync } from "fs"
import mocha from "@testdeck/mocha"
import type { Image } from "../src"
import { getFxnc } from "../src/c"

@mocha.suite("Values")
class ValueTest {

    @mocha.test
    async "Should deserialize NPZ to tensor"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/array.npz").buffer as ArrayBuffer;
        const value = FXNValue.createFromBuffer(data, "application/vnd.muna.tensor");
        expect(value.dtype).to.equal("float64");
        expect(value.shape).to.eql([100, 100, 3]);
    }

    @mocha.test
    async "Should deserialize JPEG to image"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/cat.jpg").buffer as ArrayBuffer;
        const value = FXNValue.createFromBuffer(data, "image/*");
        expect(value).to.not.be.null;
        expect(value.dtype).to.equal("image");
        expect(value.shape).to.eql([224, 224, 3]);
    }

    @mocha.test
    async "Should deserialize WAV to audio"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/speech.wav").buffer as ArrayBuffer;
        const value = FXNValue.createFromBuffer(data, "audio/*");
        expect(value).to.not.be.null;
        expect(value.dtype).to.equal("float32");
        expect(value.shape!.length).to.eql(2);
        expect([1, 2]).to.include(value.shape![1]);
    }

    @mocha.test
    async "Should serialize tensor to NPZ"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/speech.bin").buffer as ArrayBuffer;
        const shape = [data.byteLength / Float32Array.BYTES_PER_ELEMENT, 1];
        const value = FXNValue.createArray(new Float32Array(data), shape, 0);
        const serializedData = value.serialize();
        expect(serializedData).to.be.an.instanceOf(ArrayBuffer);
    }

    @mocha.test
    async "Should serialize image to PNG"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/cat.bin").buffer as ArrayBuffer;
        const image = {
            data: new Uint8ClampedArray(data),
            width: 224,
            height: 224,
            channels: 3
        } satisfies Image;
        const value = FXNValue.createImage(image, 0);
        const serializedData = value.serialize();
        expect(serializedData).to.be.an.instanceOf(ArrayBuffer);
    }

    @mocha.test
    async "Should serialize image to JPEG"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/cat.bin").buffer as ArrayBuffer;
        const image = {
            data: new Uint8ClampedArray(data),
            width: 224,
            height: 224,
            channels: 3
        } satisfies Image;
        const value = FXNValue.createImage(image, 0);
        const serializedData = value.serialize("image/jpeg");
        expect(serializedData).to.be.an.instanceOf(ArrayBuffer);
    }

    @mocha.test
    async "Should serialize audio to WAV"() {
        const { FXNValue } = await getFxnc();
        const data = readFileSync("test/data/speech.bin").buffer as ArrayBuffer;
        const shape = [data.byteLength / Float32Array.BYTES_PER_ELEMENT, 1];
        const value = FXNValue.createArray(new Float32Array(data), shape, 0);
        const serializedData = value.serialize("audio/wav;rate=24000");
        expect(serializedData).to.be.an.instanceOf(ArrayBuffer);
    }
}