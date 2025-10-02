/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
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
        const openai = this.muna.beta.openai
        const stream = await openai.chat.completions.create({
            model: "@yusuf/llama-stream",
            messages: [
                { role: "user", content: "What is the capital of France?" }
            ],
            stream: true
        });
        for await (const chunk of stream) {
            expect(chunk).to.not.be.null;
        }
    }
}