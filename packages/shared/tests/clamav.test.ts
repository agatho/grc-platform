// ClamAV clamd INSTREAM client — protocol framing + response parsing
// against a mocked socket (no clamd needed).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import {
  parseClamdResponse,
  scanBuffer,
  isClamAvConfigured,
  isClamAvFailClosed,
  type ClamdSocketLike,
} from "../src/lib/clamav";

class FakeClamdSocket extends EventEmitter implements ClamdSocketLike {
  written: Buffer[] = [];
  ended = false;
  destroyed = false;
  private readonly reply: Buffer | null;
  private readonly closeWithoutReply: boolean;

  constructor(reply: string | null, closeWithoutReply = false) {
    super();
    this.reply = reply === null ? null : Buffer.from(reply, "utf8");
    this.closeWithoutReply = closeWithoutReply;
    // Emit connect asynchronously, after scanBuffer registered listeners.
    queueMicrotask(() => this.emit("connect"));
  }

  write(chunk: Uint8Array): boolean {
    this.written.push(Buffer.from(chunk));
    // After the zero-length terminator frame arrives, answer.
    const total = Buffer.concat(this.written);
    if (total.length >= 4 && total.subarray(-4).readUInt32BE(0) === 0) {
      queueMicrotask(() => {
        if (this.closeWithoutReply) {
          this.emit("close");
        } else if (this.reply) {
          this.emit("data", this.reply);
        }
      });
    }
    return true;
  }

  end(): void {
    this.ended = true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  setTimeout(_msecs: number, _callback?: () => void): this {
    return this;
  }
}

describe("parseClamdResponse", () => {
  it("parses a clean verdict", () => {
    expect(parseClamdResponse("stream: OK\0")).toEqual({ status: "clean" });
  });

  it("parses an infected verdict with the signature name", () => {
    expect(parseClamdResponse("stream: Eicar-Signature FOUND\0")).toEqual({
      status: "infected",
      signature: "Eicar-Signature",
    });
  });

  it("maps anything else to an error", () => {
    const res = parseClamdResponse("INSTREAM size limit exceeded. ERROR\0");
    expect(res.status).toBe("error");
    expect(res.error).toContain("size limit");
  });
});

describe("scanBuffer (mocked socket)", () => {
  it("speaks the INSTREAM protocol: command, framed chunks, terminator", async () => {
    const socket = new FakeClamdSocket("stream: OK\0");
    const payload = Buffer.alloc(10000, 0x41); // forces 2 chunks at 8192

    const result = await scanBuffer(payload, {
      connect: () => socket,
    });

    expect(result).toEqual({ status: "clean" });

    const sent = Buffer.concat(socket.written);
    // 1. z-prefixed command
    expect(sent.subarray(0, 10).toString("utf8")).toBe("zINSTREAM\0");
    // 2. first frame: 4-byte BE length 8192 + data
    expect(sent.readUInt32BE(10)).toBe(8192);
    expect(sent.subarray(14, 14 + 8192).every((b) => b === 0x41)).toBe(true);
    // 3. second frame: remaining 1808 bytes
    const secondFrameOffset = 14 + 8192;
    expect(sent.readUInt32BE(secondFrameOffset)).toBe(10000 - 8192);
    // 4. zero-length terminator at the very end
    expect(sent.subarray(-4).readUInt32BE(0)).toBe(0);
  });

  it("returns infected + signature on FOUND", async () => {
    const socket = new FakeClamdSocket("stream: Eicar-Signature FOUND\0");
    const result = await scanBuffer(Buffer.from("X5O!..."), {
      connect: () => socket,
    });
    expect(result.status).toBe("infected");
    expect(result.signature).toBe("Eicar-Signature");
  });

  it("returns error when clamd closes without a response", async () => {
    const socket = new FakeClamdSocket(null, true);
    const result = await scanBuffer(Buffer.from("x"), {
      connect: () => socket,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("without a response");
  });

  it("returns error (not throw) on socket errors", async () => {
    const socket = new FakeClamdSocket(null);
    queueMicrotask(() => socket.emit("error", new Error("ECONNREFUSED")));
    const result = await scanBuffer(Buffer.from("x"), {
      connect: () => socket,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("skips scanning when CLAMAV_HOST is not configured", async () => {
    const saved = process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_HOST;
    try {
      const result = await scanBuffer(Buffer.from("x"));
      expect(result).toEqual({ status: "skipped" });
    } finally {
      if (saved !== undefined) process.env.CLAMAV_HOST = saved;
    }
  });
});

describe("env flags", () => {
  const savedHost = process.env.CLAMAV_HOST;
  const savedFail = process.env.CLAMAV_FAIL_CLOSED;

  beforeEach(() => {
    delete process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_FAIL_CLOSED;
  });

  afterEach(() => {
    if (savedHost !== undefined) process.env.CLAMAV_HOST = savedHost;
    else delete process.env.CLAMAV_HOST;
    if (savedFail !== undefined) process.env.CLAMAV_FAIL_CLOSED = savedFail;
    else delete process.env.CLAMAV_FAIL_CLOSED;
  });

  it("isClamAvConfigured reflects CLAMAV_HOST", () => {
    expect(isClamAvConfigured()).toBe(false);
    process.env.CLAMAV_HOST = "localhost";
    expect(isClamAvConfigured()).toBe(true);
  });

  it("isClamAvFailClosed defaults to fail-open", () => {
    expect(isClamAvFailClosed()).toBe(false);
    process.env.CLAMAV_FAIL_CLOSED = "1";
    expect(isClamAvFailClosed()).toBe(true);
  });
});
