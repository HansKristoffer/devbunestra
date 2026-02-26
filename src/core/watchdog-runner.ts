/**
 * Watchdog Runner
 *
 * Monitors heartbeat file and shuts down containers after inactivity.
 * Spawned as a detached process by the dev environment.
 *
 * Environment variables:
 *   WATCHDOG_PROJECT_NAME - Docker project name
 *   WATCHDOG_HEARTBEAT_FILE - Path to heartbeat file
 *   WATCHDOG_PID_FILE - Path to PID file
 *   WATCHDOG_TIMEOUT_MS - Idle timeout in milliseconds
 *   WATCHDOG_COMPOSE_ARG - Optional docker compose argument (e.g., "-f compose.yml")
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

// Configuration from environment
const PROJECT_NAME = process.env.WATCHDOG_PROJECT_NAME ?? "";
const HEARTBEAT_FILE = process.env.WATCHDOG_HEARTBEAT_FILE ?? "";
const PID_FILE = process.env.WATCHDOG_PID_FILE ?? "";
const IDLE_TIMEOUT = parseInt(process.env.WATCHDOG_TIMEOUT_MS ?? "600000", 10);
const COMPOSE_ARG = process.env.WATCHDOG_COMPOSE_ARG ?? "";
const CHECK_INTERVAL = 60_000; // Check every minute

// Validate configuration
if (!PROJECT_NAME || !HEARTBEAT_FILE || !PID_FILE) {
	console.error("[watchdog] Missing required environment variables");
	process.exit(1);
}

// Type assertion after validation
const heartbeatFile: string = HEARTBEAT_FILE;
const pidFile: string = PID_FILE;

// Write PID file
writeFileSync(pidFile, process.pid.toString());

// Cleanup function
function cleanup(): void {
	try {
		unlinkSync(pidFile);
	} catch {
		// File may not exist
	}
	try {
		unlinkSync(heartbeatFile);
	} catch {
		// File may not exist
	}
}

// Handle signals
process.on("SIGTERM", () => {
	cleanup();
	process.exit(0);
});

process.on("SIGINT", () => {
	cleanup();
	process.exit(0);
});

console.log(`[watchdog] Started for ${PROJECT_NAME} (PID: ${process.pid})`);
console.log(`[watchdog] Idle timeout: ${IDLE_TIMEOUT / 60000} minutes`);

// Main watchdog loop
async function watchdog(): Promise<void> {
	while (true) {
		await new Promise((r) => setTimeout(r, CHECK_INTERVAL));

		// Check if heartbeat file exists
		if (!existsSync(heartbeatFile)) {
			continue;
		}

		// Read last heartbeat timestamp
		let lastBeat: number;
		try {
			const content = readFileSync(heartbeatFile, "utf-8");
			lastBeat = parseInt(content, 10);
		} catch {
			continue;
		}

		if (Number.isNaN(lastBeat)) {
			continue;
		}

		const elapsed = Date.now() - lastBeat;

		if (elapsed > IDLE_TIMEOUT) {
			console.log(
				`[watchdog] No heartbeat for ${Math.ceil(elapsed / 60000)} minutes, shutting down...`,
			);
			try {
				execSync(`docker compose ${COMPOSE_ARG} down`.trim(), {
					env: { ...process.env, COMPOSE_PROJECT_NAME: PROJECT_NAME },
					stdio: "ignore",
				});
			} catch {
				// Ignore errors
			}
			console.log("[watchdog] Containers stopped");
			cleanup();
			process.exit(0);
		}
	}
}

watchdog();
