import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "__mocks__/obsidian.ts"),
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
