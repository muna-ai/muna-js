/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import { expect, should, use } from "chai"
import chaiAsPromised from "chai-as-promised"
import mocha from "@testdeck/mocha"
import { Muna, type User } from "../src"

@mocha.suite("Users")
class UserTest {

    private muna: Muna;

    public before () {
        should();
        use(chaiAsPromised);
        this.muna = new Muna();
    }

    @mocha.test
    async "Should retrieve the current user"() {
        const user = await this.muna.users.retrieve();
        expect(user?.username).to.equal("yusuf");
    }

    @mocha.test
    async "Should retrieve no user"() {
        const muna = new Muna({ accessKey: "", url: process.env.MUNA_API_URL });
        const user = await muna.users.retrieve();
        expect(user).to.be.null;
    }
}