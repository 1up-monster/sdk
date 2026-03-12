import { VersusClient } from "@1upmonster/versus";
import type {
  EloAggregate,
  EloRpcFailBehavior,
  EloType,
  ExpireBehavior,
  VersusConfig,
} from "@1upmonster/types";
import type { Command } from "commander";
import { requireCredentials } from "../../credentials.js";
import { fail, print } from "../../output.js";
import { API_BASE } from "../../config.js";

export function registerVersusConfig(versus: Command): void {
  const config = versus.command("config").description("Manage Versus config");

  config
    .command("get <gameId>")
    .description("Show Versus config for a game")
    .action(async (gameId: string) => {
      const creds = await requireCredentials();
      const client = new VersusClient({ baseUrl: API_BASE, token: creds.token });
      const result = await client.getConfig(gameId).catch((e: Error) => fail(e.message));
      print(result);
    });

  config
    .command("set <gameId>")
    .description("Set Versus config for a game")
    .option("--elo-account-type <type>", "pda or static")
    .option("--elo-seeds <seeds>", "Comma-separated PDA seeds (use {wallet} for player pubkey)")
    .option("--elo-program-id <programId>", "Program ID for PDA derivation")
    .option("--elo-address <address>", "Static account address (use {wallet} for player pubkey)")
    .option("--elo-offset <n>", "Byte offset of ELO field", parseInt)
    .option("--elo-type <type>", "ELO field data type (u8/u16/u32/u64/i8/i16/i32/i64)")
    .option("--elo-endian <endian>", "Byte order: little or big (default: little)")
    .option("--elo-default <n>", "Default ELO for new players", parseInt)
    .option("--elo-rpc-fail <behavior>", "reject | use_default | use_cached")
    .option("--authority-offset <n>", "Byte offset of authority pubkey (32 bytes) in the account. When set, verifies account owner matches authenticated wallet.", parseInt)
    .option("--players-per-team <n>", "Players per team (1 for 1v1, 5 for 5v5)", parseInt)
    .option("--teams <n>", "Number of teams (default: 2)", parseInt)
    .option("--elo-aggregate <agg>", "Team ELO aggregate: average | max | min")
    .option("--queue-ttl <s>", "Queue TTL in seconds", parseInt)
    .option("--match-ttl <s>", "Match TTL in seconds", parseInt)
    .option("--accept-window <s>", "Match accept window in seconds", parseInt)
    .option("--expire-behavior <behavior>", "expire | match_any")
    .action(async (gameId: string, opts: Record<string, unknown>) => {
      const creds = await requireCredentials();
      const client = new VersusClient({ baseUrl: API_BASE, token: creds.token });

      const patch: Partial<VersusConfig> = {};

      // ELO source
      if (opts["eloAccountType"] === "pda") {
        if (!opts["eloProgramId"]) fail("--elo-program-id required for pda type");
        patch.eloSource = {
          account: {
            type: "pda",
            seeds: String(opts["eloSeeds"] ?? "").split(","),
            programId: opts["eloProgramId"] as string,
          },
          offset: (opts["eloOffset"] as number | undefined) ?? 0,
          type: (opts["eloType"] as EloType | undefined) ?? "u32",
          endian: (opts["eloEndian"] as "little" | "big" | undefined) ?? "little",
          default: (opts["eloDefault"] as number | undefined) ?? 1000,
          rpcFailBehavior: (opts["eloRpcFail"] as EloRpcFailBehavior | undefined) ?? "use_default",
          ...(opts["authorityOffset"] !== undefined && { authorityOffset: opts["authorityOffset"] as number }),
        };
      } else if (opts["eloAccountType"] === "static") {
        if (!opts["eloAddress"]) fail("--elo-address required for static type");
        patch.eloSource = {
          account: { type: "static", address: opts["eloAddress"] as string },
          offset: (opts["eloOffset"] as number | undefined) ?? 0,
          type: (opts["eloType"] as EloType | undefined) ?? "u32",
          endian: (opts["eloEndian"] as "little" | "big" | undefined) ?? "little",
          default: (opts["eloDefault"] as number | undefined) ?? 1000,
          rpcFailBehavior: (opts["eloRpcFail"] as EloRpcFailBehavior | undefined) ?? "use_default",
          ...(opts["authorityOffset"] !== undefined && { authorityOffset: opts["authorityOffset"] as number }),
        };
      }

      if (opts["playersPerTeam"] !== undefined || opts["teams"] !== undefined) {
        patch.matchFormat = {
          playersPerTeam: (opts["playersPerTeam"] as number | undefined) ?? 1,
          teams: (opts["teams"] as number | undefined) ?? 2,
          eloAggregate: (opts["eloAggregate"] as EloAggregate | undefined) ?? "average",
        };
      }

      if (opts["queueTtl"] !== undefined) patch.queueTtl = opts["queueTtl"] as number;
      if (opts["matchTtl"] !== undefined) patch.matchTtl = opts["matchTtl"] as number;
      if (opts["acceptWindow"] !== undefined) patch.acceptWindow = opts["acceptWindow"] as number;
      if (opts["expireBehavior"] !== undefined) patch.expireBehavior = opts["expireBehavior"] as ExpireBehavior;

      const result = await client.setConfig(gameId, patch).catch((e: Error) => fail(e.message));
      print(result);
    });
}
