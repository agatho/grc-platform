// Tests for the cron-instrument wrapper.
//
// The wrapper is small but it's wrapped around 121 cron handlers in
// production. We need to be confident:
//   - it returns the wrapped handler's result unchanged
//   - it re-throws errors (so the runner's retry policy still fires)
//   - it always emits start + (finish | error) on stdout/stderr
//   - duration is included in the finish log
//   - cron name is included in every log line

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { withCronInstrumentation } from "../../src/lib/cron-instrument";

type LogLine = Record<string, unknown>;

function parseStream(buf: string): LogLine[] {
  return buf
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogLine);
}

describe("withCronInstrumentation", () => {
  let stdout: string;
  let stderr: string;
  const realStdoutWrite = process.stdout.write.bind(process.stdout);
  const realStderrWrite = process.stderr.write.bind(process.stderr);

  beforeEach(() => {
    stdout = "";
    stderr = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += chunk.toString();
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += chunk.toString();
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stdout.write = realStdoutWrite;
    process.stderr.write = realStderrWrite;
  });

  it("returns the wrapped handler's result unchanged", async () => {
    const wrapped = withCronInstrumentation("noop", async () => ({
      processed: 7,
    }));
    const result = await wrapped();
    expect(result).toEqual({ processed: 7 });
  });

  it("emits start + finish on stdout when handler resolves", async () => {
    const wrapped = withCronInstrumentation("foo-job", async () => ({
      n: 1,
    }));
    await wrapped();
    const lines = parseStream(stdout);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      cron: "foo-job",
      phase: "start",
      level: "info",
    });
    expect(lines[1]).toMatchObject({
      cron: "foo-job",
      phase: "finish",
      level: "info",
      result: { n: 1 },
    });
    expect(lines[1]?.durationMs).toEqual(expect.any(Number));
    expect(stderr).toBe("");
  });

  it("emits start + error and re-throws when handler rejects", async () => {
    const boom = new Error("connection lost");
    const wrapped = withCronInstrumentation("boom-job", async () => {
      throw boom;
    });
    await expect(wrapped()).rejects.toThrow("connection lost");
    const startLines = parseStream(stdout);
    const errorLines = parseStream(stderr);
    expect(startLines).toHaveLength(1);
    expect(startLines[0]).toMatchObject({
      cron: "boom-job",
      phase: "start",
    });
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0]).toMatchObject({
      cron: "boom-job",
      phase: "error",
      level: "error",
      message: "connection lost",
      errorName: "Error",
    });
    expect(errorLines[0]?.durationMs).toEqual(expect.any(Number));
  });

  it("treats void return value as null in the finish log", async () => {
    const wrapped = withCronInstrumentation("void-job", async () => {
      // no return
    });
    await wrapped();
    const lines = parseStream(stdout);
    expect(lines[1]).toMatchObject({
      cron: "void-job",
      phase: "finish",
      result: null,
    });
  });

  it("tracks duration accurately for slow handlers", async () => {
    const wrapped = withCronInstrumentation("slow-job", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ok: true };
    });
    await wrapped();
    const lines = parseStream(stdout);
    const durationMs = lines[1]?.durationMs as number;
    expect(durationMs).toBeGreaterThanOrEqual(40);
    expect(durationMs).toBeLessThan(500);
  });

  it("preserves the error type on rethrow", async () => {
    class CustomError extends Error {
      readonly kind = "custom";
    }
    const wrapped = withCronInstrumentation("custom-err", async () => {
      throw new CustomError("specific failure");
    });
    await expect(wrapped()).rejects.toBeInstanceOf(CustomError);
    const errorLines = parseStream(stderr);
    expect(errorLines[0]).toMatchObject({
      cron: "custom-err",
      errorName: "CustomError",
    });
  });

  it("includes service field for log aggregation routing", async () => {
    const wrapped = withCronInstrumentation("svc-test", async () => undefined);
    await wrapped();
    const lines = parseStream(stdout);
    for (const line of lines) {
      expect(line.service).toEqual(expect.stringMatching(/arctos/));
    }
  });
});
