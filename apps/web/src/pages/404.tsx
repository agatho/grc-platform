// Dedicated 404 page for Next.js's static export. See _error.tsx for the
// background — same rationale: keep this file context-free so the
// build-time prerender of /404 doesn't trip on `useContext is null`.
//
// The App Router app/not-found.tsx still handles request-time 404s on
// real navigation; this only owns the static .html artefact.

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "1rem",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>
        Seite nicht gefunden
      </p>
      <a
        href="/dashboard"
        style={{
          marginTop: "2rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: "0.5rem",
          textDecoration: "none",
        }}
      >
        Zum Dashboard
      </a>
    </div>
  );
}
