/*
*   Muna
*   Copyright © 2026 NatML Inc. All Rights Reserved.
*/

/**
 * Muna user.
 */
export interface User {
    /**
     * Muna username.
     * This is always lowercase and uniquely identifies a user account.
     */
    username: string;
    /**
     * Date created.
     */
    created: Date;
    /**
     * Full name.
     */
    name?: string;
    /**
     * User avatar URL.
     */
    avatar?: string;
    /**
     * User bio.
     */
    bio?: string;
    /**
     * User website.
     */
    website?: string;
    /**
     * User GitHub.
     */
    github?: string;
}