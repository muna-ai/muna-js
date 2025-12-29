/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
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
            ],
            acceleration: "local_auto"
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
            stream: true,
            acceleration: "local_auto"
        });
        for await (const chunk of stream) {
            expect(chunk).to.not.be.null;
        }
    }

    @mocha.test
    async "Should create text embeddings"() {
        const openai = this.muna.beta.openai;
        const response = await openai.embeddings.create({
            model: "@google/embedding-gemma",
            input: "What is the capital of France?",
            acceleration: "local_auto"
        });
        expect(response.object).to.equal("list");
        expect(response.data).to.not.be.empty;
        expect(response.data[0].object).to.equal("embedding");
        expect(response.data[0].embedding).to.be.an("array");
        expect(response.data[0].embedding[0]).to.be.a("number");
    }
}