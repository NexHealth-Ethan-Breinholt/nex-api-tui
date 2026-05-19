import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".config", "nex-api-tui");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface SavedConfig {
  apiKey: string;
  subdomain: string;
}

export function loadConfig(): SavedConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    if (typeof raw.apiKey === "string" && raw.apiKey) {
      return { apiKey: raw.apiKey, subdomain: raw.subdomain ?? "" };
    }
  } catch { /* ignore */ }
  return null;
}

export function saveConfig(config: SavedConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  try { unlinkSync(CONFIG_FILE); } catch { /* ignore */ }
}
