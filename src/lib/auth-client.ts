import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

// baseURL omitted → defaults to same-origin (no client env var needed).
export const authClient = createAuthClient({
	plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
