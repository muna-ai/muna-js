/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Muna } from "../src"

@mocha.suite("Remote Predictions")
class RemotePredictionTest {

    private muna: Muna;

    public before () {
        should();
        use(chaiAsPromised);
        this.muna = new Muna();
    }

    @mocha.test
    async "Should create a remote prediction"() {
        const prediction = await this.muna.beta.predictions.remote.create({
            tag: "@fxn/greeting",
            inputs: { name: "Yusuf" }
        });
        const results = prediction.results;
        expect(results).to.not.be.empty;
    }
}