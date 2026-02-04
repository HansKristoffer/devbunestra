import { describe, expect, it } from "bun:test";
import { mergeConfigs, validateConfig } from "./config";
import type { AppConfig, DevConfig, ServiceConfig } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createValidConfig(): DevConfig<
	{ postgres: ServiceConfig },
	{ api: AppConfig }
> {
	return {
		projectPrefix: "myapp",
		services: {
			postgres: { port: 5432 },
		},
		apps: {
			api: { port: 3000, devCommand: "bun run dev" },
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// validateConfig Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("validateConfig", () => {
	describe("projectPrefix validation", () => {
		it("returns error when projectPrefix is missing", () => {
			const config = createValidConfig();
			config.projectPrefix = "";

			const errors = validateConfig(config);

			expect(errors).toContain("projectPrefix is required");
		});

		it("returns error when projectPrefix starts with number", () => {
			const config = createValidConfig();
			config.projectPrefix = "1myapp";

			const errors = validateConfig(config);

			expect(errors).toContain(
				"projectPrefix must start with a letter and contain only lowercase letters, numbers, and hyphens",
			);
		});

		it("returns error when projectPrefix contains uppercase", () => {
			const config = createValidConfig();
			config.projectPrefix = "MyApp";

			const errors = validateConfig(config);

			expect(errors).toContain(
				"projectPrefix must start with a letter and contain only lowercase letters, numbers, and hyphens",
			);
		});

		it("returns error when projectPrefix contains special characters", () => {
			const config = createValidConfig();
			config.projectPrefix = "my_app";

			const errors = validateConfig(config);

			expect(errors).toContain(
				"projectPrefix must start with a letter and contain only lowercase letters, numbers, and hyphens",
			);
		});

		it("accepts valid projectPrefix with letters, numbers, and hyphens", () => {
			const config = createValidConfig();
			config.projectPrefix = "my-app-123";

			const errors = validateConfig(config);

			expect(errors).not.toContain(
				"projectPrefix must start with a letter and contain only lowercase letters, numbers, and hyphens",
			);
		});
	});

	describe("services validation", () => {
		it("returns error when services is empty", () => {
			const config = createValidConfig();
			// @ts-expect-error - testing invalid config
			config.services = {};

			const errors = validateConfig(config);

			expect(errors).toContain("At least one service is required");
		});

		it("returns error when service has no port", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 5432 },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toContain(
				'Service "postgres" must have a valid port number',
			);
		});

		it("returns error when service port is 0", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 0 },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toContain(
				'Service "postgres" port must be between 1 and 65535',
			);
		});

		it("returns error when service port exceeds 65535", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 65536 },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toContain(
				'Service "postgres" port must be between 1 and 65535',
			);
		});

		it("accepts valid service port", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 5432 },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toHaveLength(0);
		});
	});

	describe("apps validation", () => {
		it("returns error when app has no devCommand", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 5432 },
				},
				apps: {
					api: { port: 3000, devCommand: "bun run dev" },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toContain('App "api" must have a devCommand');
		});

		it("returns error when app has no port", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 5432 },
				},
				apps: {
					api: { port: 3000, devCommand: "bun run dev" },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toContain('App "api" must have a valid port number');
		});

		it("accepts valid app config", () => {
			const config = createValidConfig();

			const errors = validateConfig(config);

			expect(errors).toHaveLength(0);
		});
	});

	describe("valid config", () => {
		it("returns empty errors array for valid config", () => {
			const config = createValidConfig();

			const errors = validateConfig(config);

			expect(errors).toHaveLength(0);
		});

		it("accepts config without apps", () => {
			const config = {
				projectPrefix: "myapp",
				services: {
					postgres: { port: 5432 },
				},
			};

			const errors = validateConfig(config);

			expect(errors).toHaveLength(0);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// mergeConfigs Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("mergeConfigs", () => {
	it("merges projectPrefix from override", () => {
		const base = createValidConfig();
		const override = { projectPrefix: "newapp" };

		const result = mergeConfigs(base, override);

		expect(result.projectPrefix).toBe("newapp");
	});

	it("deep merges services", () => {
		const base = createValidConfig();
		const override = {
			services: {
				redis: { port: 6379 },
			},
		};

		// @ts-expect-error - testing merge behavior
		const result = mergeConfigs(base, override);

		expect(result.services.postgres).toEqual({ port: 5432 });
		// @ts-expect-error - testing merge behavior
		expect(result.services.redis).toEqual({ port: 6379 });
	});

	it("deep merges apps", () => {
		const base = createValidConfig();
		const override = {
			apps: {
				web: { port: 5173, devCommand: "bun run dev:web" },
			},
		};

		// @ts-expect-error - testing merge behavior
		const result = mergeConfigs(base, override);

		expect(result.apps?.api).toEqual({ port: 3000, devCommand: "bun run dev" });
		// @ts-expect-error - testing merge behavior
		expect(result.apps?.web).toEqual({
			port: 5173,
			devCommand: "bun run dev:web",
		});
	});

	it("deep merges hooks", () => {
		const hook1 = async () => {};
		const hook2 = async () => {};

		const base: DevConfig<
			{ postgres: ServiceConfig },
			Record<string, never>
		> = {
			projectPrefix: "myapp",
			services: { postgres: { port: 5432 } },
			hooks: { afterContainersReady: hook1 },
		};
		const override = {
			hooks: { beforeServers: hook2 },
		};

		const result = mergeConfigs(base, override);

		expect(result.hooks?.afterContainersReady).toBe(hook1);
		expect(result.hooks?.beforeServers).toBe(hook2);
	});

	it("deep merges options", () => {
		const base: DevConfig<
			{ postgres: ServiceConfig },
			Record<string, never>
		> = {
			projectPrefix: "myapp",
			services: { postgres: { port: 5432 } },
			options: { worktreeIsolation: true, verbose: true },
		};
		const override = {
			options: { verbose: false },
		};

		const result = mergeConfigs(base, override);

		expect(result.options?.worktreeIsolation).toBe(true);
		expect(result.options?.verbose).toBe(false);
	});

	it("override takes precedence for conflicting values", () => {
		const base = createValidConfig();
		const override = {
			services: {
				postgres: { port: 5433 },
			},
		};

		const result = mergeConfigs(base, override);

		expect(result.services.postgres.port).toBe(5433);
	});
});
