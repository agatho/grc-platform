"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Shield,
  KeyRound,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────

interface SsoConfigData {
  id: string;
  provider: "saml" | "oidc";
  displayName: string | null;
  samlMetadataUrl: string | null;
  samlEntityId: string | null;
  samlSsoUrl: string | null;
  samlCertificate: string | null;
  samlAttributeMapping: Record<string, string> | null;
  oidcDiscoveryUrl: string | null;
  oidcClientId: string | null;
  oidcClientSecret: string | null;
  oidcScopes: string | null;
  oidcClaimMapping: Record<string, string> | null;
  isActive: boolean;
  enforceSSO: boolean;
  defaultRole: string;
  groupRoleMapping: Record<string, string>;
  autoProvision: boolean;
}

type TabKey = "saml" | "oidc";

const ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
  { value: "risk_manager", label: "Risk Manager" },
  { value: "control_owner", label: "Control Owner" },
  { value: "auditor", label: "Auditor" },
  { value: "dpo", label: "DPO" },
  { value: "process_owner", label: "Process Owner" },
];

export default function SsoConfigPage() {
  const t = useTranslations("identity");
  const [activeTab, setActiveTab] = useState<TabKey>("saml");
  const [config, setConfig] = useState<SsoConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEnforceDialog, setShowEnforceDialog] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [defaultRole, setDefaultRole] = useState("viewer");
  const [autoProvision, setAutoProvision] = useState(true);
  const [enforceSSO, setEnforceSSO] = useState(false);
  // SAML
  const [samlMetadataUrl, setSamlMetadataUrl] = useState("");
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlSsoUrl, setSamlSsoUrl] = useState("");
  const [samlCertificate, setSamlCertificate] = useState("");
  // OIDC
  const [oidcDiscoveryUrl, setOidcDiscoveryUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcScopes, setOidcScopes] = useState("openid profile email");
  // Group mapping
  const [groupMappings, setGroupMappings] = useState<
    Array<{ group: string; role: string }>
  >([]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/sso");
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        populateForm(json.data);
      }
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  function populateForm(data: SsoConfigData) {
    setActiveTab(data.provider);
    setDisplayName(data.displayName ?? "");
    setDefaultRole(data.defaultRole ?? "viewer");
    setAutoProvision(data.autoProvision);
    setEnforceSSO(data.enforceSSO);
    setSamlMetadataUrl(data.samlMetadataUrl ?? "");
    setSamlEntityId(data.samlEntityId ?? "");
    setSamlSsoUrl(data.samlSsoUrl ?? "");
    setSamlCertificate(data.samlCertificate ?? "");
    setOidcDiscoveryUrl(data.oidcDiscoveryUrl ?? "");
    setOidcClientId(data.oidcClientId ?? "");
    setOidcClientSecret("");
    setOidcScopes(data.oidcScopes ?? "openid profile email");
    const gm = data.groupRoleMapping ?? {};
    setGroupMappings(
      Object.entries(gm).map(([group, role]) => ({ group, role })),
    );
  }

  async function handleLoadMetadata() {
    if (!samlMetadataUrl) return;
    setError("");
    try {
      const res = await fetch("/api/v1/admin/sso/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadataUrl: samlMetadataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSamlEntityId(json.data.entityId);
      setSamlSsoUrl(json.data.ssoUrl);
      setSamlCertificate(json.data.certificate);
      setSuccess(t("metadataLoaded"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("metadataError"));
    }
  }

  async function handleAutoDiscover() {
    if (!oidcDiscoveryUrl) return;
    setError("");
    try {
      const res = await fetch("/api/v1/admin/sso/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveryUrl: oidcDiscoveryUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(t("discoverySuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("discoveryError"));
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const groupRoleMapping: Record<string, string> = {};
    for (const m of groupMappings) {
      if (m.group.trim()) groupRoleMapping[m.group.trim()] = m.role;
    }

    const payload = {
      provider: activeTab,
      displayName: displayName || null,
      defaultRole,
      autoProvision,
      enforceSSO,
      groupRoleMapping,
      ...(activeTab === "saml"
        ? {
            samlMetadataUrl: samlMetadataUrl || null,
            samlEntityId: samlEntityId || null,
            samlSsoUrl: samlSsoUrl || null,
            samlCertificate: samlCertificate || null,
          }
        : {
            oidcDiscoveryUrl: oidcDiscoveryUrl || null,
            oidcClientId: oidcClientId || null,
            ...(oidcClientSecret ? { oidcClientSecret } : {}),
            oidcScopes: oidcScopes || null,
          }),
    };

    try {
      const method = config ? "PUT" : "POST";
      const res = await fetch("/api/v1/admin/sso", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSuccess(t("saveSuccess"));
      fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestLogin() {
    setError("");
    try {
      const res = await fetch("/api/v1/admin/sso/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: activeTab }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.data.redirectUrl, "sso-test", "width=600,height=700");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("testError"));
    }
  }

  async function handleToggleActive() {
    const newActive = !config?.isActive;
    try {
      const res = await fetch("/api/v1/admin/sso", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toggleError"));
    }
  }

  function addGroupMapping() {
    setGroupMappings([...groupMappings, { group: "", role: "viewer" }]);
  }

  function removeGroupMapping(index: number) {
    setGroupMappings(groupMappings.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("ssoTitle")}</h1>
          <p className="text-sm text-gray-500">{t("ssoDescription")}</p>
        </div>
        {config && (
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={
                config.isActive
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500"
              }
            >
              {config.isActive ? t("active") : t("inactive")}
            </Badge>
            <Switch
              checked={config.isActive}
              onCheckedChange={handleToggleActive}
            />
          </div>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("saml")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "saml"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Shield className="mr-2 inline h-4 w-4" />
          SAML 2.0
        </button>
        <button
          onClick={() => setActiveTab("oidc")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "oidc"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <KeyRound className="mr-2 inline h-4 w-4" />
          OIDC
        </button>
      </div>

      {/* SAML Configuration */}
      {activeTab === "saml" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("samlConfig")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("metadataUrl")}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="url"
                  value={samlMetadataUrl}
                  onChange={(e) => setSamlMetadataUrl(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://idp.example.com/metadata.xml"
                />
                <button
                  onClick={handleLoadMetadata}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  {t("loadMetadata")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("entityId")}
                </label>
                <input
                  type="text"
                  value={samlEntityId}
                  onChange={(e) => setSamlEntityId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("ssoUrl")}
                </label>
                <input
                  type="url"
                  value={samlSsoUrl}
                  onChange={(e) => setSamlSsoUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("certificate")}
              </label>
              <textarea
                value={samlCertificate}
                onChange={(e) => setSamlCertificate(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder="MIICx..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* OIDC Configuration */}
      {activeTab === "oidc" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("oidcConfig")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("discoveryUrl")}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="url"
                  value={oidcDiscoveryUrl}
                  onChange={(e) => setOidcDiscoveryUrl(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://accounts.example.com/.well-known/openid-configuration"
                />
                <button
                  onClick={handleAutoDiscover}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  {t("autoDiscover")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("clientId")}
                </label>
                <input
                  type="text"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t("clientSecret")}
                </label>
                <input
                  type="password"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder={config?.oidcClientSecret ? "********" : ""}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("scopes")}
              </label>
              <input
                type="text"
                value={oidcScopes}
                onChange={(e) => setOidcScopes(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Common Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("commonSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("displayName")}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder={t("displayNamePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("defaultRole")}
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Group-to-Role Mapping */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t("groupRoleMapping")}
            </label>
            <div className="mt-2 space-y-2">
              {groupMappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={m.group}
                    onChange={(e) => {
                      const next = [...groupMappings];
                      next[i] = { ...next[i], group: e.target.value };
                      setGroupMappings(next);
                    }}
                    placeholder={t("idpGroupName")}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-gray-400">&rarr;</span>
                  <select
                    value={m.role}
                    onChange={(e) => {
                      const next = [...groupMappings];
                      next[i] = { ...next[i], role: e.target.value };
                      setGroupMappings(next);
                    }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeGroupMapping(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={addGroupMapping}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + {t("addMapping")}
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{t("autoProvisionLabel")}</p>
              <p className="text-xs text-gray-500">{t("autoProvisionDesc")}</p>
            </div>
            <Switch
              checked={autoProvision}
              onCheckedChange={setAutoProvision}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3">
            <div>
              <p className="text-sm font-medium">{t("enforceSsoLabel")}</p>
              <p className="text-xs text-gray-500">{t("enforceSsoDesc")}</p>
            </div>
            <Switch
              checked={enforceSSO}
              onCheckedChange={(val) => {
                if (val) {
                  setShowEnforceDialog(true);
                } else {
                  setEnforceSSO(false);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={handleTestLogin}
          disabled={!config}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <ExternalLink className="mr-2 inline h-4 w-4" />
          {t("testLogin")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          ) : null}
          {t("save")}
        </button>
      </div>

      {/* Enforce SSO confirmation dialog */}
      <Dialog open={showEnforceDialog} onOpenChange={setShowEnforceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("enforceSsoDialogTitle")}</DialogTitle>
            <DialogDescription>{t("enforceSsoDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">{t("enforceSsoWarning")}</p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowEnforceDialog(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              {t("cancel")}
            </button>
            <button
              onClick={() => {
                setEnforceSSO(true);
                setShowEnforceDialog(false);
              }}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white"
            >
              {t("confirmEnforce")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
