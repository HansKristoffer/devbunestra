import type {
	DockerComposeServiceRaw,
	DockerPresetName,
	ServiceConfig,
} from "../../types";
import type { DockerServicePreset } from "./define-docker-service";

export type {
	DockerServicePreset,
	DockerServicePresetDefaults,
	PresetServiceSharedOptions,
} from "./define-docker-service";

import {
	type ClickhouseServiceOptions,
	clickhouseDockerService,
} from "./clickhouse";
import { type PostgresServiceOptions, postgresDockerService } from "./postgres";
import { type RedisServiceOptions, redisDockerService } from "./redis";

const PRESET_SERVICES = {
	postgres: postgresDockerService,
	redis: redisDockerService,
	clickhouse: clickhouseDockerService,
} satisfies Record<DockerPresetName, DockerServicePreset>;

export { clickhouseDockerService, postgresDockerService, redisDockerService };
export type {
	ClickhouseServiceOptions,
	PostgresServiceOptions,
	RedisServiceOptions,
};

export type CustomServiceOptions = ServiceConfig & {
	docker: DockerComposeServiceRaw;
};

/**
 * Public service builders for dev.config.ts.
 * Core owns this surface so defaults and preset mapping live in one place.
 */
export const service = {
	postgres: postgresDockerService.toServiceConfig,
	redis: redisDockerService.toServiceConfig,
	clickhouse: clickhouseDockerService.toServiceConfig,

	custom(options: CustomServiceOptions): ServiceConfig {
		return options;
	},
};

export function inferDockerPreset(
	serviceKey: string,
): DockerPresetName | undefined {
	const normalized = serviceKey.toLowerCase();
	if (Object.hasOwn(PRESET_SERVICES, normalized)) {
		return normalized as DockerPresetName;
	}
	return undefined;
}

export function buildPresetDockerService(
	preset: DockerPresetName,
	input: Parameters<DockerServicePreset["build"]>[0],
): ReturnType<DockerServicePreset["build"]> {
	return PRESET_SERVICES[preset].build(input);
}
