import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import {
	getHeartbeatFile,
	getWatchdogComposeArg,
	getWatchdogPidFile,
	readHeartbeat,
	removeHeartbeatFile,
} from "./watchdog";

// ═══════════════════════════════════════════════════════════════════════════
// getHeartbeatFile Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getHeartbeatFile", () => {
	it("returns correct path for project name", () => {
		const result = getHeartbeatFile("myapp");

		expect(result).toBe("/tmp/myapp-heartbeat");
	});

	it("handles project names with hyphens", () => {
		const result = getHeartbeatFile("my-app-project");

		expect(result).toBe("/tmp/my-app-project-heartbeat");
	});

	it("handles project names with numbers", () => {
		const result = getHeartbeatFile("myapp123");

		expect(result).toBe("/tmp/myapp123-heartbeat");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getWatchdogPidFile Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getWatchdogPidFile", () => {
	it("returns correct path for project name", () => {
		const result = getWatchdogPidFile("myapp");

		expect(result).toBe("/tmp/myapp-watchdog.pid");
	});

	it("handles project names with hyphens", () => {
		const result = getWatchdogPidFile("my-app-project");

		expect(result).toBe("/tmp/my-app-project-watchdog.pid");
	});

	it("handles project names with numbers", () => {
		const result = getWatchdogPidFile("myapp123");

		expect(result).toBe("/tmp/myapp123-watchdog.pid");
	});
});

describe("getWatchdogComposeArg", () => {
	it("returns empty string when compose file is missing", () => {
		expect(getWatchdogComposeArg()).toBe("");
	});

	it("returns quoted compose -f arg for generated file", () => {
		expect(
			getWatchdogComposeArg(".buncargo/docker-compose.generated.yml"),
		).toBe('-f ".buncargo/docker-compose.generated.yml"');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// readHeartbeat Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("readHeartbeat", () => {
	const testProject = "test-heartbeat-project";

	afterEach(() => {
		// Clean up test file
		removeHeartbeatFile(testProject);
	});

	it("returns null when file does not exist", () => {
		const result = readHeartbeat("nonexistent-project-xyz");

		expect(result).toBeNull();
	});

	it("returns timestamp when file contains valid number", () => {
		const heartbeatFile = getHeartbeatFile(testProject);
		const timestamp = Date.now();
		writeFileSync(heartbeatFile, timestamp.toString());

		const result = readHeartbeat(testProject);

		expect(result).toBe(timestamp);
	});

	it("returns null when file contains invalid content", () => {
		const heartbeatFile = getHeartbeatFile(testProject);
		writeFileSync(heartbeatFile, "not-a-number");

		const result = readHeartbeat(testProject);

		expect(result).toBeNull();
	});

	it("returns null when file is empty", () => {
		const heartbeatFile = getHeartbeatFile(testProject);
		writeFileSync(heartbeatFile, "");

		const result = readHeartbeat(testProject);

		expect(result).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// removeHeartbeatFile Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("removeHeartbeatFile", () => {
	const testProject = "test-remove-heartbeat-project";

	it("removes existing heartbeat file", () => {
		const heartbeatFile = getHeartbeatFile(testProject);
		writeFileSync(heartbeatFile, "12345");
		expect(existsSync(heartbeatFile)).toBe(true);

		removeHeartbeatFile(testProject);

		expect(existsSync(heartbeatFile)).toBe(false);
	});

	it("does not throw when file does not exist", () => {
		// Should not throw
		expect(() => removeHeartbeatFile("nonexistent-project-xyz")).not.toThrow();
	});
});
