// [ARCTOS-FULL-2026-08-31 / WP12 · S12-04, S12-06, S12-07, S12-08, S12-12]
//
// Reproduction tests for the four URL/header findings. Each case here fails
// against the pre-fix code, which is the bar the remediation plan sets in §1.1.

import { describe, it, expect } from "vitest";
import { safeExternalHref, safeRedirectPath } from "@grc/ui";
import {
  contentSecurityPolicy,
  staticSecurityHeaders,
  generateCspNonce,
} from "@/lib/security-headers";

describe("S12-06 / S12-12 — safeExternalHref", () => {
  it("rejects the exact payload from the finding", () => {
    // `programme_step_link.target_url` accepted this through
    // `z.string().max(1000)` and the step detail page rendered it as an href.
    // React logs a dev warning for a javascript: href and sets the attribute
    // anyway, so it ran in the victim's origin with their session and roles.
    expect(
      safeExternalHref(
        "javascript:fetch('/api/v1/programmes/journeys/x',{method:'DELETE'})",
      ),
    ).toBeUndefined();
  });

  it.each([
    ["JaVaScRiPt:alert(1)", "case is normalised by the URL parser"],
    ["  javascript:alert(1)", "leading whitespace is stripped by the parser"],
    ["java\tscript:alert(1)", "embedded TAB — a scheme blocklist misses this"],
    ["data:text/html,<script>alert(1)</script>", "data: renders as a document"],
    ["vbscript:msgbox(1)", "legacy scheme"],
    ["//evil.tld/path", "protocol-relative: looks internal, navigates away"],
    ["file:///etc/passwd", "local file"],
  ])("rejects %s (%s)", (input) => {
    expect(safeExternalHref(input)).toBeUndefined();
  });

  it.each([
    "https://example.org/evidence.pdf",
    "http://intranet.local/policy",
    "mailto:dpo@example.org",
    "tel:+4930123456",
    "/programmes/42",
    "#section",
    "?tab=controls",
  ])("passes %s through unchanged", (input) => {
    expect(safeExternalHref(input)).toBe(input);
  });

  it("returns undefined rather than throwing for null/empty input", () => {
    expect(safeExternalHref(null)).toBeUndefined();
    expect(safeExternalHref(undefined)).toBeUndefined();
    expect(safeExternalHref("   ")).toBeUndefined();
  });
});

describe("S12-07 — safeRedirectPath", () => {
  it("collapses the phishing URL from the finding to the fallback", () => {
    // `/login?callbackUrl=https://arctos-kunde.attacker.tld/login` — the
    // victim authenticates on the real, TLS-secured domain and is then
    // handed to a look-alike login page that asks again.
    expect(safeRedirectPath("https://arctos-kunde.attacker.tld/login")).toBe(
      "/dashboard",
    );
  });

  it.each([
    ["//attacker.tld", "protocol-relative — defeats a naive startsWith('/')"],
    ["/\\attacker.tld", "backslash is normalised to / by several browsers"],
    ["/\\\\attacker.tld", "double backslash, same reason"],
    ["javascript:alert(1)", "no scheme is allowed at all"],
    ["https://evil.tld", "absolute off-origin"],
    ["", "empty"],
    ["relative/path", "not absolute — ambiguous base"],
  ])("rejects %s (%s)", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });

  it("rejects a path with an embedded control character", () => {
    // Browsers strip TAB/CR/LF before parsing, so "/\t/evil.tld" becomes
    // "//evil.tld".
    expect(safeRedirectPath("/\t/evil.tld")).toBe("/dashboard");
    expect(safeRedirectPath("/\n/evil.tld")).toBe("/dashboard");
  });

  it("preserves a legitimate deep link with query and fragment", () => {
    expect(safeRedirectPath("/controls/42?tab=evidence#c-7")).toBe(
      "/controls/42?tab=evidence#c-7",
    );
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeRedirectPath("https://evil.tld", "/report")).toBe("/report");
  });
});

describe("S12-04 — Content-Security-Policy", () => {
  const csp = contentSecurityPolicy("TESTNONCE");

  it("no longer permits unsafe-eval", () => {
    expect(csp).not.toContain("unsafe-eval");
  });

  it("no longer permits unsafe-inline in script-src", () => {
    // This is the load-bearing part: `'unsafe-inline'` in script-src is
    // exactly what makes a `javascript:` URI execute rather than be blocked,
    // so it was the reason the CSP offered no fallback against S12-06/S12-12.
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'nonce-TESTNONCE'");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("keeps unsafe-inline for style-src only, which cannot execute script", () => {
    const styleSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("style-src"))!;
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("locks down the directives an injection would otherwise reach for", () => {
    for (const directive of [
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "connect-src 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("re-adds unsafe-eval only for the dev server, which needs it", () => {
    expect(contentSecurityPolicy("N", { isDev: true })).toContain(
      "unsafe-eval",
    );
  });

  it("mints a fresh, unguessable nonce per call", () => {
    const a = generateCspNonce();
    const b = generateCspNonce();
    expect(a).not.toBe(b);
    // 16 bytes base64url, unpadded.
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe("S12-08 — security headers live in the application", () => {
  const headers = new Map(staticSecurityHeaders().map((h) => [h.key, h.value]));

  it.each([
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ])("sets %s without needing the reverse proxy", (key) => {
    // These existed only in deploy/Caddyfile, which only the single-server
    // Hetzner path installs. A Compose or Kubernetes deployment served the app
    // with none of them.
    expect(headers.get(key)).toBeTruthy();
  });

  it("does not set X-XSS-Protection", () => {
    // The legacy auditor is a no-op in every current browser and, where it
    // still exists, can be abused to disable scripts selectively.
    expect(headers.has("X-XSS-Protection")).toBe(false);
  });

  it("HSTS covers subdomains and is long enough to be preloadable", () => {
    const hsts = headers.get("Strict-Transport-Security")!;
    expect(hsts).toContain("includeSubDomains");
    expect(Number(hsts.match(/max-age=(\d+)/)![1])).toBeGreaterThanOrEqual(
      31536000,
    );
  });
});
