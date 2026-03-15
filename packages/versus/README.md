# @1upmonster/versus

Matchmaking and room client for 1upmonster Versus — queue players, form matches, and relay game messages over WebSocket.

## Install

```bash
npm install @1upmonster/versus
```

## Quick Start

```ts
import { VersusClient } from "@1upmonster/versus";

const versus = new VersusClient({
  baseUrl: "https://api.1up.monster",
  token: session.token,     // JWT from @1upmonster/sdk AuthClient
  gameApiKey: "your-api-key", // issued per-game via CLI or TenantClient
});
```

## Matchmaking

```ts
// Join the queue — returns a MatchProposal when a match is found
const proposal = await versus.matchmake(gameId, (status) => {
  console.log("Queue status:", status); // optional progress callback
});

// Accept the match
const room = await proposal.accept();

// Or decline
await proposal.decline();
```

`matchmake` opens a WebSocket to the queue, waits for `match_found`, and returns a `MatchProposal`. Calling `accept()` sends the acceptance and waits for `match_ready`, then returns a connected `Room`.

## Room

```ts
// Signal you're ready to play
room.ready();

// Send game state / actions to all players
room.broadcast({ type: "move", x: 100, y: 200 });

// Listen for incoming messages
room.on("game_message", (msg) => {
  console.log("From opponent:", msg.data);
});

// Other events
room.on("room_ready", () => { /* all players ready */ });
room.on("opponent_disconnected", () => { /* handle drop */ });
room.on("match_expired", () => { /* match timed out */ });
room.on("close", () => { /* room closed */ });

// Leave when done
room.leave();
```

## Admin Methods

These require only a JWT (no game API key needed):

```ts
const config = await versus.getConfig(gameId);
await versus.setConfig(gameId, { /* VersusConfig */ });
const matches = await versus.listMatches(gameId);
const match = await versus.inspectMatch(matchId);
await versus.leaveQueue(gameId);
```

## ELO Configuration

Versus reads ELO from on-chain accounts. Configure via `setConfig` or the CLI:

```ts
await versus.setConfig(gameId, {
  eloSource: {
    account: {
      type: "static",
      address: "<player_account_pubkey>",
    },
    offset: 0,
    type: "u32",
    endian: "little",
  },
  matchFormat: {
    playersPerTeam: 1,
    teams: 2,
  },
  queueTtlSeconds: 60,
  matchTtlSeconds: 300,
  acceptWindowSeconds: 15,
});
```

For PDA-derived accounts:

```ts
account: {
  type: "pda",
  programId: "<your_program_id>",
  seeds: [{ type: "wallet" }],
}
```
