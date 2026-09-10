"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { OrgSwitcher } from "./org-switcher";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { ModuleHelpButton } from "@/components/help/module-help-button";

interface HeaderProps {
  onMobileMenuToggle: () => void;
  currentOrgId: string | null;
}

export function Header({ onMobileMenuToggle, currentOrgId }: HeaderProps) {
  // [ARCTOS-FULL-2026-08-31 · OP-070] Der einzige eigene Text dieser Leiste
  // ist der zugaengliche Name des Hamburger-Knopfes — und genau der ist der
  // einzige Weg, auf einem schmalen Bildschirm ueberhaupt zu navigieren.
  const t = useTranslations("a11y");
  return (
    <header className="h-14 bg-white/90 backdrop-blur-xl border-b border-gray-200/30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label={t("toggleMenu")}
        >
          <Menu size={20} />
        </button>

        <OrgSwitcher currentOrgId={currentOrgId} />
      </div>

      <div className="flex items-center gap-1">
        <ModuleHelpButton />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
