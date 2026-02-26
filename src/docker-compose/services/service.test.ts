import { describe, expect, it } from "bun:test";
import { service } from ".";

describe("service helpers", () => {
	it("builds postgres with defaults", () => {
		const cfg = service.postgres();
		expect(cfg.port).toBe(5432);
		expect(cfg.healthCheck).toBe("pg_isready");
		expect(cfg.docker).toEqual({
			kind: "preset",
			preset: "postgres",
			service: undefined,
		});
	});

	it("builds redis with defaults", () => {
		const cfg = service.redis();
		expect(cfg.port).toBe(6379);
		expect(cfg.healthCheck).toBe("redis-cli");
		expect(cfg.docker).toEqual({
			kind: "preset",
			preset: "redis",
			service: undefined,
		});
	});

	it("builds clickhouse with defaults", () => {
		const cfg = service.clickhouse();
		expect(cfg.port).toBe(8123);
		expect(cfg.secondaryPort).toBe(9000);
		expect(cfg.healthCheck).toBe("http");
		expect(cfg.docker).toEqual({
			kind: "preset",
			preset: "clickhouse",
			service: undefined,
		});
	});

	it("supports custom service pass-through", () => {
		const cfg = service.custom({
			port: 4222,
			healthCheck: false,
			docker: {
				image: "nats:2-alpine",
				ports: ["$" + "{NATS_PORT:-4222}:4222"],
			},
		});

		expect(cfg.port).toBe(4222);
		expect(cfg.healthCheck).toBe(false);
		expect(cfg.docker).toEqual({
			image: "nats:2-alpine",
			ports: ["$" + "{NATS_PORT:-4222}:4222"],
		});
	});

	it("passes through expose option on helper services", () => {
		const postgres = service.postgres({ expose: true });
		const redis = service.redis({ expose: true });

		expect(postgres.expose).toBe(true);
		expect(redis.expose).toBe(true);
	});
});
