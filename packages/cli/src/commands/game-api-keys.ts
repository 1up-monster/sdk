import { TenantClient } from "@1upmonster/sdk";
import type { Command } from "commander";
import { requireCredentials } from "../credentials.js";
import { fail, print, printTable } from "../output.js";
import { API_BASE } from "../config.js";

export function registerGameApiKeys(game: Command): void {
  const apiKey = game.command("api-key").description("Manage game API keys");

  apiKey
    .command("create <gameId>")
    .description("Create a new API key for a game")
    .option("--name <name>", "Key label", "default")
    .action(async (gameId: string, opts: { name: string }) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const result = await client.createApiKey(gameId, opts.name).catch((e: Error) => fail(e.message));
      print("⚠  Store this key — it will not be shown again.");
      print(result);
    });

  apiKey
    .command("list <gameId>")
    .description("List API keys for a game")
    .action(async (gameId: string) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const keys = await client.listApiKeys(gameId).catch((e: Error) => fail(e.message));
      printTable(keys as unknown as Record<string, unknown>[]);
    });

  apiKey
    .command("revoke <gameId> <keyId>")
    .description("Revoke an API key")
    .action(async (gameId: string, keyId: string) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      await client.revokeApiKey(gameId, keyId).catch((e: Error) => fail(e.message));
      print(`Key ${keyId} revoked.`);
    });
}
