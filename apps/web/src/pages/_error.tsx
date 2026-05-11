// Pages-router error page — exists ONLY to override Next.js's auto-generated
// `_error.js`, which on this codebase tries to pull the App Router's
// not-found.tsx through the same prerender pipeline and trips
// `useContext is null` because the providers in app/layout.tsx aren't
// initialised during static export.
//
// This file is a plain stateless component with zero context dependencies,
// so the build-time prerender of /404 and /500 succeeds. The App Router
// `app/not-found.tsx` continues to render at request time for actual
// not-found responses on real navigation.

import type { NextPage, NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
  const message =
    statusCode === 404
      ? "Seite nicht gefunden"
      : statusCode
        ? `Fehler ${statusCode}`
        : "Ein Fehler ist aufgetreten";
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
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, margin: 0 }}>
        {statusCode ?? "Error"}
      </h1>
      <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>{message}</p>
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
};

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
