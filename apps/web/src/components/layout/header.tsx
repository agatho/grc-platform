"use client";
// Sprint 1: Header with Org-Switcher + Notifications + Profile (S1-19, S1-23, S1-22)
export function Header() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>{/* Org-Switcher (S1-19) */}</div>
      <div className="flex items-center gap-4">
        {/* Notifications Bell (S1-23) */}
        {/* User Profile (S1-22) */}
      </div>
    </header>
  );
}
