import { startTunnel } from "untun";
import type { AppConfig, DevEnvironment, ServiceConfig } from "../types";

export interface PublicExposeTarget {
	kind: "service" | "app";
	name: string;
	port: number;
}

export interface PublicTunnel {
	kind: "service" | "app";
	name: string;
	localUrl: string;
	publicUrl: string;
	close: () => Promise<void>;
}

interface UntunTunnelLike {
	url?: string;
	publicUrl?: string;
	tunnelUrl?: string;
	close?: () => void | Promise<void>;
	stop?: () => void | Promise<void>;
	destroy?: () => void | Promise<void>;
}

function parseExposeNames(exposeValue?: string): Set<string> | null {
	if (exposeValue === undefined) return null;
	const names = exposeValue
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);
	return new Set(names);
}

function asPublicUrl(tunnel: UntunTunnelLike): string | null {
	return tunnel.url ?? tunnel.publicUrl ?? tunnel.tunnelUrl ?? null;
}

function toCloseFn(tunnel: UntunTunnelLike): () => Promise<void> {
	const close = tunnel.close ?? tunnel.stop ?? tunnel.destroy;
	if (!close) return async () => {};
	return async () => {
		await close();
	};
}

export function resolveExposeTargets<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(
	env: DevEnvironment<TServices, TApps>,
	exposeValue?: string,
): {
	targets: PublicExposeTarget[];
	unknownNames: string[];
	notEnabledNames: string[];
} {
	const requestedNames = parseExposeNames(exposeValue);
	const knownTargets = new Map<string, PublicExposeTarget>();
	const enabledTargets = new Map<string, PublicExposeTarget>();

	for (const [name, config] of Object.entries(env.services)) {
		const port = env.ports[name];
		if (port === undefined) continue;
		const target: PublicExposeTarget = { kind: "service", name, port };
		knownTargets.set(name, target);
		if (config.expose === true) {
			enabledTargets.set(name, target);
		}
	}

	for (const [name, config] of Object.entries(env.apps)) {
		const port = env.ports[name];
		if (port === undefined) continue;
		const target: PublicExposeTarget = { kind: "app", name, port };
		knownTargets.set(name, target);
		if (config.expose === true) {
			enabledTargets.set(name, target);
		}
	}

	if (requestedNames === null) {
		return {
			targets: Array.from(enabledTargets.values()),
			unknownNames: [],
			notEnabledNames: [],
		};
	}

	const unknownNames: string[] = [];
	const notEnabledNames: string[] = [];
	const targets: PublicExposeTarget[] = [];

	for (const name of requestedNames) {
		if (!knownTargets.has(name)) {
			unknownNames.push(name);
			continue;
		}
		const enabledTarget = enabledTargets.get(name);
		if (!enabledTarget) {
			notEnabledNames.push(name);
			continue;
		}
		targets.push(enabledTarget);
	}

	return { targets, unknownNames, notEnabledNames };
}

export async function startPublicTunnels(
	targets: PublicExposeTarget[],
	options: {
		start?: (input: { url: string }) => Promise<UntunTunnelLike>;
	} = {},
): Promise<PublicTunnel[]> {
	const start = options.start ?? ((input) => startTunnel(input));
	const tunnels: PublicTunnel[] = [];

	try {
		for (const target of targets) {
			const localUrl = `http://localhost:${target.port}`;
			const tunnel = (await start({
				url: localUrl,
			})) as UntunTunnelLike;
			const publicUrl = asPublicUrl(tunnel);
			if (!publicUrl) {
				throw new Error(
					`Tunnel for "${target.name}" did not provide a public URL`,
				);
			}
			tunnels.push({
				kind: target.kind,
				name: target.name,
				localUrl,
				publicUrl,
				close: toCloseFn(tunnel),
			});
		}
		return tunnels;
	} catch (error) {
		await stopPublicTunnels(tunnels);
		throw error;
	}
}

export async function stopPublicTunnels(
	tunnels: PublicTunnel[],
): Promise<void> {
	await Promise.allSettled(tunnels.map((tunnel) => tunnel.close()));
}
