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
  key: string;
  gameId: string;
  tenantId: string;
  createdAt: number;
}
