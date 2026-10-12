/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
	// Stop `next dev` (16.3+) from generating a root AGENTS.md; agent guidance lives in CLAUDE.md.
	agentRules: false,
};

export default config;
