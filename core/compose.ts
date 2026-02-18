import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type {
	DockerComposeGenerationOptions,
	DockerComposeNode,
	DockerComposeServiceRaw,
	DockerComposeVolumeRaw,
	DockerPresetName,
	DockerPresetServiceDefinition,
	DockerServiceDefinition,
	ServiceConfig,
} from "../types";
import {
	buildPresetDockerService,
	inferDockerPreset,
} from "./docker-services";
import { getDefaultPortBindings } from "./docker-services/shared";

export const DEFAULT_GENERATED_COMPOSE_FILE =
	".buncargo/docker-compose.generated.yml";

type ComposeDocument = {
	services: Record<string, DockerComposeServiceRaw>;
	volumes?: Record<string, DockerComposeVolumeRaw>;
};

function isObject(
	value: DockerComposeNode,
): value is Record<string, DockerComposeNode | undefined> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeNode(base: DockerComposeNode, override: DockerComposeNode): DockerComposeNode {
	if (Array.isArray(base) || Array.isArray(override)) {
		return override;
	}
	if (!isObject(base) || !isObject(override)) {
		return override;
	}

	const merged: Record<string, DockerComposeNode | undefined> = { ...base };
	for (const key of Object.keys(override)) {
		const baseValue = merged[key];
		const overrideValue = override[key];
		if (baseValue === undefined || overrideValue === undefined) {
			merged[key] = overrideValue;
		} else {
			merged[key] = deepMergeNode(baseValue, overrideValue);
		}
	}
	return merged;
}

function isPresetDefinition(
	value: DockerServiceDefinition | undefined,
): value is DockerPresetServiceDefinition {
	return Boolean(
		value &&
			typeof value === "object" &&
			"kind" in value &&
			(value as { kind?: string }).kind === "preset",
	);
}

function normalizeRawService(
	name: string,
	config: ServiceConfig,
	service: DockerComposeServiceRaw,
): DockerComposeServiceRaw {
	const normalized = { ...service };
	if (!normalized.ports || normalized.ports.length === 0) {
		normalized.ports = getDefaultPortBindings(name, config);
	}
	if (config.healthCheck === false) {
		delete normalized.healthcheck;
	}
	return normalized;
}

type NormalizedServiceConfig =
	| {
			kind: "preset";
			serviceName: string;
			preset: DockerPresetName;
			serviceOverride?: DockerComposeServiceRaw;
	  }
	| {
			kind: "raw";
			serviceName: string;
			service: DockerComposeServiceRaw;
	  };

function normalizeServiceConfig(
	name: string,
	config: ServiceConfig,
): NormalizedServiceConfig {
	const serviceName = config.serviceName ?? name;
	const rawDefinition = config.docker;

	if (isPresetDefinition(rawDefinition)) {
		return {
			kind: "preset",
			serviceName,
			preset: rawDefinition.preset,
			serviceOverride: rawDefinition.service,
		};
	}

	if (rawDefinition) {
		const inferredPreset = inferDockerPreset(name);
		if (inferredPreset) {
			return {
				kind: "preset",
				serviceName,
				preset: inferredPreset,
				serviceOverride: rawDefinition,
			};
		}
		return {
			kind: "raw",
			serviceName,
			service: normalizeRawService(name, config, rawDefinition),
		};
	}

	const preset = inferDockerPreset(name);
	if (!preset) {
		throw new Error(
			`Service "${name}" has no docker preset and no docker definition. Add service.docker using helper or raw mode.`,
		);
	}

	return {
		kind: "preset",
		serviceName,
		preset,
	};
}

function resolveServiceDefinition(
	name: string,
	config: ServiceConfig,
): {
	serviceName: string;
	service: DockerComposeServiceRaw;
	volume?: string;
} {
	const normalized = normalizeServiceConfig(name, config);
	if (normalized.kind === "raw") {
		return {
			serviceName: normalized.serviceName,
			service: normalized.service,
		};
	}

	const { service, volume } = buildPresetDockerService(normalized.preset, {
		serviceKey: name,
		config,
	});
	const mergedService = normalized.serviceOverride
		? (deepMergeNode(
				service as DockerComposeNode,
				normalized.serviceOverride as DockerComposeNode,
			) as DockerComposeServiceRaw)
		: service;
	return {
		serviceName: normalized.serviceName,
		service: mergedService,
		volume,
	};
}

export function buildComposeModel(
	services: Record<string, ServiceConfig>,
	docker?: DockerComposeGenerationOptions,
): ComposeDocument {
	const composeServices: Record<string, DockerComposeServiceRaw> = {};
	const composeVolumes: Record<string, DockerComposeVolumeRaw> = {};

	for (const [name, serviceConfig] of Object.entries(services)) {
		const { serviceName, service, volume } = resolveServiceDefinition(
			name,
			serviceConfig,
		);
		composeServices[serviceName] = service;
		if (volume) {
			composeVolumes[volume] = {};
		}
	}

	for (const [volumeName, volume] of Object.entries(docker?.volumes ?? {})) {
		composeVolumes[volumeName] = volume;
	}

	const document: ComposeDocument = {
		services: composeServices,
	};
	if (Object.keys(composeVolumes).length > 0) {
		document.volumes = composeVolumes;
	}
	return document;
}

function formatScalar(value: string | number | boolean | null): string {
	if (value === null) return "null";
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	return String(value);
}

function formatKey(key: string): string {
	return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function sortNode(node: DockerComposeNode): DockerComposeNode {
	if (Array.isArray(node)) {
		return node.map(sortNode);
	}
	if (isObject(node)) {
		const sorted: Record<string, DockerComposeNode | undefined> = {};
		for (const key of Object.keys(node).sort()) {
			const value = node[key];
			if (value !== undefined) {
				sorted[key] = sortNode(value);
			}
		}
		return sorted;
	}
	return node;
}

function stringifyNode(node: DockerComposeNode, indent = 0): string {
	const prefix = " ".repeat(indent);

	if (
		typeof node === "string" ||
		typeof node === "number" ||
		typeof node === "boolean" ||
		node === null
	) {
		return `${prefix}${formatScalar(node)}`;
	}

	if (Array.isArray(node)) {
		if (node.length === 0) return `${prefix}[]`;
		return node
			.map((item) => {
				const isNested = typeof item === "object" && item !== null;
				if (!isNested) {
					return `${prefix}- ${formatScalar(
						item as string | number | boolean | null,
					)}`;
				}
				return `${prefix}-\n${stringifyNode(item, indent + 2)}`;
			})
			.join("\n");
	}

	const entries = Object.entries(node).filter(
		([, value]) => value !== undefined,
	) as Array<[string, DockerComposeNode]>;
	if (entries.length === 0) return `${prefix}{}`;

	return entries
		.map(([key, value]) => {
			const formattedKey = formatKey(key);
			const isNested = typeof value === "object" && value !== null;
			if (!isNested) {
				return `${prefix}${formattedKey}: ${formatScalar(
					value as string | number | boolean | null,
				)}`;
			}
			return `${prefix}${formattedKey}:\n${stringifyNode(value, indent + 2)}`;
		})
		.join("\n");
}

export function composeToYaml(document: ComposeDocument): string {
	const sorted = sortNode(document as DockerComposeNode);
	return `${stringifyNode(sorted)}\n`;
}

export function getGeneratedComposePath(
	root: string,
	docker?: DockerComposeGenerationOptions,
): { absolutePath: string; composeFileArg: string } {
	const generatedFile = docker?.generatedFile ?? DEFAULT_GENERATED_COMPOSE_FILE;
	const absolutePath = isAbsolute(generatedFile)
		? generatedFile
		: resolve(root, generatedFile);
	const relativePath = relative(root, absolutePath);
	const composeFileArg =
		relativePath && !relativePath.startsWith("..") ? relativePath : absolutePath;
	return { absolutePath, composeFileArg };
}

export function writeGeneratedComposeFile(
	root: string,
	services: Record<string, ServiceConfig>,
	docker?: DockerComposeGenerationOptions,
): string {
	const { absolutePath, composeFileArg } = getGeneratedComposePath(root, docker);
	const writeStrategy = docker?.writeStrategy ?? "always";
	const shouldWrite = writeStrategy === "always" || !existsSync(absolutePath);
	if (shouldWrite) {
		const composeModel = buildComposeModel(services, docker);
		const yaml = composeToYaml(composeModel);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, yaml, "utf-8");
	}

	return composeFileArg;
}
