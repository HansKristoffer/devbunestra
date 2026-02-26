import type {
	AppConfig,
	HookContext,
	SeedCheckContext,
	ServiceConfig,
} from "../types";

export function createCheckTableHelper<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(
	urls: Record<string, string>,
	exec: (
		cmd: string,
		options?: { throwOnError?: boolean },
	) => Promise<{
		exitCode: number;
		stdout: string;
		stderr: string;
	}>,
): SeedCheckContext<TServices, TApps>["checkTable"] {
	return async (
		tableName: string,
		service?: keyof TServices,
	): Promise<boolean> => {
		const serviceName = (service ?? "postgres") as string;
		const serviceUrl = urls[serviceName];
		if (!serviceUrl) {
			console.warn(`⚠️ Service "${serviceName}" not found for checkTable`);
			return true;
		}
		const checkResult = await exec(
			`psql "${serviceUrl}" -tAc 'SELECT COUNT(*) FROM "${tableName}" LIMIT 1'`,
			{ throwOnError: false },
		);
		const count = checkResult.stdout.trim();
		const shouldSeed =
			checkResult.exitCode !== 0 || count === "0" || count === "";
		if (!shouldSeed) {
			console.log(`  📊 Table "${tableName}" has ${count} rows`);
		}
		return shouldSeed;
	};
}

export function createSeedCheckContext<
	TServices extends Record<string, ServiceConfig>,
	TApps extends Record<string, AppConfig>,
>(
	baseContext: HookContext<TServices, TApps>,
	checkTable: SeedCheckContext<TServices, TApps>["checkTable"],
): SeedCheckContext<TServices, TApps> {
	return {
		...baseContext,
		checkTable,
	};
}
