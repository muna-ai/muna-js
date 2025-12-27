/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Muna, type Prediction } from "../src"

@mocha.suite("Predictions")
class PredictionTest {

    private muna: Muna;

    public before() {
        should();
        use(chaiAsPromised);
        this.muna = new Muna();
    }

    @mocha.test
    async "Should create a prediction"() {
        const prediction = await this.muna.predictions.create({
            tag: "@yusuf/area",
            inputs: { radius: 4 }
        });
        const results = prediction.results;
        expect(results).to.not.be.empty;
    }

    @mocha.test
    async "Should stream a prediction"() {
        const sentence = "The fat cat sat on the mat.";
        const stream = await this.muna.predictions.stream({
            tag: "@yusuf/generator",
            inputs: { sentence }
        });
        const predictions: Prediction[] = [];
        for await (const prediction of stream)
            predictions.push(prediction);
        expect(predictions.length).greaterThan(1);
    }
}