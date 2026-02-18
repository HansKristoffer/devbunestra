// ═══════════════════════════════════════════════════════════════════════════
// Main Exports
// ═══════════════════════════════════════════════════════════════════════════

// CLI runner
export { getFlagValue, hasFlag, runCli } from "./cli";
// Config factory
export {
	assertValidConfig,
	defineDevConfig,
	mergeConfigs,
	validateConfig,
} from "./config";
// Environment factory
export { createDevEnvironment } from "./environment";
// Service helpers
export { service } from "./core/docker-services";
export type {
	ClickhouseServiceOptions,
	CustomServiceOptions,
	PostgresServiceOptions,
	RedisServiceOptions,
} from "./core/docker-services";
// Lint / Typecheck
export {
	runWorkspaceTypecheck,
	type TypecheckResult,
	type WorkspaceTypecheckOptions,
	type WorkspaceTypecheckResult,
} from "./lint";
// Config loader (for programmatic access)
export { clearDevEnvCache, getDevEnv, loadDevEnv } from "./loader";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type {
	AppConfig,
	BuiltInHealthCheck,
	// CLI
	CliOptions,
	// Computed types
	ComputedPorts,
	ComputedUrls,
	// Main config
	DevConfig,
	DockerComposeGenerationOptions,
	DockerComposeHealthcheckRaw,
	DockerComposeNode,
	DockerComposeServiceRaw,
	DockerComposeVolumeRaw,
	// Environment interface
	DevEnvironment,
	DevHooks,
	DevOptions,
	DevServerPids,
	DockerPresetName,
	DockerPresetServiceDefinition,
	DockerServiceDefinition,
	EnvVarsBuilder,
	ExecOptions,
	HealthCheckFn,
	HookContext,
	// Migrations & Seed
	MigrationConfig,
	// Prisma
	PrismaConfig,
	PrismaRunner,
	SeedCheckContext,
	SeedCheckHelpers,
	SeedConfig,
	// Service & App configs
	ServiceConfig,
	// Start/Stop options
	StartOptions,
	StopOptions,
	UrlBuilderContext,
	UrlBuilderFn,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Core Utilities (for advanced use cases)
// ═══════════════════════════════════════════════════════════════════════════

export {
	buildComposeModel,
	composeToYaml,
	DEFAULT_GENERATED_COMPOSE_FILE,
	getGeneratedComposePath,
	writeGeneratedComposeFile,
} from "./core/compose";
export {
	areContainersRunning,
	assertDockerRunning,
	DOCKER_NOT_RUNNING_MESSAGE,
	isContainerRunning,
	isDockerRunning,
	MAX_ATTEMPTS,
	POLL_INTERVAL,
} from "./core/docker";

export { getLocalIp, isPortAvailable, waitForServer } from "./core/network";
export {
	computeDevIdentity,
	calculatePortOffset,
	findMonorepoRoot,
	getProjectName,
	getWorktreeProjectSuffix,
	getWorktreeName,
	isWorktree,
} from "./core/ports";

export {
	getProcessOnPort,
	isPortInUse,
	isProcessAlive,
	killProcessesOnAppPorts,
	killProcessOnPort,
	killProcessOnPortAndWait,
} from "./core/process";
export {
	getEnvVar,
	isCI,
	logApiUrl,
	logExpoApiUrl,
	logFrontendPort,
	sleep,
} from "./core/utils";
export {
	getHeartbeatFile,
	getWatchdogPidFile,
	isWatchdogRunning,
	spawnWatchdog,
	startHeartbeat,
	stopHeartbeat,
	stopWatchdog,
} from "./core/watchdog";
