/**
 * Hand-rolled FakeWebSocket for unit-testing Room and VersusClient.
 *
 * Usage:
 *   vi.stubGlobal("WebSocket", FakeWebSocket);
 *   // construct Room / VersusClient — they will get a FakeWebSocket instance
 *   fakeWs.open();          // trigger the "open" event
 *   fakeWs.receive(data);   // inject a "message" event
 *   fakeWs.serverClose();   // inject a dirty "close" event (wasClean=false)
 *   fakeWs.sent             // inspect outbound messages
 */
export class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState: number = FakeWebSocket.CONNECTING;
  readonly url: string;
  /** All payloads passed to send() while OPEN. */
  sent: string[] = [];

  constructor(url: string | URL) {
    super();
    this.url = url.toString();
  }

  send(data: string): void {
    if (this.readyState === FakeWebSocket.OPEN) {
      this.sent.push(data);
    }
  }

  close(_code?: number, _reason?: string): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close", { wasClean: true }));
  }

  /** Test helper: fire the "open" event and move to OPEN state. */
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  /** Test helper: inject an incoming message from the server. */
  receive(data: string): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  /** Test helper: inject an unclean "close" event (wasClean=false). */
  serverClose(code = 1006, reason = ""): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent("close", { wasClean: false, code, reason }));
  }
}
