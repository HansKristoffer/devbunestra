import {
	type ChildProcess,
	execSync,
	type SpawnOptions,
	spawn,
} from "node:child_process";
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
}

/**
 * Spawn a dev server as a detached process.
 */
export function spawnDevServer(
	command: string,
	root: string,
	appCwd: string | undefined,
	envVars: Record<string, string>,
	options: SpawnDevServerOptions = {},
): ChildProcess {
	const { verbose = false, detached = true, isCI = false } = options;

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

/**
 * Start all configured dev servers.
 */
export function startDevServers(
	apps: Record<string, AppConfig>,
	root: string,
	envVars: Record<string, string>,
	options: {
		verbose?: boolean;
		productionBuild?: boolean;
		isCI?: boolean;
	} = {},
): DevServerPids {
	const { verbose = true, productionBuild = false, isCI = false } = options;
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

		const proc = spawnDevServer(command, root, config.cwd, envVars, {
			verbose,
			isCI,
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
