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
} from "../types";

export function defineDevConfig<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig> = Record<string, never>,
>(config: {
	projectPrefix: string;
	services: TServices;
	apps?: TApps;
	envVars?: EnvVarsBuilder<TServices, TApps>;
	hooks?: DevHooks<TServices, TApps>;
	migrations?: MigrationConfig[];
	seed?: SeedConfig<TServices, TApps>;
	prisma?: PrismaConfig;
	options?: DevOptions;
	docker?: DockerComposeGenerationOptions;
}): DevConfig<TServices, TApps> {
	return config as DevConfig<TServices, TApps>;
}
