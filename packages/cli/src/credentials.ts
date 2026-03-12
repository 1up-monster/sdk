import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "1upmonster");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");

export interface Credentials {
  token: string;
  walletPubkey: string;
  expiresAt: number;
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

export async function loadCredentials(): Promise<Credentials | null> {
  // Env var takes priority (CI / agent use)
  const envKey = process.env["ONEUP_API_KEY"];
  const envWallet = process.env["ONEUP_WALLET"];
  if (envKey && envWallet) {
    return { token: envKey, walletPubkey: envWallet, expiresAt: Infinity };
  }

  try {
    const raw = await readFile(CREDENTIALS_FILE, "utf-8");
    const creds = JSON.parse(raw) as Credentials;
    if (!creds.token) return null;
    // Reject expired credentials so callers don't send stale JWTs (GAP-25)
    if (creds.expiresAt !== Infinity && creds.expiresAt < Date.now()) return null;
    return creds;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE); // delete entirely, not overwrite with {} (GAP-26)
  } catch {
    // file may not exist — that's fine
  }
}

export async function requireCredentials(): Promise<Credentials> {
  const creds = await loadCredentials();
  if (!creds?.token) {
    console.error(
      "Not authenticated. Run: 1up auth login --keypair <path> or set ONEUP_API_KEY"
    );
    process.exit(1);
  }
  return creds;
}
