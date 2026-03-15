import type { ApiKey, CreatedApiKey, Game, Tenant } from "@1upmonster/types";

export class TenantClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  async createTenant(name: string): Promise<Tenant> {
    const res = await fetch(`${this.baseUrl}/tenants`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Tenant>;
  }

  async getTenant(): Promise<Tenant> {
    const res = await fetch(`${this.baseUrl}/tenants/me`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Tenant>;
  }

  async createGame(name: string): Promise<Game> {
    const res = await fetch(`${this.baseUrl}/games`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Game>;
  }

  async listGames(): Promise<Game[]> {
    const res = await fetch(`${this.baseUrl}/games`, { headers: this.headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Game[]>;
  }

  async deleteGame(gameId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/games/${gameId}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async createApiKey(gameId: string, name: string): Promise<CreatedApiKey> {
    const res = await fetch(`${this.baseUrl}/games/${gameId}/api-keys`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<CreatedApiKey>;
  }

  async listApiKeys(gameId: string): Promise<ApiKey[]> {
    const res = await fetch(`${this.baseUrl}/games/${gameId}/api-keys`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ApiKey[]>;
  }

  async revokeApiKey(gameId: string, keyId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/games/${gameId}/api-keys/${keyId}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
  }
}
