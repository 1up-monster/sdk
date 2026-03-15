# 1upmonster SDK

Multiplayer infrastructure for web3 games — Solana-native.

## Packages

| Package | Description |
|---------|-------------|
| [`@1upmonster/types`](./packages/types) | Shared TypeScript types |
| [`@1upmonster/sdk`](./packages/sdk) | Auth + tenant management clients |
| [`@1upmonster/versus`](./packages/versus) | Matchmaking + room client |
| [`@1upmonster/cli`](./packages/cli) | CLI for managing games from the terminal |

## Requirements

- Node.js 18+
- pnpm 10+

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm typecheck   # typecheck all packages
pnpm test        # run all tests
```
