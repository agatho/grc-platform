import { cn } from "@grc/ui";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-12, reported by WP11]
 *
 * The three dots were purely decorative: no `role`, no name, no text. A
 * screen-reader user got silence where a sighted user sees "something is
 * happening" — WCAG 4.1.3 (Status Messages) / EN 301 549 §9.4.1.3.
 *
 * `role="status"` implies `aria-live="polite"`, so the label is announced when
 * the spinner appears and does not interrupt what the user is reading. The
 * dots themselves are `aria-hidden`: they carry no information the label does
 * not, and three unnamed elements in the accessibility tree are noise.
 *
 * The label is a prop rather than a `useTranslations()` call on purpose: this
 * component must render inside test harnesses and error boundaries that have
 * no `NextIntlClientProvider` above them, and next-intl throws without one —
 * an untranslated spinner is a defect, a spinner that crashes the error page
 * is a worse one. Pass `t("loading")` from the call site; `common.loading`
 * exists in both catalogues. The fallback is German because `de` is the
 * default locale (`src/i18n/request.ts`).
 */
export function LoadingSpinner({
  className,
  label = "Wird geladen …",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-1", className)}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_0ms_infinite]"
      />
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_150ms_infinite]"
      />
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-[pulse_1s_ease-in-out_300ms_infinite]"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingPage({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner className="scale-150" label={label} />
    </div>
  );
}
