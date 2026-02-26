import type {
	BuiltInHealthCheck,
	DockerComposeHealthcheckRaw,
	DockerComposeServiceRaw,
} from "../../types";
import { defineDockerService } from "./define-docker-service";
import { getDefaultPortBindings, resolveHealthcheck } from "./shared";

export type PostgresServiceOptions = {
	port?: number;
	expose?: boolean;
	healthCheck?: BuiltInHealthCheck | false;
	serviceName?: string;
	database?: string;
	user?: string;
	password?: string;
	docker?: DockerComposeServiceRaw;
};

export const postgresDockerService =
	defineDockerService<PostgresServiceOptions>({
		preset: "postgres",
		defaults: {
			port: 5432,
			healthCheck: "pg_isready",
		},
		build: ({ serviceKey, config }) => {
			const user = config.user ?? "postgres";
			const password = config.password ?? "postgres";
			const database = config.database ?? "postgres";
			const defaultHealthcheck: DockerComposeHealthcheckRaw = {
				test: ["CMD-SHELL", `pg_isready -U ${user}`],
				interval: "250ms",
				timeout: "5s",
				retries: 20,
			};

			return {
				service: {
					image: "pgvector/pgvector:pg16",
					ports: getDefaultPortBindings(serviceKey, config, "postgres"),
					volumes: [`${serviceKey}_data:/var/lib/postgresql/data`],
					environment: {
						POSTGRES_USER: user,
						POSTGRES_PASSWORD: password,
						POSTGRES_DB: database,
					},
					healthcheck: resolveHealthcheck(
						config.healthCheck,
						defaultHealthcheck,
						{
							internalPort: 5432,
							user,
						},
					),
				},
				volume: `${serviceKey}_data`,
			};
		},
	});
