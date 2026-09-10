// Trusted-proxy-aware client IP resolution for the signature ceremony.
//
// ── #S06-03 (ARCTOS-FULL-2026-08-31, Medium) ────────────────────────
// The sign and decline routes took the FIRST entry of X-Forwarded-For:
//
//   const ipHeader = req.headers.get("x-forwarded-for") || …;
//   const ipAddress = ipHeader.split(",")[0].trim().slice(0, 64);
//
// The left-most XFF entry is by definition the value the CLIENT chose.
// A signer could therefore send `X-Forwarded-For: 203.0.113.9` and have
// that address printed on the signature certificate under "IP-Adresse",
// right next to "Hash-Kette: GÜLTIG" — the IP was not part of the chain
// either, so nothing objected. "I signed from the corporate network"
// was freely constructible.
//
// XFF is appended left-to-right by each hop, so the trustworthy part is
// the RIGHT-hand side: with N proxies of our own in front of the app,
// entry `length - N` is the address the outermost trusted proxy
// observed, and everything left of it is attacker-supplied. N comes
// from TRUSTED_PROXY_HOPS (Caddy in the reference deployment → 1).
//
// When the deployment does not declare its topology we cannot make the
// value trustworthy — so we mark it. `trusted: false` is carried into
// the audit trail and printed on the certificate rather than being
// quietly presented as evidence.

export interface ResolvedClientIp {
  /** The address, or null when none could be established. */
  ip: string | null;
  /**
   * True only when the value was taken from a position that a
   * client-supplied header cannot reach (TRUSTED_PROXY_HOPS configured
   * and the header long enough), or when there is no XFF at all and the
   * socket-level `x-real-ip` was set by our own proxy.
   */
  trusted: boolean;
  /** Why the value is (not) trusted — recorded in the audit metadata. */
  source: "xff_trusted_hop" | "x_real_ip" | "xff_untrusted" | "none";
}

/** Number of reverse proxies under our control in front of the app.
 *  0 (default) means "unknown topology" → XFF is not trusted. */
export function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function resolveClientIp(req: Request): ResolvedClientIp {
  const xff = req.headers.get("x-forwarded-for");
  const hops = trustedProxyHops();

  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      if (hops > 0 && parts.length >= hops) {
        // Entry appended by the outermost proxy we control.
        const idx = parts.length - hops;
        return {
          ip: parts[idx].slice(0, 64),
          trusted: true,
          source: "xff_trusted_hop",
        };
      }
      // Either no declared topology, or fewer entries than hops (the
      // header was truncated or forged) — take the right-most entry,
      // which is still the closest to us, but do not call it trusted.
      return {
        ip: parts[parts.length - 1].slice(0, 64),
        trusted: false,
        source: "xff_untrusted",
      };
    }
  }

  const real = req.headers.get("x-real-ip");
  if (real) {
    // x-real-ip is single-valued: a client can set it, but it cannot
    // append to it, so with a declared proxy in front it is overwritten
    // and therefore reliable.
    return {
      ip: real.trim().slice(0, 64),
      trusted: hops > 0,
      source: "x_real_ip",
    };
  }

  return { ip: null, trusted: false, source: "none" };
}
