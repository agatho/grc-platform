// Legal footer — visible on every page including login/signup.
// Required so § 5 DDG and Art. 13 DSGVO links are reachable from
// anywhere without a login. Kept minimal to not interfere with app UX.

import Link from "next/link";

export function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50/50 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4">
        <span>© {year} ARCTOS — Audit, Risk, Compliance & Trust OS</span>
        <nav className="flex items-center gap-4">
          <Link href="/legal/imprint" className="hover:text-slate-700 hover:underline dark:hover:text-slate-200">
            Impressum
          </Link>
          <Link href="/legal/privacy" className="hover:text-slate-700 hover:underline dark:hover:text-slate-200">
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}
