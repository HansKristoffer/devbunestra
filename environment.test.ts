import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevEnvironment } from "./environment";
import { getProjectName } from "./core/ports";
import type { DevConfig, ServiceConfig } from "./types";

function createBaseConfig(
	options?: DevConfig<Record<string, ServiceConfig>, Record<string, never>>["options"],
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
	const root = join(tmpdir(), `buncargo-env-test-${Date.now()}-${Math.random()}`);
	mkdirSync(root, { recursive: true });
	writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: [] }));
	writeFileSync(join(root, ".git"), `gitdir: /tmp/repo/worktrees/${worktreeName}`);
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
			expect(env.projectName).toBe(getProjectName("myapp", "test-feature-a", root));
		} finally {
			process.chdir(originalCwd);
			rmSync(root, { recursive: true, force: true });
		}
	});
});
