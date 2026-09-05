"use client";

// [ARCTOS-FULL-2026-08-31 / WP12 · S12-22] Route-group error boundary.
// Without one, every render error propagated to `app/global-error.tsx`, which
// replaces the root layout and therefore erased the whole application shell.
// See components/layout/segment-error.tsx for the reasoning and for why
// `error.digest` is shown but `error.message` is not.

import { SegmentError } from "@/components/layout/segment-error";

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError {...props} />;
}
