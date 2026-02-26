import pc from "picocolors";

function formatUrl(url: string): string {
	return pc.cyan(
		url.replace(/:(\d+)(\/?)/, (_, port, slash) => `:${pc.bold(port)}${slash}`),
	);
}

function formatLabel(label: string, value: string, arrow = "➜"): string {
	return `  ${pc.green(arrow)}  ${pc.bold(label.padEnd(10))} ${value}`;
}

function formatDimLabel(label: string, value: string): string {
	return `  ${pc.dim("•")}  ${pc.dim(label.padEnd(10))} ${pc.dim(value)}`;
}

export function logEnvironmentInfo(input: {
	label: string;
	projectName: string;
	services: Record<string, unknown>;
	apps: Record<string, unknown>;
	ports: Record<string, number>;
	localIp: string;
	worktree: boolean;
	portOffset: number;
	projectSuffix?: string;
}): void {
	const {
		label,
		projectName,
		services,
		apps,
		ports,
		localIp,
		worktree,
		portOffset,
		projectSuffix,
	} = input;
	const serviceNames = Object.keys(services);
	const appNames = Object.keys(apps);

	console.log("");
	console.log(`  ${pc.cyan(pc.bold(`🐳 ${label}`))}`);
	console.log(formatLabel("Project:", pc.white(projectName)));

	if (serviceNames.length > 0) {
		console.log("");
		console.log(`  ${pc.dim("─── Services ───")}`);
		for (const name of serviceNames) {
			const port = ports[name];
			const url = `localhost:${port}`;
			console.log(formatLabel(`${name}:`, formatUrl(`http://${url}`)));
		}
	}

	if (appNames.length > 0) {
		console.log("");
		console.log(`  ${pc.dim("─── Applications ───")}`);
		for (const name of appNames) {
			const port = ports[name];
			const localUrl = `http://localhost:${port}`;
			const networkUrl = `http://${localIp}:${port}`;

			console.log(`  ${pc.green("➜")}  ${pc.bold(pc.cyan(name))}`);
			console.log(`       ${pc.dim("Local:")}   ${formatUrl(localUrl)}`);
			console.log(`       ${pc.dim("Network:")} ${formatUrl(networkUrl)}`);
		}
	}

	console.log("");
	console.log(`  ${pc.dim("─── Environment ───")}`);
	console.log(formatDimLabel("Worktree:", worktree ? "yes" : "no"));
	console.log(
		formatDimLabel("Port offset:", portOffset > 0 ? `+${portOffset}` : "none"),
	);
	if (projectSuffix) {
		console.log(formatDimLabel("Suffix:", projectSuffix));
	}
	console.log(formatDimLabel("Local IP:", localIp));
	console.log("");
}

export function logPublicUrls(
	tunnels: Array<{
		kind: "service" | "app";
		name: string;
		publicUrl: string;
		localUrl: string;
	}>,
): void {
	if (tunnels.length === 0) return;

	console.log("");
	console.log(`  ${pc.dim("─── Public URLs (Quick Tunnel) ───")}`);
	for (const tunnel of tunnels) {
		const label = `${tunnel.name} (${tunnel.kind})`;
		console.log(formatLabel(`${label}:`, formatUrl(tunnel.publicUrl), "🌐"));
		console.log(formatDimLabel("Local target:", tunnel.localUrl));
	}
	console.log("");
}
