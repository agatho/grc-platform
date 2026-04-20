"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { BookOpen, HelpCircle, X as XIcon } from "lucide-react";
import {
  resolveHandbookForPath,
  type ModuleHandbook,
} from "@/lib/module-handbook";

/**
 * Help button mounted in the header. If the current path matches one of the
 * 15 core modules, clicking opens a slide-over with the module handbook.
 * If no match, the button is hidden — keeps the header clean on landing
 * pages that don't need context-specific help.
 */
export function ModuleHelpButton() {
  const pathname = usePathname();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const handbook = useMemo(() => resolveHandbookForPath(pathname), [pathname]);

  if (!handbook) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-700"
        title={locale === "de" ? "Modul-Handbuch" : "Module handbook"}
        aria-label={
          locale === "de" ? "Modul-Handbuch öffnen" : "Open module handbook"
        }
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <HandbookSheet
          handbook={handbook}
          locale={locale}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function HandbookSheet({
  handbook,
  locale,
  onClose,
}: {
  handbook: ModuleHandbook;
  locale: string;
  onClose: () => void;
}) {
  const title = locale === "de" ? handbook.titleDe : handbook.titleEn;
  const tagline = locale === "de" ? handbook.taglineDe : handbook.taglineEn;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{tagline}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={locale === "de" ? "Schließen" : "Close"}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Frameworks badge strip */}
        {handbook.frameworks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 bg-gray-50 px-6 py-3">
            {handbook.frameworks.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-medium text-blue-700"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {handbook.sections.map((section, idx) => (
              <section key={idx}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {locale === "de" ? section.headingDe : section.headingEn}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {locale === "de" ? section.bodyDe : section.bodyEn}
                </p>
              </section>
            ))}
          </div>

          {/* External links */}
          {handbook.externalLinks && handbook.externalLinks.length > 0 && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {locale === "de" ? "Weiterführend" : "Further reading"}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {handbook.externalLinks.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      {locale === "de" ? l.labelDe : l.labelEn}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 text-[11px] text-gray-500">
          {locale === "de"
            ? "Tipp: Drücken Sie die Esc-Taste, um das Handbuch zu schließen."
            : "Tip: press Esc to close the handbook."}
        </div>
      </aside>
    </div>
  );
}
