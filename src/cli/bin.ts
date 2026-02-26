#!/usr/bin/env bun

/**
 * CLI Entry Point for buncargo
 *
 * Usage:
 *   bunx buncargo dev           # Start containers + dev servers
 *   bunx buncargo dev --down    # Stop containers
 *   bunx buncargo dev --reset   # Stop + remove volumes
 *   bunx buncargo typecheck     # Run TypeScript typecheck
 *   bunx buncargo prisma ...    # Run prisma commands
 *   bunx buncargo help          # Show help
 */

import { showHelp } from "./commands/help";
import {
	handleDev,
	handleEnv,
	handlePrisma,
	handleTypecheck,
} from "./commands/runtime";
import { showVersion } from "./commands/version";

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];
	const commandArgs = args.slice(1);

	if (
		!command ||
		command === "help" ||
		command === "--help" ||
		command === "-h"
	) {
		showHelp();
		process.exit(0);
	}

	if (command === "version" || command === "--version" || command === "-v") {
		showVersion();
		process.exit(0);
	}

	switch (command) {
		case "dev":
			await handleDev(commandArgs);
			break;

		case "typecheck":
			await handleTypecheck();
			break;

		case "prisma":
			await handlePrisma(commandArgs);
			break;

		case "env":
			await handleEnv();
			break;

		default:
			console.error(`❌ Unknown command: ${command}`);
			console.error("");
			console.error('   Run "bunx buncargo help" for available commands.');
			process.exit(1);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`❌ ${message}`);
	process.exit(1);
});
