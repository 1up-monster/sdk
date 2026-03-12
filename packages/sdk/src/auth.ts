export interface WalletSigner {
  publicKey: string;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface Session {
  token: string;
  walletPubkey: string;
  expiresAt: number;
}

export class AuthClient {
  constructor(private readonly baseUrl: string) {}

  async login(signer: WalletSigner): Promise<Session> {
    // 1. Fetch a challenge nonce from the API
    const challengeRes = await fetch(`${this.baseUrl}/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: signer.publicKey }),
    });
    if (!challengeRes.ok) throw new Error("Failed to fetch auth challenge");
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Sign the nonce with the wallet
    const message = new TextEncoder().encode(
      `Sign in to 1upmonster\nNonce: ${nonce}`
    );
    const signature = await signer.signMessage(message);
    const signatureB64 = btoa(String.fromCharCode(...signature));

    // 3. Verify signature and receive session token
    const verifyRes = await fetch(`${this.baseUrl}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: signer.publicKey,
        nonce,
        signature: signatureB64,
      }),
    });
    if (!verifyRes.ok) throw new Error("Auth verification failed");

    return (await verifyRes.json()) as Session;
  }
}
