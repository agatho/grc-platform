"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { ModernSidebar } from "@/components/layout/modern-sidebar";
import { Header } from "@/components/layout/header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { TabBar } from "@/components/layout/tab-bar";
// import { PageTransition } from "@/components/ui/page-transition";
import { ModuleConfigProvider } from "@/hooks/use-module-config";
import { NavPreferencesProvider } from "@/hooks/use-nav-preferences";
import { TabProvider } from "@/hooks/use-tab-navigation";
import { LayoutProvider, useLayout } from "@/hooks/use-layout-preference";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const { layout } = useLayout();

  // Use the cookie-resolved currentOrgId from the session callback. Falls
  // back to the first role only if the cookie-resolver didn't populate it.
  const currentOrgId =
    session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId ?? null;

  return (
    <ModuleConfigProvider orgId={currentOrgId}>
      <NavPreferencesProvider>
        <TabProvider>
          <div className="flex h-screen bg-gray-50">
            {layout === "modern" ? (
              <ModernSidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                currentOrgId={currentOrgId}
              />
            ) : (
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                currentOrgId={currentOrgId}
              />
            )}
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
              <TabBar />
              <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {children}
              </main>
            </div>
          </div>
        </TabProvider>
      </NavPreferencesProvider>
    </ModuleConfigProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <DashboardShell>{children}</DashboardShell>
    </LayoutProvider>
  );
}
