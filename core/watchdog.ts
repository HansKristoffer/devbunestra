import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isProcessAlive } from "./process";

// ═══════════════════════════════════════════════════════════════════════════
// File Paths
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the heartbeat file path for a project.
 */
export function getHeartbeatFile(projectName: string): string {
	return `/tmp/${projectName}-heartbeat`;
}

/**
 * Get the watchdog PID file path for a project.
 */
export function getWatchdogPidFile(projectName: string): string {
	return `/tmp/${projectName}-watchdog.pid`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Heartbeat
// ═══════════════════════════════════════════════════════════════════════════

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start writing heartbeat to file.
 * The heartbeat is used by the watchdog to detect idle state.
 */
export function startHeartbeat(projectName: string, intervalMs = 30_000): void {
	const heartbeatFile = getHeartbeatFile(projectName);

	// Write initial heartbeat
	writeFileSync(heartbeatFile, Date.now().toString());

	// Update heartbeat at interval
	heartbeatInterval = setInterval(() => {
		writeFileSync(heartbeatFile, Date.now().toString());
	}, intervalMs);
}

/**
 * Stop writing heartbeat.
 */
export function stopHeartbeat(): void {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
}

/**
 * Read the last heartbeat timestamp.
 */
export function readHeartbeat(projectName: string): number | null {
	const heartbeatFile = getHeartbeatFile(projectName);
	try {
		if (!existsSync(heartbeatFile)) return null;
		const content = readFileSync(heartbeatFile, "utf-8");
		const timestamp = parseInt(content, 10);
		return Number.isNaN(timestamp) ? null : timestamp;
	} catch {
		return null;
	}
}

/**
 * Remove the heartbeat file.
 */
export function removeHeartbeatFile(projectName: string): void {
	const heartbeatFile = getHeartbeatFile(projectName);
	try {
		unlinkSync(heartbeatFile);
	} catch {
		// File may not exist
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Watchdog
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if watchdog is already running.
 */
export function isWatchdogRunning(projectName: string): boolean {
	const pidFile = getWatchdogPidFile(projectName);
	try {
		if (!existsSync(pidFile)) return false;
		const content = readFileSync(pidFile, "utf-8");
		const pid = parseInt(content, 10);
		if (Number.isNaN(pid)) return false;
		return isProcessAlive(pid);
	} catch {
		return false;
	}
}

/**
 * Get the watchdog PID if running.
 */
export function getWatchdogPid(projectName: string): number | null {
	const pidFile = getWatchdogPidFile(projectName);
	try {
		if (!existsSync(pidFile)) return null;
		const content = readFileSync(pidFile, "utf-8");
		const pid = parseInt(content, 10);
		if (Number.isNaN(pid)) return null;
		if (!isProcessAlive(pid)) return null;
		return pid;
	} catch {
		return null;
	}
}

/**
 * Spawn watchdog as a detached process.
 * The watchdog monitors the heartbeat file and shuts down containers after idle timeout.
 */
export function getWatchdogComposeArg(composeFile?: string): string {
	return composeFile ? `-f "${composeFile}"` : "";
}

export async function spawnWatchdog(
	projectName: string,
	root: string,
	options: {
		timeoutMinutes?: number;
		verbose?: boolean;
		composeFile?: string;
	} = {},
): Promise<void> {
	const { timeoutMinutes = 10, verbose = true, composeFile } = options;

	// Check if watchdog is already running
	const existingPid = getWatchdogPid(projectName);
	if (existingPid) {
		if (verbose)
			console.log(`✓ Watchdog already running (PID: ${existingPid})`);
		return;
	}

	// Remove stale PID file if exists
	const pidFile = getWatchdogPidFile(projectName);
	try {
		unlinkSync(pidFile);
	} catch {
		// File may not exist
	}

	// Get the path to the watchdog runner script
	const watchdogScript = new URL("./watchdog-runner.ts", import.meta.url)
		.pathname;

	// Spawn watchdog as a separate process
	const proc = spawn("bun", ["run", watchdogScript], {
		cwd: root,
		detached: true,
		stdio: "ignore",
		env: {
			...process.env,
			WATCHDOG_PROJECT_NAME: projectName,
			WATCHDOG_HEARTBEAT_FILE: getHeartbeatFile(projectName),
			WATCHDOG_PID_FILE: pidFile,
			WATCHDOG_TIMEOUT_MS: String(timeoutMinutes * 60 * 1000),
			WATCHDOG_COMPOSE_ARG: getWatchdogComposeArg(composeFile),
		},
	});

	proc.unref();

	if (verbose && proc.pid) {
		console.log(`✓ Watchdog started (PID: ${proc.pid})`);
	}
}

/**
 * Stop the watchdog process.
 */
export function stopWatchdog(projectName: string): void {
	const pid = getWatchdogPid(projectName);
	if (pid) {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			// Process may already be dead
		}
	}

	// Clean up files
	const pidFile = getWatchdogPidFile(projectName);
	try {
		unlinkSync(pidFile);
	} catch {
		// File may not exist
	}
}
