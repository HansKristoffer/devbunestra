export function showVersion(): void {
	const pkg = require("../../../package.json");
	console.log(`buncargo v${pkg.version}`);
}
