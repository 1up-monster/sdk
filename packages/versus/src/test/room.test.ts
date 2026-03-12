import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Room } from "../room.js";
import { FakeWebSocket } from "./fake-ws.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fakeWs: FakeWebSocket;

/** Stubs global WebSocket to capture the FakeWebSocket instance. */
function stubWs() {
  vi.stubGlobal(
    "WebSocket",
    class extends FakeWebSocket {
      constructor(url: string | URL) {
        super(url);
        fakeWs = this;
      }
    }
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("Room — constructor", () => {
  beforeEach(stubWs);

  it("opens WebSocket with ?token= in URL", () => {
    new Room("wss://test.internal/versus/rooms/m1", "my-room-token");
    // Token must appear in the URL — Worker validates it before forwarding to DO
    expect(fakeWs.url).toContain("token=my-room-token");
  });

  it("starts pinging after open (every 5s)", () => {
    vi.useFakeTimers();
    new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open(); // trigger "open" event → starts ping

    // No auth frame — token is in the URL
    expect(fakeWs.sent).toHaveLength(0);

    vi.advanceTimersByTime(5001);
    // first ping
    expect(fakeWs.sent).toHaveLength(1);
    expect(JSON.parse(fakeWs.sent[0]!)).toEqual({ type: "ping" });

    vi.advanceTimersByTime(5000);
    // second ping
    expect(fakeWs.sent).toHaveLength(2);
  });

  it("stops pinging after close", () => {
    vi.useFakeTimers();
    new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    vi.advanceTimersByTime(5001);
    expect(fakeWs.sent).toHaveLength(1); // ping

    fakeWs.close();
    vi.advanceTimersByTime(10_000);
    // No more pings after close
    expect(fakeWs.sent).toHaveLength(1); // still 1 ping
  });
});

// ---------------------------------------------------------------------------
// on / off
// ---------------------------------------------------------------------------

describe("Room — on/off", () => {
  beforeEach(stubWs);

  it("listener fires on matching event", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();

    const calls: unknown[] = [];
    room.on("game_message", (p) => calls.push(p));

    fakeWs.receive(
      JSON.stringify({ type: "game_message", payload: { from: "p2", data: { x: 1 } } })
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ from: "p2", data: { x: 1 } });
  });

  it("off removes only the specified listener", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();

    const calls1: unknown[] = [];
    const calls2: unknown[] = [];
    const listener1 = (p: unknown) => calls1.push(p);

    room.on("room_ready", listener1);
    room.on("room_ready", (p) => calls2.push(p));
    room.off("room_ready", listener1);

    fakeWs.receive(JSON.stringify({ type: "room_ready" }));

    expect(calls1).toHaveLength(0);
    expect(calls2).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ready()
// ---------------------------------------------------------------------------

describe("Room — ready()", () => {
  beforeEach(stubWs);

  it("sends {type:'ready'} when WS is OPEN", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    room.ready();
    expect(fakeWs.sent.map((s) => JSON.parse(s))).toContainEqual({ type: "ready" });
  });

  it("does not send when WS is not OPEN", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    // fakeWs starts in CONNECTING state — auth is only sent on open event
    room.ready();
    expect(fakeWs.sent).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// broadcast(data)
// ---------------------------------------------------------------------------

describe("Room — broadcast()", () => {
  beforeEach(stubWs);

  it("sends {type:'game_message', payload: data}", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open(); // starts ping interval, no auth frame
    room.broadcast({ move: "up" });
    const sentMsgs = fakeWs.sent.map((s) => JSON.parse(s));
    expect(sentMsgs).toContainEqual({ type: "game_message", payload: { move: "up" } });
  });
});

// ---------------------------------------------------------------------------
// leave()
// ---------------------------------------------------------------------------

describe("Room — leave()", () => {
  beforeEach(stubWs);

  it("closes the WebSocket and stops pinging", () => {
    vi.useFakeTimers();
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open(); // starts ping interval
    vi.advanceTimersByTime(5001);
    // 1 ping (no auth frame)
    expect(fakeWs.sent).toHaveLength(1);

    room.leave();
    expect(fakeWs.readyState).toBe(FakeWebSocket.CLOSED);

    vi.advanceTimersByTime(10_000);
    expect(fakeWs.sent).toHaveLength(1); // no more pings
  });
});

// ---------------------------------------------------------------------------
// Incoming message routing
// ---------------------------------------------------------------------------

describe("Room — incoming message routing", () => {
  beforeEach(stubWs);

  it("routes room_ready to listener with no payload", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    const calls: unknown[] = [];
    room.on("room_ready", (p) => calls.push(p));
    fakeWs.receive(JSON.stringify({ type: "room_ready" }));
    expect(calls).toHaveLength(1);
  });

  it("routes game_message payload to listener", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    const calls: unknown[] = [];
    room.on("game_message", (p) => calls.push(p));
    fakeWs.receive(
      JSON.stringify({ type: "game_message", payload: { from: "p2", data: 42 } })
    );
    expect(calls[0]).toEqual({ from: "p2", data: 42 });
  });

  it("routes opponent_disconnected to listener", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    const calls: unknown[] = [];
    room.on("opponent_disconnected", (p) => calls.push(p));
    fakeWs.receive(JSON.stringify({ type: "opponent_disconnected" }));
    expect(calls).toHaveLength(1);
  });

  it("routes match_expired to listener", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    const calls: unknown[] = [];
    room.on("match_expired", (p) => calls.push(p));
    fakeWs.receive(JSON.stringify({ type: "match_expired" }));
    expect(calls).toHaveLength(1);
  });

  it("silently ignores malformed JSON", () => {
    const room = new Room("wss://test.internal/versus/rooms/m1", "tok");
    fakeWs.open();
    const errors: unknown[] = [];
    room.on("error", (e) => errors.push(e));
    expect(() => fakeWs.receive("not json at all {{{{")).not.toThrow();
    // No error events should be emitted for JSON parse failures
    expect(errors).toHaveLength(0);
  });
});
