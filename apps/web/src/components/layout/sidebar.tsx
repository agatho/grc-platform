"use client";
// Sprint 1: Sidebar with role-based navigation (S1-18, S1-12)
// TODO: Implement with shadcn/ui + Lucide icons
export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-blue-900">GRC Platform</h1>
      </div>
      <nav className="flex-1 p-4">
        {/* Navigation items filtered by role — see S1-12 */}
        <p className="text-sm text-gray-400">Sprint 1: Navigation</p>
      </nav>
    </aside>
  );
}
