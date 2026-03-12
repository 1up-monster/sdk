import { VersusClient } from "@1upmonster/versus";
import type { Command } from "commander";
import { requireCredentials } from "../../credentials.js";
import { fail, print, printTable } from "../../output.js";
import { API_BASE } from "../../config.js";

export function registerVersusMatch(versus: Command): void {
  const match = versus.command("match").description("Inspect matches");

  match
    .command("list <gameId>")
    .description("List active matches for a game")
    .action(async (gameId: string) => {
      const creds = await requireCredentials();
      const client = new VersusClient({ baseUrl: API_BASE, token: creds.token });
      const matches = await client.listMatches(gameId).catch((e: Error) => fail(e.message));
      printTable(
        matches.map((m) => ({
          id: m.id,
          state: m.state,
          players: m.teams.flatMap((t) => t.players.map((p) => p.walletPubkey)).join(", "),
          createdAt: new Date(m.createdAt).toISOString(),
          expiresAt: new Date(m.expiresAt).toISOString(),
        }))
      );
    });

  match
    .command("inspect <matchId>")
    .description("Show full details of a match")
    .action(async (matchId: string) => {
      const creds = await requireCredentials();
      const client = new VersusClient({ baseUrl: API_BASE, token: creds.token });
      const result = await client.inspectMatch(matchId).catch((e: Error) => fail(e.message));
      print(result);
    });

  const queue = versus.command("queue").description("Queue stats");

  queue
    .command("status <gameId>")
    .description("Show live queue stats for a game")
    .action(async (gameId: string) => {
      const creds = await requireCredentials();
      const res = await fetch(`${API_BASE}/versus/${gameId}/queue/status`, {
        headers: { Authorization: `Bearer ${creds.token}` },
      });
      if (!res.ok) fail(await res.text());
      print(await res.json());
    });
}
