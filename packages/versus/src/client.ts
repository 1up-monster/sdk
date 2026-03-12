import type {
  Match,
  MatchDeclinedPayload,
  MatchFoundPayload,
  MatchReadyPayload,
  VersusConfig,
} from "@1upmonster/types";
import { Room } from "./room.js";

export interface VersusClientOptions {
  baseUrl: string;
  /** Player session JWT from auth login */
  token: string;
  /** Game API key (1up_...) issued by the game developer — required for player-facing
   *  operations (matchmake, leaveQueue); omit for admin/CLI use. */
  gameApiKey?: string;
}

/**
 * Represents a pending match proposal. Players must accept or decline
 * before the accept deadline. The Room is only created after all players accept.
 */
export class MatchProposal {
  readonly matchId: string;
  readonly opponents: MatchFoundPayload["opponents"];
  readonly acceptDeadline: number;

  private readonly ws: WebSocket;
  private readonly wsBase: string;
  private readonly pingInterval: ReturnType<typeof setInterval>;

  constructor(
    payload: MatchFoundPayload,
    ws: WebSocket,
    pingInterval: ReturnType<typeof setInterval>,
    wsBase: string
  ) {
    this.matchId = payload.matchId;
    this.opponents = payload.opponents;
    this.acceptDeadline = payload.acceptDeadline;
    this.ws = ws;
    this.pingInterval = pingInterval;
    this.wsBase = wsBase;
  }

  /**
   * Accept the match proposal. Resolves with a connected Room once all
   * players have accepted and the server has created the room.
   * Rejects if the match is declined or times out before all accept.
   */
  accept(): Promise<Room> {
    return new Promise((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data as string) as { type: string; payload?: unknown };

        if (msg.type === "match_ready") {
          cleanup();
          const payload = msg.payload as MatchReadyPayload;
          // Use the server-provided roomUrl rather than reconstructing it locally (GAP-21)
          const roomWsUrl = payload.roomUrl.replace(/^http/, "ws");
          resolve(new Room(roomWsUrl, payload.roomToken));
        }

        if (msg.type === "match_declined") {
          cleanup();
          const payload = msg.payload as MatchDeclinedPayload;
          reject(new Error(`Match cancelled: ${payload.reason} by ${payload.walletPubkey}`));
        }
      };

      const onClose = (e: CloseEvent) => {
        cleanup();
        if (!e.wasClean) {
          reject(new Error("Queue WebSocket closed unexpectedly"));
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error("Queue WebSocket error during acceptance"));
      };

      const cleanup = () => {
        clearInterval(this.pingInterval);
        this.ws.removeEventListener("message", onMessage);
        this.ws.removeEventListener("close", onClose);
        this.ws.removeEventListener("error", onError);
        this.ws.close();
      };

      this.ws.addEventListener("message", onMessage);
      this.ws.addEventListener("close", onClose);
      this.ws.addEventListener("error", onError);

      this.ws.send(JSON.stringify({ type: "accept_match" }));
    });
  }

  /**
   * Decline the match proposal. The Queue will re-queue the other players
   * and apply a re-queue penalty to this player.
   */
  decline(): void {
    clearInterval(this.pingInterval);
    this.ws.send(JSON.stringify({ type: "decline_match" }));
    this.ws.close();
  }

  /**
   * Abandon the proposal without sending accept or decline — cleans up the
   * WebSocket and ping interval so they don't leak. Equivalent to navigating
   * away without responding. The server will time out the proposal via the
   * accept window alarm. (GAP-32)
   */
  abandon(): void {
    clearInterval(this.pingInterval);
    this.ws.close(1000, "Abandoned");
  }
}

export class VersusClient {
  private readonly baseUrl: string;
  private readonly wsBase: string;
  private readonly headers: Record<string, string>;
  private readonly gameApiKey: string;

  constructor(options: VersusClientOptions) {
    this.baseUrl = options.baseUrl;
    this.wsBase = options.baseUrl.replace(/^http/, "ws");
    this.gameApiKey = options.gameApiKey ?? "";
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
      ...(options.gameApiKey ? { "X-Api-Key": options.gameApiKey } : {}),
    };
  }

  /**
   * Join the matchmaking queue and wait for a match proposal.
   *
   * Returns a MatchProposal when a match is found. The game should show
   * accept/decline UI, then call proposal.accept() or proposal.decline().
   * proposal.accept() resolves with a Room once all players confirm.
   *
   * @param gameId - The game to queue for
   * @param onQueued - Optional callback fired once successfully in queue
   */
  async matchmake(
    gameId: string,
    onQueued?: () => void
  ): Promise<MatchProposal> {
    // Step 1: Join the queue via HTTP
    const res = await fetch(`${this.baseUrl}/versus/${gameId}/queue`, {
      method: "POST",
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());

    onQueued?.();

    // Step 2: Open WebSocket to receive queue events
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsBase}/versus/${gameId}/queue/ws`;
      const token = this.headers["Authorization"]!.replace("Bearer ", "");
      const ws = new WebSocket(
        `${wsUrl}?token=${encodeURIComponent(token)}&apiKey=${encodeURIComponent(this.gameApiKey)}`
      );

      // Reject if the connection never opens (GAP-31)
      const connectTimeout = setTimeout(() => {
        clearInterval(pingInterval);
        ws.close();
        reject(new Error("Queue WebSocket connection timed out"));
      }, 10_000);
      ws.addEventListener("open", () => clearTimeout(connectTimeout));

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 5000);

      const onMessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data as string) as { type: string; payload?: unknown };

        if (msg.type === "match_found") {
          // Stop listening for queue-level events here;
          // MatchProposal takes over the WS from this point
          clearTimeout(connectTimeout);
          ws.removeEventListener("message", onMessage);
          ws.removeEventListener("error", onError);
          ws.removeEventListener("close", onClose);

          const payload = msg.payload as MatchFoundPayload;
          resolve(new MatchProposal(payload, ws, pingInterval, this.wsBase));
        }

        if (msg.type === "queue_expired") {
          clearTimeout(connectTimeout);
          clearInterval(pingInterval);
          ws.close();
          reject(new Error("Queue expired: no match found within the time limit"));
        }
      };

      const onError = () => {
        clearTimeout(connectTimeout);
        clearInterval(pingInterval);
        reject(new Error("Queue WebSocket connection failed"));
      };

      const onClose = (e: CloseEvent) => {
        clearTimeout(connectTimeout);
        clearInterval(pingInterval);
        if (!e.wasClean) {
          reject(new Error("Queue WebSocket closed unexpectedly"));
        }
      };

      ws.addEventListener("message", onMessage);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
    });
  }

  async leaveQueue(gameId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/versus/${gameId}/queue/leave`, {
      method: "POST",
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async getConfig(gameId: string): Promise<VersusConfig> {
    const res = await fetch(`${this.baseUrl}/versus/${gameId}/config`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<VersusConfig>;
  }

  async setConfig(gameId: string, config: Partial<VersusConfig>): Promise<VersusConfig> {
    const res = await fetch(`${this.baseUrl}/versus/${gameId}/config`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<VersusConfig>;
  }

  async listMatches(gameId: string): Promise<Match[]> {
    const res = await fetch(`${this.baseUrl}/versus/${gameId}/matches`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Match[]>;
  }

  async inspectMatch(matchId: string): Promise<Match> {
    const res = await fetch(`${this.baseUrl}/versus/matches/${matchId}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Match>;
  }
}
