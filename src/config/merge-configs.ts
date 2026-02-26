import type { AppConfig, DevConfig, ServiceConfig } from "../types";

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
