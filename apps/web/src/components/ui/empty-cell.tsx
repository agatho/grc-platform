// Centralised "no value" placeholder for table cells, detail rows, and
// any other context where a field has no value to render.
//
// Background: QA-018 (2026-05-11) flagged that the em-dash placeholder
// `—` was easily misread as three ASCII hyphens "---" — partly font
// rendering, partly because the same screen also contained other cells
// with literal "---" placeholders so users couldn't tell the styles
// apart. This component fixes both:
//
//   - One place to change if the design system picks a different glyph
//     (italic em-dash, "n/a", a subtle dot, etc.)
//   - Slightly emphasised tracking + leading-none so the em-dash reads
//     as one wide character, not a string of dashes
//   - aria-label so screen readers say "kein Wert" instead of dictating
//     a long horizontal-bar character

import { cn } from "@grc/ui";

interface EmptyCellProps {
  /** Override the visible glyph. Defaults to em-dash (U+2014). */
  glyph?: string;
  /** Override the screen-reader label. Defaults to "kein Wert". */
  srLabel?: string;
  /** Extra Tailwind classes for layout/colour overrides at the call site. */
  className?: string;
}

export function EmptyCell({
  glyph = "—",
  srLabel = "kein Wert",
  className,
}: EmptyCellProps) {
  return (
    <span
      aria-label={srLabel}
      title={srLabel}
      className={cn(
        // Slightly larger + wider letter-spacing so the em-dash reads as
        // a deliberate single character rather than three ASCII hyphens.
        "inline-block text-gray-400 select-none leading-none tracking-widest text-base",
        className,
      )}
    >
      {glyph}
    </span>
  );
}
