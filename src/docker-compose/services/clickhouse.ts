import type {
	BuiltInHealthCheck,
	DockerComposeHealthcheckRaw,
	DockerComposeServiceRaw,
	ServiceConfig,
} from "../../types";
import { defineDockerService } from "./define-docker-service";
import { getDefaultPortBindings, resolveHealthcheck } from "./shared";

export type ClickhouseServiceOptions = {
	port?: number;
	secondaryPort?: number;
	expose?: boolean;
	healthCheck?: BuiltInHealthCheck | false;
	serviceName?: string;
	database?: string;
	user?: string;
	password?: string;
	docker?: DockerComposeServiceRaw;
};

export type ClickhouseServiceConfig = ServiceConfig & {
	secondaryPort: number;
};

export const clickhouseDockerService = defineDockerService<
	ClickhouseServiceOptions,
	ClickhouseServiceConfig
>({
	preset: "clickhouse",
	defaults: {
		port: 8123,
		secondaryPort: 9000,
		healthCheck: "http",
	},
	enhanceServiceConfig: (base, options): ClickhouseServiceConfig => ({
		...base,
		secondaryPort: options.secondaryPort ?? 9000,
	}),
	build: ({ serviceKey, config }) => {
		const user = config.user ?? "default";
		const password = config.password ?? "clickhouse";
		const database = config.database ?? "default";
		const defaultHealthcheck: DockerComposeHealthcheckRaw = {
			test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8123/ping || exit 1"],
			interval: "250ms",
			timeout: "5s",
			retries: 20,
		};

		return {
			service: {
				image: "clickhouse/clickhouse-server:24-alpine",
				ports: getDefaultPortBindings(serviceKey, config, "clickhouse"),
				volumes: [`${serviceKey}_data:/var/lib/clickhouse`],
				environment: {
					CLICKHOUSE_USER: user,
					CLICKHOUSE_PASSWORD: password,
					CLICKHOUSE_DB: database,
				},
				ulimits: {
					nofile: {
						soft: 262144,
						hard: 262144,
					},
				},
				healthcheck: resolveHealthcheck(
					config.healthCheck,
					defaultHealthcheck,
					{
						internalPort: 8123,
						user,
					},
				),
			},
			volume: `${serviceKey}_data`,
		};
	},
});
