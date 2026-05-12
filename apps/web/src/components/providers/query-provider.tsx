"use client";

// #NIGHT-042: Top-level QueryClientProvider so every fetch hooked
// through useQuery shares the same cache. Layout components like the
// NotificationBell or org-switcher used to fire duplicate fetches per
// page-load (Cowork QA counted ~86 redundant calls across 17 pages).
//
// staleTime=60s for notifications-class data is a reasonable trade
// between freshness and chatter; specific queries can override.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 60s — long enough to dedupe per-page re-mounts and the
            // header/sidebar fan-out, short enough that a notify-mark-
            // read in one tab is reflected in the other within ~a minute.
            staleTime: 60_000,
            // No window-focus refetch by default; the Bell's polling
            // covers the freshness story without flooding when an
            // editor flips between Arctos and another tab.
            refetchOnWindowFocus: false,
            // Don't burn requests on transient network blips.
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
