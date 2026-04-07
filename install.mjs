import "dotenv/config";
import { cpSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(__dirname, "manifest.json"), "utf-8"));
const pluginId = manifest.id;

const files = ["main.js", "manifest.json"];

const vaultPath = process.env.OBSIDIAN_VAULT_PATH;

if (!vaultPath) {
	console.log("OBSIDIAN_VAULT_PATH not set. Skipping vault install.");
	console.log("To install to a dev vault, create a .env file with:");
	console.log("  OBSIDIAN_VAULT_PATH=/path/to/your/vault");
	process.exit(0);
}

const pluginDir = resolve(vaultPath, ".obsidian/plugins", pluginId);
mkdirSync(pluginDir, { recursive: true });

for (const file of files) {
	cpSync(resolve(__dirname, file), resolve(pluginDir, file));
	console.log(`  ${file} → ${pluginDir}/${file}`);
}

console.log(`\nPlugin installed to: ${pluginDir}`);
