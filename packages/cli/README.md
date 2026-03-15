# @1upmonster/cli

Command-line interface for managing your 1upmonster game infrastructure.

## Install

```bash
npm install -g @1upmonster/cli
# or run without installing:
npx @1upmonster/cli <command>
```

## Authentication

Login with a Solana keypair file (Solana CLI format):

```bash
1up auth login --keypair ~/.config/solana/id.json
1up auth status
1up auth logout
```

For CI or AI agents, set env vars instead of logging in:

```bash
export ONEUP_API_KEY=<your-jwt>
export ONEUP_WALLET=<your-wallet-pubkey>
```

To point at a different API:

```bash
export ONEUP_API_URL=https://api.1up.monster  # default
```

## Tenant

```bash
1up tenant create --name "My Studio"
1up tenant info
```

## Games

```bash
1up game create --name "My Game"
1up game list
1up game delete <gameId>
```

## API Keys

```bash
1up game api-key create <gameId> --name production   # shown once — store it
1up game api-key list <gameId>
1up game api-key revoke <gameId> <keyId>
```

## Versus — Matchmaking Config

```bash
# Set up ELO reading from a static on-chain account
1up versus config set <gameId> \
  --elo-account-type static \
  --elo-address <player_account_pubkey> \
  --elo-offset 0 \
  --elo-type u32 \
  --elo-endian little \
  --players-per-team 1 \
  --teams 2 \
  --queue-ttl 60 \
  --match-ttl 300 \
  --accept-window 15

# For PDA-derived accounts
1up versus config set <gameId> \
  --elo-account-type pda \
  --elo-program-id <program_id> \
  --elo-seeds wallet \
  ...

1up versus config get <gameId>
```

## Versus — Matches

```bash
1up versus match list <gameId>
1up versus match inspect <matchId>
1up versus queue status <gameId>
```

## Machine-Readable Output

All commands support `--json` for structured output — useful for scripting and AI agents:

```bash
1up game list --json
1up versus match list <gameId> --json | jq '.[0].id'
```
