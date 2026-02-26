import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_FILES, clearDevEnvCache, findConfigFile, getDevEnv } from ".";

// ═══════════════════════════════════════════════════════════════════════════
// findConfigFile Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("findConfigFile", () => {
	let testDir: string;

	beforeEach(() => {
		// Create a unique temp directory for each test
		testDir = join(tmpdir(), `buncargo-test-${Date.now()}-${Math.random()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up temp directory
		rmSync(testDir, { recursive: true, force: true });
	});

	it("finds config file in the current directory", () => {
		const configPath = join(testDir, "dev.config.ts");
		writeFileSync(configPath, "export default {}");

		const result = findConfigFile(testDir);

		expect(result).toBe(configPath);
	});

	it("finds config file in parent directory", () => {
		const subDir = join(testDir, "packages", "app");
		mkdirSync(subDir, { recursive: true });

		const configPath = join(testDir, "dev.config.ts");
		writeFileSync(configPath, "export default {}");

		const result = findConfigFile(subDir);

		expect(result).toBe(configPath);
	});

	it("finds config file multiple levels up", () => {
		const deepDir = join(testDir, "packages", "apps", "web", "src");
		mkdirSync(deepDir, { recursive: true });

		const configPath = join(testDir, "dev.config.ts");
		writeFileSync(configPath, "export default {}");

		const result = findConfigFile(deepDir);

		expect(result).toBe(configPath);
	});

	it("prefers config in current directory over parent", () => {
		const subDir = join(testDir, "packages", "app");
		mkdirSync(subDir, { recursive: true });

		// Config in root
		writeFileSync(join(testDir, "dev.config.ts"), "export default {}");
		// Config in subdirectory
		const subConfigPath = join(subDir, "dev.config.ts");
		writeFileSync(subConfigPath, "export default {}");

		const result = findConfigFile(subDir);

		expect(result).toBe(subConfigPath);
	});

	it("returns null when no config file exists", () => {
		const result = findConfigFile(testDir);

		expect(result).toBeNull();
	});

	it("finds dev.config.js when dev.config.ts is missing", () => {
		const configPath = join(testDir, "dev.config.js");
		writeFileSync(configPath, "module.exports = {}");

		const result = findConfigFile(testDir);

		expect(result).toBe(configPath);
	});

	it("finds dev-tools.config.ts as alternative name", () => {
		const configPath = join(testDir, "dev-tools.config.ts");
		writeFileSync(configPath, "export default {}");

		const result = findConfigFile(testDir);

		expect(result).toBe(configPath);
	});

	it("prefers dev.config.ts over dev.config.js", () => {
		writeFileSync(join(testDir, "dev.config.js"), "module.exports = {}");
		const tsConfigPath = join(testDir, "dev.config.ts");
		writeFileSync(tsConfigPath, "export default {}");

		const result = findConfigFile(testDir);

		expect(result).toBe(tsConfigPath);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG_FILES Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("CONFIG_FILES", () => {
	it("contains expected config file names", () => {
		expect(CONFIG_FILES).toContain("dev.config.ts");
		expect(CONFIG_FILES).toContain("dev.config.js");
		expect(CONFIG_FILES).toContain("dev-tools.config.ts");
		expect(CONFIG_FILES).toContain("dev-tools.config.js");
	});

	it("has .ts files before .js files for priority", () => {
		const tsIndex = CONFIG_FILES.indexOf("dev.config.ts");
		const jsIndex = CONFIG_FILES.indexOf("dev.config.js");

		expect(tsIndex).toBeLessThan(jsIndex);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getDevEnv / clearDevEnvCache Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getDevEnv", () => {
	afterEach(() => {
		clearDevEnvCache();
	});

	it("throws when environment not loaded", () => {
		expect(() => getDevEnv()).toThrow(
			"Dev environment not loaded. Call loadDevEnv() first.",
		);
	});
});

describe("clearDevEnvCache", () => {
	it("clears the cached environment", () => {
		// After clearing, getDevEnv should throw
		clearDevEnvCache();

		expect(() => getDevEnv()).toThrow();
	});
});
