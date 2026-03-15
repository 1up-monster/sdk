# @1upmonster/types

Shared TypeScript type definitions for the 1upmonster platform. Consumed internally by `@1upmonster/sdk`, `@1upmonster/versus`, and `@1upmonster/cli` — you generally don't need to install this directly.

## Install

```bash
npm install @1upmonster/types
```

## Contents

### Tenant & Game

```ts
import type { Tenant, Game, ApiKey, CreatedApiKey } from "@1upmonster/types";
```

### Versus (Matchmaking)

```ts
import type {
  VersusConfig,       // full game configuration
  Match,              // active match record
  QueueEntry,         // player in queue
  MatchTeam,          // team in a match
  EloSourceConfig,    // on-chain ELO account config
  GameProcessorConfig,// optional authoritative server config
  ClientMessage,      // WebSocket messages sent by client
  ServerMessage,      // WebSocket messages sent by server
  MatchFoundPayload,  // match_found event data
  MatchReadyPayload,  // match_ready event data
} from "@1upmonster/types";
```
