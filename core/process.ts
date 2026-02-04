import {
	type ChildProcess,
	execSync,
	type SpawnOptions,
	spawn,
} from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";
import type { AppConfig, DevServerPids, ExecOptions } from "../types";

// ═══════════════════════════════════════════════════════════════════════════
// Command Execution
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/**
 * Execute a shell command with environment variables.
 */
export function exec(
	cmd: string,
	root: string,
	envVars: Record<string, string>,
	options: ExecOptions = {},
): ExecResult {
	const { cwd, verbose = false, env = {}, throwOnError = true } = options;

	const workingDir = cwd ? resolve(root, cwd) : root;
	const fullEnv = { ...process.env, ...envVars, ...env };

	try {
		const stdout = execSync(cmd, {
			cwd: workingDir,
			env: fullEnv,
			encoding: "utf-8",
			stdio: verbose ? "inherit" : ["pipe", "pipe", "pipe"],
		});

		return {
			exitCode: 0,
			stdout: typeof stdout === "string" ? stdout : "",
			stderr: "",
		};
	} catch (error) {
		const execError = error as {
			status?: number;
			stdout?: string;
			stderr?: string;
		};
		const result: ExecResult = {
			exitCode: execError.status ?? 1,
			stdout: execError.stdout ?? "",
			stderr: execError.stderr ?? "",
		};

		if (throwOnError) {
			throw new Error(
				`Command failed with exit code ${result.exitCode}: ${cmd}\n${result.stderr}`,
			);
		}

		return result;
	}
}

/**
 * Execute a shell command asynchronously.
 */
export async function execAsync(
	cmd: string,
	root: string,
	envVars: Record<string, string>,
	options: ExecOptions = {},
): Promise<ExecResult> {
	// For now, wrap sync in Promise - can be optimized later with spawn
	return new Promise((resolve) => {
		const result = exec(cmd, root, envVars, {
			...options,
			throwOnError: false,
		});
		resolve(result);
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Process Spawning
// ═══════════════════════════════════════════════════════════════════════════

export interface SpawnDevServerOptions {
	verbose?: boolean;
	detached?: boolean;
	isCI?: boolean;
	/** Kill any existing process using the port before starting. Default: true */
	killExisting?: boolean;
	/** The port this server will use (required if killExisting is true) */
	port?: number;
}

/**
 * Spawn a dev server as a detached process.
 * If killExisting is true and port is provided, kills any existing process on that port first.
 */
export async function spawnDevServer(
	command: string,
	root: string,
	appCwd: string | undefined,
	envVars: Record<string, string>,
	options: SpawnDevServerOptions = {},
): Promise<ChildProcess> {
	const {
		verbose = false,
		detached = true,
		isCI = false,
		killExisting = true,
		port,
	} = options;

	// Kill existing process on the port if requested
	if (killExisting && port !== undefined) {
		const existingPid = getProcessOnPort(port);
		if (existingPid !== null) {
			if (verbose) {
				console.log(`   ⚠️  Port ${port} is in use by process ${existingPid}`);
			}
			await killProcessOnPortAndWait(port, { verbose });
		}
	}

	// Parse command into parts
	const parts = command.split(" ");
	const cmd = parts[0];
	const args = parts.slice(1);

	if (!cmd) {
		throw new Error("Command cannot be empty");
	}

	const workingDir = appCwd ? resolve(root, appCwd) : root;

	const spawnOptions: SpawnOptions = {
		cwd: workingDir,
		env: { ...process.env, ...envVars },
		detached,
		stdio: isCI || verbose ? "inherit" : "ignore",
	};

	const proc = spawn(cmd, args, spawnOptions);

	if (detached && proc.unref) {
		proc.unref();
	}

	return proc;
}

export interface StartDevServersOptions {
	verbose?: boolean;
	productionBuild?: boolean;
	isCI?: boolean;
	/** Kill any existing process using the port before starting. Default: true */
	killExisting?: boolean;
}

/**
 * Start all configured dev servers.
 * If killExisting is true (default), any process already using a port will be killed first.
 */
export async function startDevServers(
	apps: Record<string, AppConfig>,
	root: string,
	envVars: Record<string, string>,
	ports: Record<string, number>,
	options: StartDevServersOptions = {},
): Promise<DevServerPids> {
	const {
		verbose = true,
		productionBuild = false,
		isCI = false,
		killExisting = true,
	} = options;
	const pids: DevServerPids = {};

	if (verbose) {
		console.log(
			productionBuild
				? "🚀 Starting production servers..."
				: "🔧 Starting dev servers...",
		);
	}

	for (const [name, config] of Object.entries(apps)) {
		const command = productionBuild
			? (config.prodCommand ?? config.devCommand)
			: config.devCommand;

		const port = ports[name];

		const proc = await spawnDevServer(command, root, config.cwd, envVars, {
			verbose,
			isCI,
			killExisting,
			port,
		});

		if (proc.pid) {
			pids[name] = proc.pid;
			if (verbose) {
				console.log(`   ${name} PID: ${proc.pid}`);
			}
		}
	}

	return pids;
}

// ═══════════════════════════════════════════════════════════════════════════
// Port Process Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the PID of the process using a specific port.
 * Returns null if no process is using the port.
 */
export function getProcessOnPort(port: number): number | null {
	try {
		const os = platform();
		let output: string;

		if (os === "win32") {
			// Windows: use netstat
			output = execSync(`netstat -ano | findstr :${port}`, {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			// Parse Windows netstat output: TCP 0.0.0.0:3000 0.0.0.0:0 LISTENING 12345
			const lines = output.trim().split("\n");
			for (const line of lines) {
				// Only match LISTENING state
				if (line.includes("LISTENING")) {
					const parts = line.trim().split(/\s+/);
					const pid = Number.parseInt(parts[parts.length - 1], 10);
					if (!Number.isNaN(pid) && pid > 0) {
						return pid;
					}
				}
			}
		} else {
			// macOS/Linux: use lsof
			output = execSync(`lsof -ti :${port}`, {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			const pid = Number.parseInt(output.trim().split("\n")[0], 10);
			if (!Number.isNaN(pid) && pid > 0) {
				return pid;
			}
		}

		return null;
	} catch {
		// No process found on port (command exits with error)
		return null;
	}
}

/**
 * Check if a port is currently in use.
 */
export function isPortInUse(port: number): boolean {
	return getProcessOnPort(port) !== null;
}

/**
 * Kill the process using a specific port.
 * Returns true if a process was killed, false if no process was using the port.
 */
export function killProcessOnPort(
	port: number,
	options: { verbose?: boolean; signal?: NodeJS.Signals } = {},
): boolean {
	const { verbose = false, signal = "SIGTERM" } = options;

	const pid = getProcessOnPort(port);
	if (pid === null) {
		return false;
	}

	try {
		if (verbose) {
			console.log(`   Killing process ${pid} on port ${port}`);
		}
		process.kill(pid, signal);
		return true;
	} catch {
		// Process may have already exited
		return false;
	}
}

/**
 * Kill the process on port and wait for it to fully release the port.
 * Uses SIGTERM first, then SIGKILL if the process doesn't exit.
 */
export async function killProcessOnPortAndWait(
	port: number,
	options: { verbose?: boolean; timeout?: number } = {},
): Promise<boolean> {
	const { verbose = false, timeout = 5000 } = options;

	const pid = getProcessOnPort(port);
	if (pid === null) {
		return false;
	}

	if (verbose) {
		console.log(`   Killing process ${pid} on port ${port}...`);
	}

	// First try SIGTERM
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		// Process may have already exited
		return false;
	}

	// Wait for port to be released
	const startTime = Date.now();
	const checkInterval = 100;

	while (Date.now() - startTime < timeout) {
		await new Promise((resolve) => setTimeout(resolve, checkInterval));

		if (!isPortInUse(port)) {
			if (verbose) {
				console.log(`   ✓ Port ${port} released`);
			}
			return true;
		}
	}

	// If still running, try SIGKILL
	if (verbose) {
		console.log(`   Process ${pid} didn't exit, sending SIGKILL...`);
	}

	try {
		process.kill(pid, "SIGKILL");
	} catch {
		// Process may have already exited
	}

	// Wait a bit more for SIGKILL
	await new Promise((resolve) => setTimeout(resolve, 500));

	const released = !isPortInUse(port);
	if (verbose) {
		if (released) {
			console.log(`   ✓ Port ${port} released after SIGKILL`);
		} else {
			console.log(`   ⚠ Port ${port} still in use`);
		}
	}

	return released;
}

// ═══════════════════════════════════════════════════════════════════════════
// Process Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stop a process by PID.
 */
export function stopProcess(pid: number): void {
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		// Process may already be dead
	}
}

/**
 * Stop all processes by their PIDs.
 */
export function stopAllProcesses(
	pids: DevServerPids,
	options: { verbose?: boolean } = {},
): void {
	const { verbose = true } = options;

	for (const [name, pid] of Object.entries(pids)) {
		if (pid) {
			if (verbose) console.log(`   Stopping ${name} (PID: ${pid})`);
			stopProcess(pid);
		}
	}
}

/**
 * Check if a process is alive by sending signal 0.
 */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Commands
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run production build for apps that have buildCommand configured.
 */
export function buildApps(
	apps: Record<string, AppConfig>,
	root: string,
	envVars: Record<string, string>,
	options: { verbose?: boolean } = {},
): void {
	const { verbose = true } = options;

	for (const [name, config] of Object.entries(apps)) {
		if (config.buildCommand) {
			if (verbose) console.log(`🔨 Building ${name}...`);

			exec(config.buildCommand, root, envVars, {
				cwd: config.cwd,
				verbose,
			});
		}
	}

	if (verbose) console.log("✓ Build complete");
}
