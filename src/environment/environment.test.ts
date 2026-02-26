import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getProjectName } from "../core/ports";
import type { DevConfig, ServiceConfig } from "../types";
import { createDevEnvironment } from ".";

function createBaseConfig(
	options?: DevConfig<
		Record<string, ServiceConfig>,
		Record<string, never>
	>["options"],
): DevConfig<Record<string, ServiceConfig>, Record<string, never>> {
	return {
		projectPrefix: "myapp",
		services: {
			postgres: { port: 5432 },
		},
		options,
	};
}

function createWorktreeRoot(worktreeName: string): string {
	const root = join(
		tmpdir(),
		`buncargo-env-test-${Date.now()}-${Math.random()}`,
	);
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: [] }));
	writeFileSync(
		join(root, ".git"),
		`gitdir: /tmp/repo/worktrees/${worktreeName}`,
	);
	return root;
}

const originalCwd = process.cwd();

afterEach(() => {
	process.chdir(originalCwd);
});

describe("createDevEnvironment worktree isolation", () => {
	it("uses worktree suffix in projectName when isolation is enabled (default)", () => {
		const root = createWorktreeRoot("Feature_A");
		try {
			process.chdir(root);
			const env = createDevEnvironment(createBaseConfig());
			expect(env.projectName).toBe(getProjectName("myapp", "feature-a", root));
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("does not include worktree suffix when isolation is disabled", () => {
		const root = createWorktreeRoot("Feature_A");
		try {
			process.chdir(root);
			const env = createDevEnvironment(
				createBaseConfig({ worktreeIsolation: false }),
			);
			expect(env.projectName).toBe(getProjectName("myapp", undefined, root));
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("composes explicit suffix with worktree suffix in stable order", () => {
		const root = createWorktreeRoot("Feature_A");
		try {
			process.chdir(root);
			const env = createDevEnvironment(createBaseConfig(), { suffix: "test" });
			expect(env.projectName).toBe(
				getProjectName("myapp", "test-feature-a", root),
			);
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});
});

describe("createDevEnvironment compose generation", () => {
	it("uses generated compose path by default", () => {
		const root = createWorktreeRoot("Feature_Compose_Default");
		try {
			process.chdir(root);
			const env = createDevEnvironment(createBaseConfig());
			const composeFile = env.ensureComposeFile();

			expect(env.composeFile).toBe(".buncargo/docker-compose.generated.yml");
			expect(composeFile).toBe(".buncargo/docker-compose.generated.yml");
			expect(
				existsSync(join(root, ".buncargo/docker-compose.generated.yml")),
			).toBe(true);
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("respects custom generated compose path from docker config", () => {
		const root = createWorktreeRoot("Feature_Compose_Custom");
		try {
			process.chdir(root);
			const env = createDevEnvironment({
				...createBaseConfig(),
				docker: {
					generatedFile: ".buncargo/custom-compose.yml",
				},
			});
			const composeFile = env.ensureComposeFile();

			expect(env.composeFile).toBe(".buncargo/custom-compose.yml");
			expect(composeFile).toBe(".buncargo/custom-compose.yml");
			expect(existsSync(join(root, ".buncargo/custom-compose.yml"))).toBe(true);
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});
});
