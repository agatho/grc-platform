"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { ModuleConfigProvider } from "@/hooks/use-module-config";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  // Derive current org from first role or null
  const currentOrgId = session?.user?.roles?.[0]?.orgId ?? null;

  return (
    <ModuleConfigProvider orgId={currentOrgId}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentOrgId={currentOrgId}
        />
        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          currentOrgId={currentOrgId}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
            currentOrgId={currentOrgId}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ModuleConfigProvider>
  );
}
