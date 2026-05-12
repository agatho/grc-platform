import { Shield } from "lucide-react";

// #NIGHT-050: /admin/abac rendered as a near-empty page with only a
// "Richtlinie erstellen" button — no context for first-time visitors.
// Reusable empty-state component the page can import to anchor the UX.

export function AbacEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <Shield size={32} className="text-gray-400 mb-3" />
      <h3 className="text-base font-semibold text-gray-700">
        Noch keine ABAC-Richtlinien definiert
      </h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Erstellen Sie Ihre erste Richtlinie um attributbasierten Zugriff
        (z.&nbsp;B. nach Abteilung, Standort oder Datenklassifizierung) zu
        konfigurieren. ABAC ergänzt die rollenbasierte Zugriffssteuerung (RBAC)
        mit feingranularen Bedingungen.
      </p>
    </div>
  );
}
