/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import { readFileSync } from "fs"
import mocha from "@testdeck/mocha"
import { Muna } from "../src"

@mocha.suite("OpenAI Client")
class OpenAITest {

    private muna: Muna;

    public before() {
        should();
        use(chaiAsPromised);
        this.muna = new Muna();
    }

    @mocha.test
    async "Should create a chat completion"() {
        const openai = this.muna.beta.openai;
        const response = await openai.chat.completions.create({
            model: "@openai/gpt-oss-20b",
            messages: [
                { role: "user", content: "What is the capital of France?" }
            ]
        });
        expect(response).to.not.be.null;
    }

    @mocha.test
    async "Should create a chat completion on datacenter GPU"() {
        const openai = this.muna.beta.openai;
        const response = await openai.chat.completions.create({
            model: "@openai/gpt-oss-20b",
            messages: [
                { role: "user", content: "What is the capital of France?" }
            ],
            acceleration: "remote_a100"
        });
        expect(response).to.not.be.null;
    }

    @mocha.test
    async "Should stream a chat completion"() {
        const openai = this.muna.beta.openai;
        const stream = await openai.chat.completions.create({
            model: "@openai/gpt-oss-20b",
            messages: [
                { role: "user", content: "What is the capital of France?" }
            ],
            stream: true
        });
        for await (const chunk of stream) {
            expect(chunk).to.not.be.null;
        }
    }

    @mocha.test
    async "Should create speech"() {
        const openai = this.muna.beta.openai;
        const response = await openai.audio.speech.create({
            model: "@kitten-ml/kitten-tts",
            input: "What a time to be alive",
            voice: "expr-voice-2-m"
        });
        expect(response.headers.get("content-type")?.startsWith("audio/mp3"));
    }

    @mocha.test
    async "Should transcribe audio"() {
        const openai = this.muna.beta.openai;
        const transcription = await openai.audio.transcriptions.create({
            model: "@moonshine/moonshine-base",
            file: readFileSync("test/data/librispeech_sample.wav")
        });
        expect(transcription).to.not.be.null;
        expect(transcription.text).to.be.a("string");
        expect(transcription.text.length).to.be.greaterThan(0);
        expect(transcription.usage).to.not.be.null;
        expect(transcription.usage.type).to.equal("duration");
        expect((transcription.usage as { seconds: number }).seconds).to.be.a("number");
    }

    @mocha.test
    async "Should create text embeddings"() {
        const openai = this.muna.beta.openai;
        const response = await openai.embeddings.create({
            model: "@google/embedding-gemma",
            input: "What is the capital of France?"
        });
        expect(response.object).to.equal("list");
        expect(response.data).to.not.be.empty;
        expect(response.data[0].object).to.equal("embedding");
        expect(response.data[0].embedding).to.be.an("array");
        expect(response.data[0].embedding[0]).to.be.a("number");
    }

    @mocha.test.skip
    async "Should generate an image"() {
        const openai = this.muna.beta.openai;
        const response = await openai.images.create({
            model: "@black-forest-labs/flux.1-schnell",
            prompt: "A photo of a cat sitting on a windowsill at sunset"
        });
        expect(response).to.not.be.null;
        expect(response.data).to.be.an("array");
        expect(response.data!.length).to.be.greaterThan(0);
        expect(response.data![0].b64_json).to.be.a("string");
        expect(response.created).to.be.a("number");
    }
}