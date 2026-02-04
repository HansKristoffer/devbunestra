import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { isCI, sleep } from "./utils";

// ═══════════════════════════════════════════════════════════════════════════
// isCI Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("isCI", () => {
	// Store original env vars to restore after each test
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original env
		originalEnv = { ...process.env };
		// Clear all CI-related vars
		delete process.env.CI;
		delete process.env.GITHUB_ACTIONS;
		delete process.env.GITLAB_CI;
		delete process.env.CIRCLECI;
		delete process.env.JENKINS_URL;
	});

	afterEach(() => {
		// Restore original env
		process.env = originalEnv;
	});

	it("returns true when CI=true", () => {
		process.env.CI = "true";

		expect(isCI()).toBe(true);
	});

	it("returns true when CI=1", () => {
		process.env.CI = "1";

		expect(isCI()).toBe(true);
	});

	it("returns true when GITHUB_ACTIONS=true", () => {
		process.env.GITHUB_ACTIONS = "true";

		expect(isCI()).toBe(true);
	});

	it("returns true when GITLAB_CI=true", () => {
		process.env.GITLAB_CI = "true";

		expect(isCI()).toBe(true);
	});

	it("returns true when CIRCLECI=true", () => {
		process.env.CIRCLECI = "true";

		expect(isCI()).toBe(true);
	});

	it("returns true when JENKINS_URL is set", () => {
		process.env.JENKINS_URL = "http://jenkins.example.com";

		expect(isCI()).toBe(true);
	});

	it("returns false when no CI env vars are set", () => {
		expect(isCI()).toBe(false);
	});

	it("returns false when CI=false", () => {
		process.env.CI = "false";

		expect(isCI()).toBe(false);
	});

	it("returns false when CI is empty string", () => {
		process.env.CI = "";

		expect(isCI()).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// sleep Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("sleep", () => {
	it("resolves after specified time", async () => {
		const start = Date.now();

		await sleep(50);

		const elapsed = Date.now() - start;
		// Allow some tolerance for timing
		expect(elapsed).toBeGreaterThanOrEqual(45);
		expect(elapsed).toBeLessThan(150);
	});

	it("resolves immediately for 0ms", async () => {
		const start = Date.now();

		await sleep(0);

		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(50);
	});
});
