"use client";

// Global error boundary — replaces the auto-generated `/_global-error`
// artifact. This is the App-Router successor of the former
// `src/pages/_error.tsx` shim (removed with the Next-16 migration):
// the build-time prerender of `/_global-error` runs WITHOUT the
// providers from app/layout.tsx (no next-intl, no theme, no session),
// so this component must stay context-free — plain markup, inline
// styles, hardcoded strings (deliberate i18n exception, mirrored from
// the old shim). global-error replaces the root layout, hence the
// explicit <html>/<body>.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          padding: "1rem",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: "#111827",
        }}
      >
        <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: 0 }}>
          Fehler
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>
          Ein unerwarteter Fehler ist aufgetreten.
        </p>
        <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#2563eb",
              color: "white",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Erneut versuchen
          </button>
          <a
            href="/dashboard"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#e5e7eb",
              color: "#111827",
              borderRadius: "0.5rem",
              textDecoration: "none",
            }}
          >
            Zum Dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
