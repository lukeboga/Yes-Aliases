import { cpSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(__dirname, "manifest.json"), "utf-8"));
const pluginId = manifest.id;

const files = ["main.js", "manifest.json"];

// Build output — portable directory ready to copy into any vault
const buildDir = resolve(__dirname, "../../build", pluginId);
mkdirSync(buildDir, { recursive: true });
for (const file of files) {
	cpSync(resolve(__dirname, file), resolve(buildDir, file));
	console.log(`  ${file} → build/${pluginId}/${file}`);
}
console.log(`\nBuild output: build/${pluginId}/`);

// Also install to dev vault
const vaultDir = resolve(__dirname, "../../MakoNP-Test/.obsidian/plugins", pluginId);
mkdirSync(vaultDir, { recursive: true });
for (const file of files) {
	cpSync(resolve(__dirname, file), resolve(vaultDir, file));
}
console.log(`Dev vault updated: MakoNP-Test/.obsidian/plugins/${pluginId}/`);
