import type { ReactNode } from "react";

export const metadata = {
  title: "ARCTOS - Supplier Portal",
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Minimal header with ARCTOS logo */}
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">ARCTOS</span>
          </div>
          <span className="text-xs text-gray-400">Supplier Portal</span>
        </div>
      </header>

      {/* Main content — centered, max-width 800px */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        {children}
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl text-center text-xs text-gray-400">
          Powered by ARCTOS
        </div>
      </footer>
    </div>
  );
}
