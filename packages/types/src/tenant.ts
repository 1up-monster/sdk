export interface Tenant {
  id: string;
  name: string;
  ownerWallet: string;
  createdAt: number;
}

export interface Game {
  id: string;
  tenantId: string;
  name: string;
  createdAt: number;
}

export interface ApiKey {
  id: string;
  name: string;
  created_at: number;
}

export interface CreatedApiKey {
  id: string;
  gameId: string;
  name: string;
  key: string;
}
