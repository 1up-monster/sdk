import type {
  ClientMessage,
  GameMessagePayload,
  ServerMessage,
  ServerMessageType,
} from "@1upmonster/types";

/** Events that the Room DO WebSocket actually emits */
type RoomEventMap = {
  room_ready: void;
  game_message: GameMessagePayload;
  opponent_disconnected: void;
  match_expired: void;
  error: { message: string };
  close: void;
};

type RoomEventListener<K extends keyof RoomEventMap> = (
  payload: RoomEventMap[K]
) => void;

export class Room {
  private ws: WebSocket;
  private listeners = new Map<string, Set<RoomEventListener<never>>>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(wsUrl: string, private readonly token: string) {
    this.ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    this.ws.addEventListener("message", (e) => this.handleMessage(e));
    this.ws.addEventListener("close", () => {
      this.stopPing();
      this.emit("close", undefined as void);
    });
    this.ws.addEventListener("open", () => this.startPing());
  }

  on<K extends keyof RoomEventMap>(
    event: K,
    listener: RoomEventListener<K>
  ): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as RoomEventListener<never>);
    return this;
  }

  off<K extends keyof RoomEventMap>(
    event: K,
    listener: RoomEventListener<K>
  ): this {
    this.listeners.get(event)?.delete(listener as RoomEventListener<never>);
    return this;
  }

  /** Signal ready once connected to room */
  ready(): void {
    this.send({ type: "ready" });
  }

  /** Send a game-defined message to all players in the room */
  broadcast(data: unknown): void {
    this.send({ type: "game_message", payload: data });
  }

  leave(): void {
    this.stopPing();
    this.ws.close();
  }

  private send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(e: MessageEvent): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(e.data as string) as ServerMessage;
    } catch {
      return;
    }
    const type = msg.type as ServerMessageType;
    this.emit(type, msg.payload);
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((fn) => (fn as (p: unknown) => void)(payload));
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
