/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Muna } from "../src"

@mocha.suite("Predictors")
class PredictorTest {

    private muna: Muna;

    public before () {
        should();
        use(chaiAsPromised);
        this.muna = new Muna();
    }

    @mocha.test
    async "Should retrieve a predictor"() {
        const tag = "@yusuf/identity";
        const predictor = await this.muna.predictors.retrieve({ tag });
        expect(predictor?.tag).to.equal(tag);
    }

    @mocha.test
    async "Should retrieve a non-existent predictor"() {
        const predictor = await this.muna.predictors.retrieve({ tag: "@yusuf/404" });
        expect(predictor).to.be.null;
    }
}