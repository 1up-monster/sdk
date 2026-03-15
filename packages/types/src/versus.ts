// ---------------------------------------------------------------------------
// ELO configuration
// ---------------------------------------------------------------------------

export type EloType = "u8" | "u16" | "u32" | "u64" | "i8" | "i16" | "i32" | "i64";
export type EloAggregate = "average" | "max" | "min";
export type EloRpcFailBehavior = "reject" | "use_default" | "use_cached";
export type ExpireBehavior = "expire" | "match_any";

export interface PdaAccountConfig {
  type: "pda";
  /** Seeds as strings; use "{wallet}" as placeholder for the player's pubkey */
  seeds: string[];
  programId: string;
}

export interface StaticAccountConfig {
  type: "static";
  /** Use "{wallet}" as placeholder for the player's pubkey */
  address: string;
}

export type EloAccountConfig = PdaAccountConfig | StaticAccountConfig;

export interface EloSourceConfig {
  account: EloAccountConfig;
  offset: number;
  type: EloType;
  endian: "little" | "big";
  default: number;
  rpcFailBehavior: EloRpcFailBehavior;
  /**
   * Byte offset of the authority field (32-byte Solana pubkey) within the same
   * account. When set, the API verifies that account[authorityOffset..+32]
   * matches the authenticated wallet before accepting the queue entry.
   * Omit only if the account address itself is sufficient proof of ownership
   * (e.g. a PDA uniquely derived from {wallet} with no shared seeds).
   */
  authorityOffset?: number;
  /**
   * The Solana program ID that must own the ELO account.
   * For PDA configs this defaults to `account.programId` automatically.
   * For static configs this must be set explicitly to prevent players from
   * substituting arbitrary accounts with fake ELO data.
   */
  ownerProgramId?: string;
}

// ---------------------------------------------------------------------------
// ELO delta computation
// ---------------------------------------------------------------------------

export type EloComputationMethod = "fixed" | "k_factor";

export interface EloComputationConfig {
  /** "fixed": all teams get ±value regardless of rating gap.
   *  "k_factor": standard ELO formula; requires matchFormat.teams === 2. */
  method: EloComputationMethod;
  /** fixed: flat delta per player (e.g. 25).
   *  k_factor: K value (e.g. 32). Must be a positive finite number. */
  value: number;
}

// ---------------------------------------------------------------------------
// Match format
// ---------------------------------------------------------------------------

export interface MatchFormat {
  /** Players per team. 1 = 1v1, 5 = 5v5 */
  playersPerTeam: number;
  /** Number of teams. Always 2 for now */
  teams: number;
  /** How to compute team ELO from individual ratings (irrelevant for 1v1) */
  eloAggregate: EloAggregate;
}

// ---------------------------------------------------------------------------
// Game Processor
// ---------------------------------------------------------------------------

export type ParticipantRole = "player" | "processor" | "spectator" | "agent";

export interface RoomParticipant {
  walletPubkey: string;
  role: ParticipantRole;
  /** Team index (0-based). Only set for role="player" */
  teamIndex?: number;
}

export interface GameProcessorConfig {
  /**
   * Wallet pubkey of the processor. Must match the walletPubkey in the
   * processor's room JWT — this is the whitelist check in the Room DO.
   */
  walletAddress: string;
  /**
   * HTTPS URL the platform POSTs to when a match is finalized.
   * Payload: { matchId, roomUrl, roomToken, participants, expiresAt }
   * Must be https:// — never called over plain HTTP.
   */
  callbackUrl: string;
}

/**
 * A single authoritative state update from the game processor.
 * The platform only requires `seqId` — all other fields are opaque
 * and defined by the game dev (e.g. Redux-style { type, payload }).
 * The Room DO buffers these by seqId for client desync recovery.
 */
export interface GameStateUpdate {
  seqId: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Versus config (stored per game)
// ---------------------------------------------------------------------------

export interface VersusConfig {
  gameId: string;
  eloSource: EloSourceConfig;
  matchFormat: MatchFormat;
  /** Max seconds in queue before expiry (default: 120) */
  queueTtl: number;
  /** Max match duration in seconds (default: 3600) */
  matchTtl: number;
  /** Seconds to accept a found match (default: 15) */
  acceptWindow: number;
  /** What to do when queue TTL expires (default: "expire") */
  expireBehavior: ExpireBehavior;
  /**
   * Optional Solana RPC URL for this game's ELO reads.
   * When set, overrides the platform default (env.SOLANA_RPC_URL).
   * Must be an https:// URL. Allows per-game devnet/mainnet isolation.
   */
  rpcUrl?: string;
  /**
   * Optional game processor. When set the Room DO routes player game_message
   * events exclusively to the processor instead of relaying P2P.
   * Omit for pure P2P relay mode (default, backwards-compatible).
   */
  processor?: GameProcessorConfig;
  /**
   * How to compute ELO deltas for this game.
   * Defaults to { method: "fixed", value: 25 } when absent.
   * "k_factor" requires matchFormat.teams === 2.
   */
  eloComputation?: EloComputationConfig;
}

// ---------------------------------------------------------------------------
// Queue & match state
// ---------------------------------------------------------------------------

/** Actual states stored in queue_entries.state in the Queue DO SQLite table */
export type PlayerState = "queued" | "matched" | "left" | "expired";

export interface QueueEntry {
  walletPubkey: string;
  elo: number;
  region: string;
  queuedAt: number;
  state: PlayerState;
}

export interface MatchTeam {
  players: QueueEntry[];
  avgElo: number;
}

export interface Match {
  id: string;
  gameId: string;
  teams: MatchTeam[];
  /**
   * Participants manifest — built at finalizeMatch time. Used by the Room DO
   * as the authoritative whitelist + routing table.
   * Falls back to teams-derived player list for legacy matches (empty array).
   */
  participants: RoomParticipant[];
  /**
   * ELO stakes for each team, indexed by teamIndex.
   * ifWin: delta applied to each player on the winning team.
   * ifLose: delta applied to each player on the losing team (negative for standard ELO).
   * Empty array for legacy matches that predate this field.
   */
  eloDeltas: Array<{ ifWin: number; ifLose: number }>;
  roomUrl: string;
  createdAt: number;
  /** Unix ms — all players must accept before this time */
  acceptDeadline: number;
  expiresAt: number;
  state: "pending_accept" | "active" | "expired" | "completed";
}

// ---------------------------------------------------------------------------
// WebSocket message protocol
// ---------------------------------------------------------------------------

export type ClientMessageType =
  | "ping"
  | "ready"
  | "accept_match"
  | "decline_match"
  | "game_message"
  // Processor → Room
  | "initial_game_state"
  | "game_state_update"
  | "game_over"
  // Player → Room (desync recovery)
  | "catch_up";

export type ServerMessageType =
  // Queue WS messages
  | "pong"
  | "queue_expired"
  | "match_found"
  | "match_declined"
  | "match_ready"
  // Room WS messages
  | "room_ready"
  | "game_message"
  | "opponent_disconnected"
  | "match_expired"
  | "error"
  // Processor flow — Room → clients
  | "room_metadata"
  | "initial_game_state"
  | "game_state_update"
  | "game_over"
  | "catch_up";

export interface ClientMessage<T = unknown> {
  type: ClientMessageType;
  payload?: T;
}

export interface ServerMessage<T = unknown> {
  type: ServerMessageType;
  payload?: T;
}

// Specific payloads
export interface MatchFoundPayload {
  matchId: string;
  opponents: Array<{ walletPubkey: string; elo: number }>;
  acceptDeadline: number; // unix ms
  // roomToken is NOT included here — it arrives in match_ready after all players accept
}

export interface MatchReadyPayload {
  matchId: string;
  /** HS256 token — use as ?token= when connecting to the room WebSocket */
  roomToken: string;
  roomUrl: string;
}

export interface GameMessagePayload {
  from: string; // walletPubkey
  data: unknown;
}

export interface MatchDeclinedPayload {
  reason: "declined" | "timeout";
  /** Wallet that declined or timed out */
  walletPubkey: string;
}

export interface RoomMetadataPayload {
  match: Match;
  participants: RoomParticipant[];
}

export interface CatchUpPayload {
  actions: GameStateUpdate[];
}

export interface CatchUpRequestPayload {
  fromSeq: number;
  toSeq: number;
}
