import type {
	BuiltInHealthCheck,
	DockerComposeServiceRaw,
	DockerPresetName,
	DockerPresetServiceDefinition,
	ServiceConfig,
} from "../../types";

export interface DockerServiceFactoryInput {
	serviceKey: string;
	config: ServiceConfig;
}

export interface DockerServiceFactoryOutput {
	service: DockerComposeServiceRaw;
	volume?: string;
}

export type DockerServiceFactory = (
	input: DockerServiceFactoryInput,
) => DockerServiceFactoryOutput;

export type PresetServiceSharedOptions = Pick<
	ServiceConfig,
	"serviceName" | "database" | "user" | "password"
> & {
	port?: number;
	healthCheck?: BuiltInHealthCheck | false;
	docker?: DockerComposeServiceRaw;
};

export interface DockerServicePresetDefaults {
	port: number;
	healthCheck: BuiltInHealthCheck;
	secondaryPort?: number;
}

export interface DockerServicePreset<
	TOptions extends PresetServiceSharedOptions = PresetServiceSharedOptions,
	TServiceConfig extends ServiceConfig = ServiceConfig,
> {
	preset: DockerPresetName;
	defaults: DockerServicePresetDefaults;
	build: DockerServiceFactory;
	createPresetDefinition(
		service?: DockerComposeServiceRaw,
	): DockerPresetServiceDefinition;
	toServiceConfig(options?: TOptions): TServiceConfig;
}

interface DefineDockerServiceInput<
	TOptions extends PresetServiceSharedOptions = PresetServiceSharedOptions,
	TServiceConfig extends ServiceConfig = ServiceConfig,
> {
	preset: DockerPresetName;
	defaults: DockerServicePresetDefaults;
	build: DockerServiceFactory;
	enhanceServiceConfig?: (
		base: ServiceConfig,
		options: TOptions,
	) => TServiceConfig;
}

/**
 * Define a docker service preset as single source of truth.
 * The same definition powers:
 * - compose generation (`build`)
 * - typed config helper defaults (`toServiceConfig`)
 */
export function defineDockerService<
	TOptions extends PresetServiceSharedOptions = PresetServiceSharedOptions,
	TServiceConfig extends ServiceConfig = ServiceConfig,
>(
	input: DefineDockerServiceInput<TOptions, TServiceConfig>,
): DockerServicePreset<TOptions, TServiceConfig> {
	function createPresetDefinition(
		service?: DockerComposeServiceRaw,
	): DockerPresetServiceDefinition {
		return {
			kind: "preset",
			preset: input.preset,
			service,
		};
	}

	function toServiceConfig(options = {} as TOptions): TServiceConfig {
		const base: ServiceConfig = {
			port: options.port ?? input.defaults.port,
			healthCheck: options.healthCheck ?? input.defaults.healthCheck,
			database: options.database,
			user: options.user,
			password: options.password,
			serviceName: options.serviceName,
			docker: createPresetDefinition(options.docker),
		};
		return input.enhanceServiceConfig
			? input.enhanceServiceConfig(base, options)
			: (base as TServiceConfig);
	}

	return {
		preset: input.preset,
		defaults: input.defaults,
		build: input.build,
		createPresetDefinition,
		toServiceConfig,
	};
}
