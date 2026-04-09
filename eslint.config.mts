import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"eslint.config.js",
						"manifest.json",
					],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		plugins: { obsidianmd },
		rules: {
			// Wikilink syntax (e.g. [[Note#Heading]]) and inline code spans must
			// be preserved verbatim — they are Obsidian syntax, not prose.
			// Also exempt common proper nouns and quarter labels we use in copy.
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					ignoreRegex: [
						"\\[\\[[^\\]]*\\]\\]",
						"`[^`]*`",
						"\"[A-Z][^\"]*\"",
						"Q[0-9]+",
					],
					ignoreWords: [
						"Compress",
						"Propagate",
						"Note",
						"Heading",
						"Custom",
						"Cancel",
						"Enter",
					],
				},
			],
		},
	},
	globalIgnores([
		"node_modules",
		"__mocks__",
		"esbuild.config.mjs",
		"install.mjs",
		"version-bump.mjs",
		"vitest.config.ts",
		"main.js",
		"tests",
	]),
);
