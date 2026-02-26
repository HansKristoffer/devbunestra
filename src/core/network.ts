import { networkInterfaces } from "node:os";
import type { AppConfig } from "../types";
import { sleep } from "./utils";

// ═══════════════════════════════════════════════════════════════════════════
// Local IP Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the local IP address of the machine for mobile device connectivity.
 * Prefers IPv4 addresses on non-internal interfaces.
 */
export function getLocalIp(): string {
	const interfaces = networkInterfaces();

	for (const name of Object.keys(interfaces)) {
		const nets = interfaces[name];
		if (!nets) continue;

		for (const net of nets) {
			// Skip internal (loopback) addresses
			if (net.family === "IPv4" && !net.internal) {
				return net.address;
			}
		}
	}

	return "127.0.0.1";
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Health Checks
// ═══════════════════════════════════════════════════════════════════════════

export interface WaitForServerOptions {
	/** Timeout in milliseconds */
	timeout?: number;
	/** Polling interval in milliseconds */
	interval?: number;
	/** Log progress */
	verbose?: boolean;
}

/**
 * Wait for an HTTP server to respond.
 */
export async function waitForServer(
	url: string,
	options: WaitForServerOptions = {},
): Promise<void> {
	const { timeout = 30000, interval = 2000, verbose = false } = options;

	const start = Date.now();
	let attempts = 0;

	while (Date.now() - start < timeout) {
		attempts++;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);
		try {
			const response = await fetch(url, {
				signal: controller.signal as RequestInit["signal"],
			});
			clearTimeout(timeoutId);
			// Accept 2xx, 3xx, or 404 (server is up, just no route)
			if (response.ok || response.status === 404) {
				if (verbose) {
					console.log(`   ✓ ${url} ready after ${attempts} attempts`);
				}
				return;
			}
		} catch {
			clearTimeout(timeoutId);
			// Server not ready yet
			if (verbose && attempts % 5 === 0) {
				console.log(
					`   ⏳ Waiting for ${url}... (${Math.round((Date.now() - start) / 1000)}s)`,
				);
			}
		}
		await sleep(interval);
	}

	throw new Error(
		`Server at ${url} did not respond within ${timeout}ms after ${attempts} attempts`,
	);
}

/**
 * Wait for all dev servers to be ready.
 */
export async function waitForDevServers(
	apps: Record<string, AppConfig>,
	ports: Record<string, number>,
	options: {
		timeout?: number;
		verbose?: boolean;
		productionBuild?: boolean;
	} = {},
): Promise<void> {
	const { timeout = 60000, verbose = true } = options;

	if (verbose) console.log("⏳ Waiting for servers to be ready...");

	const promises: Promise<void>[] = [];

	for (const [name, config] of Object.entries(apps)) {
		const port = ports[name];
		const healthPath = config.healthEndpoint ?? "/";
		const url = `http://localhost:${port}${healthPath}`;
		const appTimeout = config.healthTimeout ?? timeout;

		promises.push(waitForServer(url, { timeout: appTimeout, verbose }));
	}

	await Promise.all(promises);

	if (verbose) console.log("✓ All servers ready");
}

// ═══════════════════════════════════════════════════════════════════════════
// Port Availability
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a port is available (not in use).
 */
export async function isPortAvailable(port: number): Promise<boolean> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 500);
	try {
		const _response = await fetch(`http://localhost:${port}/`, {
			signal: controller.signal as RequestInit["signal"],
		});
		clearTimeout(timeoutId);
		// If we get any response, port is in use
		return false;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error) {
			// Connection refused means port is free
			if (
				error.message.includes("ECONNREFUSED") ||
				error.message.includes("fetch failed")
			) {
				return true;
			}
		}
		// Timeout or other error - assume port is free
		return true;
	}
}
