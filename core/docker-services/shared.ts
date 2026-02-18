import type {
	DockerComposeHealthcheckRaw,
	DockerPresetName,
	ServiceConfig,
} from "../../types";

const DEFAULT_HEALTHCHECK_SETTINGS = {
	interval: "250ms",
	timeout: "5s",
	retries: 20,
} as const;

export function getPortEnvName(portKey: string): string {
	return `${portKey.toUpperCase()}_PORT`;
}

export function getDefaultPortBindings(
	serviceKey: string,
	config: ServiceConfig,
	preset?: DockerPresetName,
): string[] {
	const envName = getPortEnvName(serviceKey);
	const bindings: string[] = [];

	const defaultInternalPort =
		preset === "postgres"
			? 5432
			: preset === "redis"
				? 6379
				: preset === "clickhouse"
					? 8123
					: config.port;

	bindings.push(`\${${envName}:-${config.port}}:${defaultInternalPort}`);

	if (config.secondaryPort !== undefined) {
		const secondaryEnv = getPortEnvName(`${serviceKey}Secondary`);
		const secondaryInternal = preset === "clickhouse" ? 9000 : config.secondaryPort;
		bindings.push(
			`\${${secondaryEnv}:-${config.secondaryPort}}:${secondaryInternal}`,
		);
	}

	return bindings;
}

export function resolveHealthcheck(
	healthCheck: ServiceConfig["healthCheck"] | undefined,
	fallback: DockerComposeHealthcheckRaw | undefined,
	options: { internalPort: number; user?: string },
): DockerComposeHealthcheckRaw | undefined {
	if (healthCheck === false) return undefined;
	if (typeof healthCheck === "function") return fallback;
	if (!healthCheck) return fallback;

	switch (healthCheck) {
		case "pg_isready":
			return {
				test: ["CMD-SHELL", `pg_isready -U ${options.user ?? "postgres"}`],
				...DEFAULT_HEALTHCHECK_SETTINGS,
			};
		case "redis-cli":
			return {
				test: ["CMD", "redis-cli", "ping"],
				...DEFAULT_HEALTHCHECK_SETTINGS,
			};
		case "http":
			return {
				test: [
					"CMD-SHELL",
					`wget -qO- http://127.0.0.1:${options.internalPort}/ping || exit 1`,
				],
				...DEFAULT_HEALTHCHECK_SETTINGS,
			};
		case "tcp":
		default:
			return fallback;
	}
}
