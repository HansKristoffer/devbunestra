import type { AppConfig, DevConfig, ServiceConfig } from "../types";
import { getLocalIp } from "./network";
import { calculatePortOffset, computePorts, computeUrls } from "./ports";

/**
 * Core utility functions shared across modules.
 */

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect if running in a CI environment.
 */
export function isCI(): boolean {
	return (
		process.env.CI === "true" ||
		process.env.CI === "1" ||
		process.env.GITHUB_ACTIONS === "true" ||
		process.env.GITLAB_CI === "true" ||
		process.env.CIRCLECI === "true" ||
		process.env.JENKINS_URL !== undefined
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// Vibe Kanban Integration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log the frontend port in a format that Vibe Kanban can detect.
 * This is used to communicate the dev server port to external tools.
 *
 * @param port - The port number the frontend is running on
 */
export function logFrontendPort(port: number | undefined): void {
	console.log(`using_frontend_port:${port}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Config-based Env Var Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get an environment variable value from the config.
 * Computes ports/urls and runs envVars to get the value.
 *
 * @param config - The dev config object (from defineDevConfig)
 * @param name - The environment variable name
 * @param options - Optional settings (log for Vibe Kanban detection)
 *
 * @example
 * ```typescript
 * // In vite.config.ts
 * import { getEnvVar } from 'buncargo'
 * import config from '../../dev.config'
 *
 * export default defineConfig(async ({ command }) => {
 *   const isDev = command === 'serve'
 *   const vitePort = isDev ? getEnvVar(config, 'VITE_PORT') : undefined
 *   const apiUrl = getEnvVar(config, 'VITE_API_URL')
 *   return {
 *     server: { port: vitePort, strictPort: true }
 *   }
 * })
 * ```
 */
export function getEnvVar<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(
	config: DevConfig<TServices, TApps>,
	name: string,
	options: { log?: boolean } = {},
): string | number | undefined {
	const { log = true } = options;
	const offset = calculatePortOffset();
	const localIp = getLocalIp();

	// Compute ports and urls
	const ports = computePorts(config.services, config.apps, offset);
	const urls = computeUrls(config.services, config.apps, ports, localIp);

	// Build env vars from the function
	const envVars = config.envVars?.(
		ports as Parameters<NonNullable<typeof config.envVars>>[0],
		urls as Parameters<NonNullable<typeof config.envVars>>[1],
		{
			projectName: config.projectPrefix,
			localIp,
			portOffset: offset,
		},
	);

	const value = envVars?.[name];

	// Log frontend port for Vibe Kanban detection
	if (log && name === "VITE_PORT" && typeof value === "number") {
		logFrontendPort(value);
	}

	return value;
}

/**
 * Log the API URL in a format that tools can detect.
 * This is used by Expo and other tools to find the API server.
 *
 * @param url - The API URL
 */
export function logApiUrl(url: string): void {
	console.log(`using_api_url:${url}`);
}

/**
 * Log the Expo API URL in a format that tools can detect.
 * This is typically the local IP address for mobile device connectivity.
 *
 * @param url - The Expo API URL (usually http://<local-ip>:<port>)
 */
export function logExpoApiUrl(url: string): void {
	console.log(`using_expo_api_url:${url}`);
}
