import { TenantClient } from "@1upmonster/sdk";
import type { Command } from "commander";
import { requireCredentials } from "../credentials.js";
import { fail, print } from "../output.js";
import { API_BASE } from "../config.js";

export function registerTenant(program: Command): Command {
  const tenant = program.command("tenant").description("Manage your tenant");

  tenant
    .command("create")
    .description("Create a new tenant account")
    .requiredOption("--name <name>", "Tenant/studio name")
    .action(async (opts: { name: string }) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const result = await client.createTenant(opts.name).catch((e: Error) => fail(e.message));
      print(result);
    });

  tenant
    .command("info")
    .description("Show current tenant info")
    .action(async () => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const result = await client.getTenant().catch((e: Error) => fail(e.message));
      print(result);
    });

  const game = program.command("game").description("Manage games");

  game
    .command("create")
    .description("Register a new game")
    .requiredOption("--name <name>", "Game name")
    .action(async (opts: { name: string }) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const result = await client.createGame(opts.name).catch((e: Error) => fail(e.message));
      print(result);
    });

  game
    .command("list")
    .description("List all games")
    .action(async () => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      const result = await client.listGames().catch((e: Error) => fail(e.message));
      print(result);
    });

  game
    .command("delete <gameId>")
    .description("Delete a game")
    .action(async (gameId: string) => {
      const creds = await requireCredentials();
      const client = new TenantClient(API_BASE, creds.token);
      await client.deleteGame(gameId).catch((e: Error) => fail(e.message));
      print(`Game ${gameId} deleted.`);
    });

  return game;
}
