import type { AppConfig, DevEnvironment, ServiceConfig } from "../types";
import { getCachedDevEnv } from "./cache";

export { clearDevEnvCache } from "./cache";
export { CONFIG_FILES, findConfigFile } from "./find-config-file";
export { loadDevEnv } from "./load-dev-env";

export function getDevEnv(): DevEnvironment<
	Record<string, ServiceConfig>,
	Record<string, AppConfig>
> {
	const env = getCachedDevEnv();
	if (!env) {
		throw new Error("Dev environment not loaded. Call loadDevEnv() first.");
	}
	return env;
}
