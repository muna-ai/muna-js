/*
*   Muna
*   Copyright © 2025 NatML Inc. All Rights Reserved.
*/

import type { MunaAPIError, MunaClient } from "../client"
import type { User } from "../types"

export class UserService {

    private readonly client: MunaClient;

    public constructor(client: MunaClient) {
        this.client = client;
    }

    /**
     * Retrieve a user.
     * @param input Input arguments. If `null` then this will retrieve the currently authenticated user.
     * @returns User.
     */
    public async retrieve(): Promise<User | null> {
        try {
            const user = await this.client.request<User>({ path: "/users" });
            return user;
        } catch (error: unknown) {
            if ((error as MunaAPIError).status === 401)
                return null;
            throw error;
        }
    }
}