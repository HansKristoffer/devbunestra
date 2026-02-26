import type { AppConfig, DevEnvironment, ServiceConfig } from "../types";

let cachedEnv: DevEnvironment<
	Record<string, ServiceConfig>,
	Record<string, AppConfig>
> | null = null;

export function setCachedDevEnv(
	env: DevEnvironment<Record<string, ServiceConfig>, Record<string, AppConfig>>,
): void {
	cachedEnv = env;
}

export function getCachedDevEnv(): DevEnvironment<
	Record<string, ServiceConfig>,
	Record<string, AppConfig>
> | null {
	return cachedEnv;
}

export function clearDevEnvCache(): void {
	cachedEnv = null;
}
