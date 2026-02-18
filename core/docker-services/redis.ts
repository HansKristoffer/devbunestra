import type {
	BuiltInHealthCheck,
	DockerComposeHealthcheckRaw,
	DockerComposeServiceRaw,
} from "../../types";
import { defineDockerService } from "./define-docker-service";
import { getDefaultPortBindings, resolveHealthcheck } from "./shared";

export type RedisServiceOptions = {
	port?: number;
	healthCheck?: BuiltInHealthCheck | false;
	serviceName?: string;
	database?: string;
	user?: string;
	password?: string;
	docker?: DockerComposeServiceRaw;
};

export const redisDockerService = defineDockerService<RedisServiceOptions>({
	preset: "redis",
	defaults: {
		port: 6379,
		healthCheck: "redis-cli",
	},
	build: ({ serviceKey, config }) => {
		const defaultHealthcheck: DockerComposeHealthcheckRaw = {
			test: ["CMD", "redis-cli", "ping"],
			interval: "250ms",
			timeout: "5s",
			retries: 20,
		};

		return {
			service: {
				image: "redis:7-alpine",
				ports: getDefaultPortBindings(serviceKey, config, "redis"),
				healthcheck: resolveHealthcheck(config.healthCheck, defaultHealthcheck, {
					internalPort: 6379,
				}),
			},
		};
	},
});
