import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { VersusClient, MatchProposal } from "../client.js";
import { Room } from "../room.js";
import { FakeWebSocket } from "./fake-ws.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.test.internal";
const TOKEN = "test-session-jwt";
const API_KEY = "1up_testapikey";

function makeClient() {
  return new VersusClient({ baseUrl: BASE_URL, token: TOKEN, gameApiKey: API_KEY });
}

let queueWs: FakeWebSocket;
let roomWs: FakeWebSocket;
let wsCallCount = 0;

function stubWebSocket() {
  wsCallCount = 0;
  vi.stubGlobal(
    "WebSocket",
    class extends FakeWebSocket {
      constructor(url: string | URL) {
        super(url);
        wsCallCount++;
        if (wsCallCount === 1) {
          queueWs = this; // first WS = queue WS
        } else {
          roomWs = this; // second WS = room WS (created by Room constructor)
        }
      }
    }
  );
}

function stubFetch(ok = true, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      text: vi.fn().mockResolvedValue(ok ? "" : "Error"),
      json: vi.fn().mockResolvedValue(body ?? {}),
    })
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// matchmake()
// ---------------------------------------------------------------------------

describe("VersusClient — matchmake()", () => {
  beforeEach(() => {
    stubWebSocket();
    stubFetch(true);
  });

  it("POSTs to /versus/:gameId/queue with correct headers", async () => {
    // Resolve with match_found quickly
    const matchmakePromise = makeClient().matchmake("game1");
    // Let the async fetch complete
    await vi.waitFor(() => expect(queueWs).toBeDefined());

    const fetchMock = vi.mocked(globalThis.fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/versus/game1/queue`);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe(API_KEY);
    expect(init.method).toBe("POST");

    // Resolve the promise to avoid unhandled rejection
    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: {
          matchId: "m1",
          opponents: [{ walletPubkey: "p2", elo: 1000 }],
          acceptDeadline: Date.now() + 15000,
        },
      })
    );
    await matchmakePromise;
  });

  it("opens queue WebSocket with token and apiKey params", async () => {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());

    expect(queueWs!.url).toContain(`/versus/game1/queue/ws`);
    expect(queueWs!.url).toContain(`token=`);
    expect(queueWs!.url).toContain(`apiKey=`);

    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: { matchId: "m1", opponents: [], acceptDeadline: Date.now() + 15000 },
      })
    );
    await matchmakePromise;
  });

  it("calls onQueued callback after successful HTTP join", async () => {
    const onQueued = vi.fn();
    const matchmakePromise = makeClient().matchmake("game1", onQueued);
    await vi.waitFor(() => expect(onQueued).toHaveBeenCalled());

    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: { matchId: "m1", opponents: [], acceptDeadline: Date.now() + 15000 },
      })
    );
    await matchmakePromise;
  });

  it("resolves with MatchProposal on match_found", async () => {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());

    const payload = {
      matchId: "match-abc",
      opponents: [{ walletPubkey: "p2", elo: 1050 }],
      acceptDeadline: Date.now() + 15000,
    };
    queueWs!.receive(JSON.stringify({ type: "match_found", payload }));

    const proposal = await matchmakePromise;
    expect(proposal).toBeInstanceOf(MatchProposal);
    expect(proposal.matchId).toBe("match-abc");
    expect(proposal.opponents).toEqual(payload.opponents);
    expect(proposal.acceptDeadline).toBe(payload.acceptDeadline);
  });

  it("rejects on queue_expired", async () => {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());

    queueWs!.receive(JSON.stringify({ type: "queue_expired" }));

    await expect(matchmakePromise).rejects.toThrow(/expired/i);
  });

  it("rejects on unexpected WebSocket close", async () => {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());

    queueWs!.serverClose(); // wasClean=false

    await expect(matchmakePromise).rejects.toThrow();
  });

  it("rejects when HTTP join fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: vi.fn().mockResolvedValue("Queue full") })
    );
    await expect(makeClient().matchmake("game1")).rejects.toThrow("Queue full");
  });
});

// ---------------------------------------------------------------------------
// MatchProposal.accept()
// ---------------------------------------------------------------------------

describe("MatchProposal — accept()", () => {
  beforeEach(() => {
    stubWebSocket();
    stubFetch(true);
  });

  async function getProposal(): Promise<MatchProposal> {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());
    queueWs!.open(); // WS must be OPEN for accept()/decline() to send messages
    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: { matchId: "m1", opponents: [], acceptDeadline: Date.now() + 15000 },
      })
    );
    return matchmakePromise;
  }

  it("sends accept_match message to the queue WS", async () => {
    const proposal = await getProposal();
    const sentBefore = queueWs!.sent.length;
    const acceptPromise = proposal.accept();

    // accept_match should have been sent synchronously in the Promise executor
    expect(queueWs!.sent.length).toBeGreaterThan(sentBefore);
    const lastSent = JSON.parse(queueWs!.sent[queueWs!.sent.length - 1]!);
    expect(lastSent).toEqual({ type: "accept_match" });

    // Resolve with match_ready
    queueWs!.receive(
      JSON.stringify({
        type: "match_ready",
        payload: { matchId: "m1", roomToken: "room-jwt", roomUrl: "wss://api.test.internal/versus/rooms/m1" },
      })
    );
    await acceptPromise;
  });

  it("resolves with a Room instance on match_ready", async () => {
    const proposal = await getProposal();
    const acceptPromise = proposal.accept();

    queueWs!.receive(
      JSON.stringify({
        type: "match_ready",
        payload: {
          matchId: "m1",
          roomToken: "room-jwt-token",
          roomUrl: "wss://api.test.internal/versus/rooms/m1",
        },
      })
    );
    const room = await acceptPromise;
    expect(room).toBeInstanceOf(Room);
    // Token is passed in the URL — Worker validates it before forwarding to the Room DO
    expect(roomWs?.url ?? queueWs!.url).toContain("room-jwt-token");
  });

  it("rejects on match_declined", async () => {
    const proposal = await getProposal();
    const acceptPromise = proposal.accept();

    queueWs!.receive(
      JSON.stringify({
        type: "match_declined",
        payload: { reason: "declined", walletPubkey: "p2" },
      })
    );
    await expect(acceptPromise).rejects.toThrow(/cancelled/i);
  });
});

// ---------------------------------------------------------------------------
// MatchProposal.decline()
// ---------------------------------------------------------------------------

describe("MatchProposal — decline()", () => {
  beforeEach(() => {
    stubWebSocket();
    stubFetch(true);
  });

  it("sends decline_match and closes the queue WS", async () => {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());
    queueWs!.open(); // WS must be OPEN for decline() to send
    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: { matchId: "m1", opponents: [], acceptDeadline: Date.now() + 15000 },
      })
    );
    const proposal = await matchmakePromise;

    proposal.decline();

    const sentMsgs = queueWs!.sent.map((s) => JSON.parse(s));
    expect(sentMsgs).toContainEqual({ type: "decline_match" });
    expect(queueWs!.readyState).toBe(FakeWebSocket.CLOSED);
  });
});

// ---------------------------------------------------------------------------
// MatchProposal.abandon() — resource leak cleanup (GAP-32)
// ---------------------------------------------------------------------------

describe("MatchProposal — abandon() (GAP-32)", () => {
  beforeEach(() => {
    stubWebSocket();
    stubFetch(true);
  });

  async function getProposal(): Promise<MatchProposal> {
    const matchmakePromise = makeClient().matchmake("game1");
    await vi.waitFor(() => expect(queueWs).toBeDefined());
    queueWs!.open();
    queueWs!.receive(
      JSON.stringify({
        type: "match_found",
        payload: { matchId: "m1", opponents: [], acceptDeadline: Date.now() + 15000 },
      })
    );
    return matchmakePromise;
  }

  it("closes the WebSocket on abandon()", async () => {
    const proposal = await getProposal();
    proposal.abandon();
    expect(queueWs!.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("does not send accept_match or decline_match on abandon()", async () => {
    const proposal = await getProposal();
    const sentBefore = queueWs!.sent.length;
    proposal.abandon();
    const newMsgs = queueWs!.sent.slice(sentBefore).map((s) => JSON.parse(s) as { type: string });
    expect(newMsgs.map((m) => m.type)).not.toContain("accept_match");
    expect(newMsgs.map((m) => m.type)).not.toContain("decline_match");
  });
});

// ---------------------------------------------------------------------------
// leaveQueue()
// ---------------------------------------------------------------------------

describe("VersusClient — leaveQueue()", () => {
  it("POSTs to /versus/:gameId/queue/leave with correct headers", async () => {
    stubFetch(true);
    await makeClient().leaveQueue("game1");

    const fetchMock = vi.mocked(globalThis.fetch);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/versus/game1/queue/leave`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });
});

// ---------------------------------------------------------------------------
// getConfig / setConfig / listMatches / inspectMatch
// ---------------------------------------------------------------------------

describe("VersusClient — REST helpers", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })
    );
  });

  it("getConfig: GET /versus/:gameId/config with auth headers", async () => {
    await makeClient().getConfig("g1");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/versus/g1/config`);
    expect((init as { method?: string }).method).toBeUndefined(); // default GET
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("setConfig: PUT /versus/:gameId/config", async () => {
    await makeClient().setConfig("g1", { queueTtl: 60 } as never);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/versus/g1/config`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toMatchObject({ queueTtl: 60 });
  });

  it("listMatches: GET /versus/:gameId/matches", async () => {
    await makeClient().listMatches("g1");
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/versus/g1/matches`);
  });

  it("inspectMatch: GET /versus/matches/:matchId", async () => {
    await makeClient().inspectMatch("match-123");
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/versus/matches/match-123`);
  });
});
