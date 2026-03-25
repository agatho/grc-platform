"use client";

import { Menu } from "lucide-react";
import { OrgSwitcher } from "./org-switcher";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  onMobileMenuToggle: () => void;
  currentOrgId: string | null;
}

export function Header({ onMobileMenuToggle, currentOrgId }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <OrgSwitcher currentOrgId={currentOrgId} />
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
