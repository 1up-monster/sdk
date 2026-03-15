# @1upmonster/sdk

Core SDK for 1upmonster — wallet-based authentication and tenant/game management.

## Install

```bash
npm install @1upmonster/sdk
```

## Auth

Authentication is wallet-based (Ed25519). The SDK handles the challenge/response flow — you just provide a signer.

```ts
import { AuthClient } from "@1upmonster/sdk";

const auth = new AuthClient("https://api.1up.monster");

// Works with any wallet adapter that implements signMessage
const session = await auth.login({
  publicKey: wallet.publicKey.toBase58(),
  signMessage: (msg) => wallet.signMessage(msg),
});

// session.token — JWT for subsequent API calls
// session.walletPubkey — verified public key
// session.expiresAt — unix timestamp (ms)
```

## Tenant & Game Management

```ts
import { TenantClient } from "@1upmonster/sdk";

const client = new TenantClient("https://api.1up.monster", session.token);

// Tenant
const tenant = await client.createTenant("My Studio");
const me = await client.getTenant();

// Games
const game = await client.createGame("My Game");
const games = await client.listGames();
await client.deleteGame(gameId);

// API Keys (for game clients)
const { key } = await client.createApiKey(gameId, "production");  // store this — shown once
const keys = await client.listApiKeys(gameId);
await client.revokeApiKey(gameId, keyId);
```
