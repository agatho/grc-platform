// #WP3-S02-09 — Login-Lockout.
//
// Befund: der primäre Login (`/api/auth/callback/credentials`) enthielt
// KEINERLEI Drosselung — kein Zähler, keine Sperre, keine Verzögerung. Die
// Zielkennung war aus dem öffentlichen Repository bekannt (S02-01,
// `admin@arctos.dev` / `admin123`), sodass ein Angreifer mit
// Leitungsgeschwindigkeit raten konnte. Das einzige vorhandene Limit
// (`admin-login`) war per IP gebildet und über `X-Forwarded-For` umgehbar —
// und wegen S02-04 ohnehin nicht erreichbar.
//
// Der Lockout ist bewusst KONTO-basiert: die IP stammt aus einem
// client-kontrollierten Header und ist damit keine Grundlage für eine
// Sicherheitsentscheidung. Zähler und Sperre liegen in `user`
// (Migration 0411) und werden über SECURITY-DEFINER-Funktionen gepflegt
// (Migration 0412), weil der Login ohne Org-Kontext läuft und `user` FORCE-RLS
// hat.

import { describe, it, expect, beforeEach, vi } from "vitest";

/** In-memory stand-in for the two SECURITY DEFINER functions. */
const state = new Map<
  string,
  { attempts: number; lockedUntil: number | null }
>();

const executed: string[] = [];

vi.mock("@grc/db", () => ({
  db: {
    execute: vi.fn(async (q: unknown) => {
      const text = JSON.stringify(q);
      executed.push(text);
      const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+/i);
      const email = emailMatch?.[0] ?? "";
      const row = state.get(email) ?? { attempts: 0, lockedUntil: null };

      if (text.includes("auth_check_login_lock")) {
        const locked = !!row.lockedUntil && row.lockedUntil > Date.now();
        return [
          {
            out_locked: locked,
            out_locked_until: row.lockedUntil
              ? new Date(row.lockedUntil).toISOString()
              : null,
          },
        ];
      }
      if (text.includes("auth_register_login_failure")) {
        row.attempts += 1;
        if (row.attempts >= 10) {
          row.lockedUntil = Date.now() + 15 * 60_000;
        }
        state.set(email, row);
        return [{ out_attempts: row.attempts, out_locked_until: row.lockedUntil }];
      }
      if (text.includes("auth_register_login_success")) {
        state.clear();
        return [];
      }
      return [];
    }),
  },
  withUserReadContext: vi.fn(),
  user: {},
  userOrganizationRole: {},
  accessLog: {},
  ssoConfig: {},
}));

import {
  checkLoginLock,
  registerLoginFailure,
  registerLoginSuccess,
  normaliseEmail,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
} from "../src/providers";

const EMAIL = "victim@example.test";

describe("S02-09 — account lockout after repeated failures", () => {
  beforeEach(() => {
    state.clear();
    executed.length = 0;
  });

  it("is not locked before any failure", async () => {
    const lock = await checkLoginLock(EMAIL);
    expect(lock.locked).toBe(false);
  });

  it("stays open below the threshold", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i++) {
      await registerLoginFailure(EMAIL);
    }
    const lock = await checkLoginLock(EMAIL);
    expect(lock.locked).toBe(false);
  });

  it("locks the account at the threshold (S02-09 PoC)", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
      await registerLoginFailure(EMAIL);
    }
    const lock = await checkLoginLock(EMAIL);
    expect(lock.locked).toBe(true);
    expect(lock.lockedUntil).toBeInstanceOf(Date);
    // The lock window is bounded so an attacker cannot use it as a DoS on the
    // legitimate user beyond the configured period.
    expect(LOGIN_LOCKOUT_MINUTES).toBeGreaterThan(0);
    expect(LOGIN_LOCKOUT_MINUTES).toBeLessThanOrEqual(60);
  });

  it("a successful login clears the counter", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
      await registerLoginFailure(EMAIL);
    }
    expect((await checkLoginLock(EMAIL)).locked).toBe(true);
    await registerLoginSuccess("11111111-1111-1111-1111-111111111111");
    expect((await checkLoginLock(EMAIL)).locked).toBe(false);
  });

  it("the lock is keyed by account, not by a spoofable client IP", async () => {
    // The audit's bypass was `X-Forwarded-For: 10.0.0.<n>` incremented per
    // attempt. Nothing in this control reads a header at all.
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
      await registerLoginFailure(EMAIL);
    }
    expect((await checkLoginLock(EMAIL)).locked).toBe(true);
    expect(executed.join("|")).not.toMatch(/x-forwarded-for|x-real-ip/i);
  });

  it("normalises the e-mail so case cannot reset the counter (S02-17)", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
      await registerLoginFailure(normaliseEmail("Victim@Example.Test"));
    }
    expect((await checkLoginLock(normaliseEmail(EMAIL))).locked).toBe(true);
    expect(normaliseEmail("  Max.Muster@Firma.DE ")).toBe("max.muster@firma.de");
  });

  it("a DB failure in the lock check does not lock everyone out", async () => {
    const dbmod = await import("@grc/db");
    (dbmod.db.execute as unknown as { mockRejectedValueOnce: (e: Error) => void })
      .mockRejectedValueOnce(new Error("connection reset"));
    const lock = await checkLoginLock(EMAIL);
    expect(lock.locked).toBe(false);
  });
});
