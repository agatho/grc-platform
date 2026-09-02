"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * [E2E-TRIAGE-2026-09-02 · C-06] `nonce` is not cosmetic.
 *
 * `next-themes` renders a synchronous INLINE `<script>` into the document so
 * the stored theme is applied before first paint (the anti-flash script). Next
 * stamps its middleware nonce onto the scripts IT emits, but it does not know
 * about this one — it is markup produced by a component. Since WP12/S12-04
 * moved `script-src` from `'unsafe-inline'` to `'nonce-…' 'strict-dynamic'`,
 * that script has been blocked by our own CSP on every page:
 *
 *   "Executing inline script violates the following Content Security Policy
 *    directive 'script-src 'self' 'nonce-…' 'strict-dynamic' https:'."
 *
 * Measured on the running instance: of the 23 `<script>` tags in the rendered
 * document, 22 carry the nonce and exactly this one does not. The CSP is right
 * and stays as it is — the script has to carry the nonce. `app/layout.tsx`
 * reads it from the `x-nonce` request header the middleware sets
 * (`apps/web/src/middleware.ts`) and passes it in here.
 *
 * Consequence beyond the console error `platform-smoke.spec.ts:288` reports:
 * with the script blocked, a user whose stored theme is `dark` or
 * `high-contrast` sees the default `arctic` markup until React hydrates — the
 * flash of the wrong theme this script exists to prevent.
 */
export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="arctic"
      themes={["arctic", "dark", "high-contrast"]}
      storageKey="arctos-theme"
      enableSystem={false}
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
