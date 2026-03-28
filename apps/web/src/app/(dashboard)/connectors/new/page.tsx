"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONNECTOR_TYPES = [
  { key: "aws", label: "AWS", category: "cloud", authMethods: ["service_account", "api_key"] },
  { key: "azure", label: "Azure", category: "cloud", authMethods: ["oauth2", "service_account"] },
  { key: "gcp", label: "GCP", category: "cloud", authMethods: ["service_account"] },
  { key: "entra_id", label: "Entra ID", category: "identity", authMethods: ["oauth2"] },
  { key: "google_workspace", label: "Google Workspace", category: "identity", authMethods: ["oauth2", "service_account"] },
  { key: "m365", label: "M365", category: "identity", authMethods: ["oauth2"] },
  { key: "git_platform", label: "Git Platform", category: "devops", authMethods: ["api_key", "oauth2"] },
  { key: "issue_tracker", label: "Issue Tracker", category: "devops", authMethods: ["api_key", "oauth2"] },
  { key: "wiki", label: "Wiki", category: "devops", authMethods: ["api_key", "oauth2"] },
  { key: "endpoint_mgmt", label: "Endpoint Mgmt", category: "it", authMethods: ["api_key"] },
  { key: "network_firewall", label: "Network Firewall", category: "it", authMethods: ["api_key"] },
  { key: "hr_system", label: "HR System", category: "identity", authMethods: ["api_key", "oauth2"] },
  { key: "custom_api", label: "Custom API", category: "other", authMethods: ["api_key", "basic_auth", "oauth2"] },
];

export default function NewConnectorPage() {
  const t = useTranslations("connectors");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [authMethod, setAuthMethod] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConnector = CONNECTOR_TYPES.find((c) => c.key === selectedType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedType || !authMethod) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          connectorType: selectedType,
          providerKey: selectedType,
          authMethod,
          baseUrl: baseUrl || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/connectors/${json.data.id}`);
      } else {
        const json = await res.json();
        setError(json.error ?? "Failed to create connector");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("addConnector")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={2} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connector Type</label>
            <div className="grid grid-cols-3 gap-2">
              {CONNECTOR_TYPES.map((ct) => (
                <button
                  key={ct.key}
                  type="button"
                  onClick={() => { setSelectedType(ct.key); setAuthMethod(ct.authMethods[0]); }}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${selectedType === ct.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {selectedConnector && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auth Method</label>
              <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {selectedConnector.authMethods.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (optional)</label>
            <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="https://..." />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving || !name || !selectedType || !authMethod}>
            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plug size={14} className="mr-1" />}
            {t("addConnector")}
          </Button>
        </div>
      </form>
    </div>
  );
}
