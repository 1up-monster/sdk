import { AuthClient } from "@1upmonster/sdk";
import { createKeyPairFromBytes, getAddressFromPublicKey } from "@solana/kit";
import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
} from "../credentials.js";
import { fail, print } from "../output.js";
import { API_BASE } from "../config.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("login")
    .description("Authenticate with your Solana wallet")
    .option("--keypair <path>", "Path to Solana keypair JSON file (headless)")
    .action(async (opts: { keypair?: string }) => {
      const client = new AuthClient(API_BASE);

      if (opts.keypair) {
        // Load 64-byte keypair from Solana CLI JSON format
        const raw = JSON.parse(await readFile(opts.keypair, "utf-8")) as number[];
        const keypair = await createKeyPairFromBytes(Uint8Array.from(raw));
        const publicKey = await getAddressFromPublicKey(keypair.publicKey);

        const session = await client.login({
          publicKey,
          signMessage: async (msg) => {
            const sig = await crypto.subtle.sign("Ed25519", keypair.privateKey, msg);
            return new Uint8Array(sig);
          },
        });

        await saveCredentials({
          token: session.token,
          walletPubkey: session.walletPubkey,
          expiresAt: session.expiresAt,
        });
        print(`Logged in as ${session.walletPubkey}`);
      } else {
        fail(
          "Interactive wallet signing not yet implemented. Use --keypair <path> for now."
        );
      }
    });

  auth
    .command("logout")
    .description("Clear saved credentials")
    .action(async () => {
      await clearCredentials();
      print("Logged out.");
    });

  auth
    .command("status")
    .description("Show current auth status")
    .action(async () => {
      const creds = await loadCredentials();
      if (!creds?.token) {
        print("Not authenticated.");
      } else {
        print({ walletPubkey: creds.walletPubkey, expiresAt: creds.expiresAt });
      }
    });
}
