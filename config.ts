import { isAbsolute, normalize } from "node:path";
import type {
	AppConfig,
	DevConfig,
	DevHooks,
	DevOptions,
	DockerComposeGenerationOptions,
	EnvVarsBuilder,
	MigrationConfig,
	PrismaConfig,
	SeedConfig,
	ServiceConfig,
} from "./types";

const BUILTIN_DOCKER_PRESETS = new Set(["postgres", "redis", "clickhouse"]);

function inferBuiltInPreset(serviceName: string): string | null {
	const normalized = serviceName.toLowerCase();
	return BUILTIN_DOCKER_PRESETS.has(normalized) ? normalized : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Config Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Define a dev environment configuration with full TypeScript inference.
 *
 * @example
 * ```typescript
 * const config = defineDevConfig({
 *   projectPrefix: 'myapp',
 *   services: {
 *     postgres: { port: 5432, healthCheck: 'pg_isready' },
 *     redis: { port: 6379 },
 *   },
 *   apps: {
 *     api: { port: 3000, devCommand: 'bun run dev', cwd: 'apps/backend' },
 *     web: { port: 5173, devCommand: 'bun run dev', cwd: 'apps/frontend' },
 *   },
 *   envVars: (ports, urls) => ({
 *     DATABASE_URL: urls.postgres,
 *     REDIS_URL: urls.redis,
 *     API_PORT: String(ports.api),
 *   }),
 * })
 * ```
 */
export function defineDevConfig<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig> = Record<string, never>,
>(config: {
	/** Prefix for Docker project name (e.g., 'myapp' -> 'myapp-main') */
	projectPrefix: string;
	/** Docker Compose services to manage */
	services: TServices;
	/** Applications to start (optional) */
	apps?: TApps;
	/**
	 * Environment variables builder. Define all env vars here.
	 *
	 * @example
	 * ```typescript
	 * envVars: (ports, urls, { localIp }) => ({
	 *   DATABASE_URL: urls.postgres,
	 *   BASE_URL: urls.api,
	 *   VITE_PORT: ports.platform,
	 *   EXPO_API_URL: `http://${localIp}:${ports.api}`
	 * })
	 * ```
	 */
	envVars?: EnvVarsBuilder<TServices, TApps>;
	/** Lifecycle hooks (optional) */
	hooks?: DevHooks<TServices, TApps>;
	/** Migrations to run after containers are ready (optional). Runs in parallel. */
	migrations?: MigrationConfig[];
	/** Seed configuration (optional). Runs after migrations, before servers. */
	seed?: SeedConfig<TServices, TApps>;
	/** Prisma configuration (optional). When set, dev.prisma is available. */
	prisma?: PrismaConfig;
	/** Additional options (optional) */
	options?: DevOptions;
	/** Docker Compose generation options (optional) */
	docker?: DockerComposeGenerationOptions;
}): DevConfig<TServices, TApps> {
	return config as DevConfig<TServices, TApps>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Config Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a dev config and return any errors.
 */
export function validateConfig<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(config: DevConfig<TServices, TApps>): string[] {
	const errors: string[] = [];
	const composeServiceNames = new Set<string>();

	// Check project prefix
	if (!config.projectPrefix) {
		errors.push("projectPrefix is required");
	} else if (!/^[a-z][a-z0-9-]*$/.test(config.projectPrefix)) {
		errors.push(
			"projectPrefix must start with a letter and contain only lowercase letters, numbers, and hyphens",
		);
	}

	// Check services
	if (!config.services || Object.keys(config.services).length === 0) {
		errors.push("At least one service is required");
	}

	for (const [name, service] of Object.entries(config.services ?? {})) {
		if (!service.port || typeof service.port !== "number") {
			errors.push(`Service "${name}" must have a valid port number`);
		}
		if (service.port < 1 || service.port > 65535) {
			errors.push(`Service "${name}" port must be between 1 and 65535`);
		}
		if (
			service.secondaryPort !== undefined &&
			(service.secondaryPort < 1 || service.secondaryPort > 65535)
		) {
			errors.push(`Service "${name}" secondaryPort must be between 1 and 65535`);
		}

		const composeServiceName = service.serviceName ?? name;
		if (composeServiceNames.has(composeServiceName)) {
			errors.push(
				`Duplicate compose service name "${composeServiceName}". Use unique serviceName values.`,
			);
		}
		composeServiceNames.add(composeServiceName);

		const dockerConfig = service.docker;
		const preset = inferBuiltInPreset(name);
		if (!dockerConfig && !preset) {
			errors.push(
				`Service "${name}" must define docker config (helper or raw) because it has no built-in preset.`,
			);
		}
		if (
			dockerConfig &&
			typeof dockerConfig === "object" &&
			"kind" in dockerConfig &&
			dockerConfig.kind === "preset"
		) {
			const presetName = dockerConfig.preset;
			if (typeof presetName !== "string" || !BUILTIN_DOCKER_PRESETS.has(presetName)) {
				errors.push(
					`Service "${name}" has invalid docker preset "${presetName}".`,
				);
			}
		}
	}

	// Check docker compose generation config

	if (config.docker?.writeStrategy) {
		const writeStrategy = config.docker.writeStrategy;
		if (writeStrategy !== "always" && writeStrategy !== "if-missing") {
			errors.push(
				`docker.writeStrategy "${String(writeStrategy)}" is invalid. Use "always" or "if-missing".`,
			);
		}
	}

	if (config.docker?.generatedFile) {
		const generatedFile = config.docker.generatedFile;
		if (isAbsolute(generatedFile)) {
			errors.push("docker.generatedFile must be a relative path inside the repo.");
		}
		const normalized = normalize(generatedFile).replace(/\\/g, "/");
		if (normalized === ".." || normalized.startsWith("../")) {
			errors.push(
				"docker.generatedFile cannot point outside the repository root.",
			);
		}
	}

	// Check apps
	for (const [name, app] of Object.entries(config.apps ?? {})) {
		if (!app.port || typeof app.port !== "number") {
			errors.push(`App "${name}" must have a valid port number`);
		}
		if (!app.devCommand) {
			errors.push(`App "${name}" must have a devCommand`);
		}
	}

	// Check migrations
	for (const migration of config.migrations ?? []) {
		if (!migration.name) {
			errors.push("Migration must have a name");
		}
		if (!migration.command) {
			errors.push(`Migration "${migration.name}" must have a command`);
		}
	}

	// Check seed
	if (config.seed && !config.seed.command) {
		errors.push("Seed must have a command");
	}

	return errors;
}

/**
 * Validate config and throw if invalid.
 */
export function assertValidConfig<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(config: DevConfig<TServices, TApps>): void {
	const errors = validateConfig(config);
	if (errors.length > 0) {
		throw new Error(`Invalid dev config:\n  - ${errors.join("\n  - ")}`);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Config Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge two configs, with the second taking precedence.
 */
export function mergeConfigs<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(
	base: DevConfig<TServices, TApps>,
	overrides: Partial<DevConfig<TServices, TApps>>,
): DevConfig<TServices, TApps> {
	return {
		...base,
		...overrides,
		services: { ...base.services, ...overrides.services } as TServices,
		apps: { ...base.apps, ...overrides.apps } as TApps,
		hooks: { ...base.hooks, ...overrides.hooks },
		migrations: overrides.migrations ?? base.migrations,
		seed: overrides.seed ?? base.seed,
		options: { ...base.options, ...overrides.options },
		docker: { ...base.docker, ...overrides.docker },
	};
}

/**
 * Create a partial config that can be merged later.
 */
export function definePartialConfig<
	TServices extends Record<string, ServiceConfig> = Record<
		string,
		ServiceConfig
	>,
	TApps extends Record<string, AppConfig> = Record<string, AppConfig>,
>(
	config: Partial<DevConfig<TServices, TApps>>,
): Partial<DevConfig<TServices, TApps>> {
	return config;
}
