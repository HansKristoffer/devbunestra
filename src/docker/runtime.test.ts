import { describe, expect, it } from "bun:test";
import { getComposeArg } from "./runtime";

describe("getComposeArg", () => {
	it("returns empty string when compose file is not provided", () => {
		expect(getComposeArg()).toBe("");
	});

	it("returns quoted -f arg when compose file is provided", () => {
		expect(getComposeArg(".buncargo/docker-compose.generated.yml")).toBe(
			'-f ".buncargo/docker-compose.generated.yml"',
		);
	});
});
