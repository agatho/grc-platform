"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Users,
  Key,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────

interface ScimTokenData {
  id: string;
  description: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface ScimLogEntry {
  id: string;
  action: string;
  status: string;
  userEmail: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ScimStats {
  lastSync: string | null;
  syncedUsers: number;
  errorCount: number;
  activeTokens: number;
}

export default function ScimDashboardPage() {
  const t = useTranslations("identity");
  const [tokens, setTokens] = useState<ScimTokenData[]>([]);
  const [logs, setLogs] = useState<ScimLogEntry[]>([]);
  const [stats, setStats] = useState<ScimStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Token creation dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [tokenDescription, setTokenDescription] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Revoke dialog
  const [revokeTokenId, setRevokeTokenId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tokensRes, logsRes, statsRes] = await Promise.all([
        fetch("/api/v1/admin/scim/tokens"),
        fetch("/api/v1/admin/scim/logs?limit=50"),
        fetch("/api/v1/admin/scim/stats"),
      ]);
      const tokensJson = await tokensRes.json();
      const logsJson = await logsRes.json();
      const statsJson = await statsRes.json();
      setTokens(tokensJson.data ?? []);
      setLogs(logsJson.data ?? []);
      setStats(statsJson.data ?? null);
    } catch {
      setError(t("scimLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateToken() {
    setError("");
    try {
      const res = await fetch("/api/v1/admin/scim/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: tokenDescription || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCreatedToken(json.data.token);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tokenCreateError"));
    }
  }

  async function handleRevokeToken() {
    if (!revokeTokenId) return;
    setError("");
    try {
      const res = await fetch(`/api/v1/admin/scim/tokens/${revokeTokenId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      setSuccess(t("tokenRevoked"));
      setRevokeTokenId(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tokenRevokeError"));
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "---";
    return new Date(dateStr).toLocaleString();
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return t("never");
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("justNow");
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("scimTitle")}</h1>
        <p className="text-sm text-gray-500">{t("scimDescription")}</p>
      </div>

      {/* Feedback */}
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

      {/* SCIM Endpoint URL */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {t("scimEndpoint")}
            </p>
            <code className="text-xs text-gray-500">
              {baseUrl}/api/v1/scim/v2/
            </code>
          </div>
          <button
            onClick={() => copyToClipboard(`${baseUrl}/api/v1/scim/v2/`)}
            className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </CardContent>
      </Card>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <Clock className="mx-auto h-5 w-5 text-gray-400" />
              <p className="mt-1 text-lg font-semibold">
                {timeAgo(stats.lastSync)}
              </p>
              <p className="text-xs text-gray-500">{t("lastSync")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Users className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1 text-lg font-semibold">{stats.syncedUsers}</p>
              <p className="text-xs text-gray-500">{t("syncedUsers")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <AlertCircle
                className={`mx-auto h-5 w-5 ${stats.errorCount > 0 ? "text-red-500" : "text-gray-400"}`}
              />
              <p
                className={`mt-1 text-lg font-semibold ${stats.errorCount > 0 ? "text-red-600" : ""}`}
              >
                {stats.errorCount}
              </p>
              <p className="text-xs text-gray-500">{t("errors24h")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Key className="mx-auto h-5 w-5 text-green-500" />
              <p className="mt-1 text-lg font-semibold">{stats.activeTokens}</p>
              <p className="text-xs text-gray-500">{t("activeTokens")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Token Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("tokenManagement")}</CardTitle>
            <button
              onClick={() => {
                setTokenDescription("");
                setCreatedToken(null);
                setShowCreateDialog(true);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("generateToken")}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {t("noTokens")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">{t("description")}</th>
                  <th className="pb-2">{t("created")}</th>
                  <th className="pb-2">{t("lastUsed")}</th>
                  <th className="pb-2">{t("status")}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id} className="border-b">
                    <td className="py-2">{token.description || "---"}</td>
                    <td className="py-2">{formatDate(token.createdAt)}</td>
                    <td className="py-2">{formatDate(token.lastUsedAt)}</td>
                    <td className="py-2">
                      {token.isActive ? (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700"
                        >
                          {t("active")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-red-50 text-red-700"
                        >
                          {t("revoked")}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {token.isActive && (
                        <button
                          onClick={() => setRevokeTokenId(token.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          {t("revoke")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("syncLog")}</CardTitle>
            <button
              onClick={fetchData}
              className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            >
              <RefreshCw className="mr-1 inline h-4 w-4" />
              {t("refresh")}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {t("noLogs")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">{t("timestamp")}</th>
                  <th className="pb-2">{t("action")}</th>
                  <th className="pb-2">{t("user")}</th>
                  <th className="pb-2">{t("result")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2">{formatDate(log.createdAt)}</td>
                    <td className="py-2">
                      <Badge variant="outline">{log.action}</Badge>
                    </td>
                    <td className="py-2">{log.userEmail || "---"}</td>
                    <td className="py-2">
                      {log.status === "success" ? (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700"
                        >
                          {t("success")}
                        </Badge>
                      ) : log.status === "error" ? (
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-red-50 text-red-700"
                        >
                          {log.errorMessage ?? t("error")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{log.status}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("generateTokenTitle")}</DialogTitle>
            <DialogDescription>{t("generateTokenDesc")}</DialogDescription>
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-3">
              <div className="rounded-md bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800">
                  {t("tokenOnceWarning")}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-gray-100 p-3 font-mono text-xs">
                <span className="flex-1 break-all">{createdToken}</span>
                <button
                  onClick={() => copyToClipboard(createdToken)}
                  className="shrink-0 rounded border bg-white px-2 py-1 hover:bg-gray-50"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("tokenDescription")}
              </label>
              <input
                type="text"
                value={tokenDescription}
                onChange={(e) => setTokenDescription(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder={t("tokenDescPlaceholder")}
              />
            </div>
          )}
          <DialogFooter>
            {createdToken ? (
              <button
                onClick={() => setShowCreateDialog(false)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
              >
                {t("done")}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleCreateToken}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
                >
                  {t("generate")}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Token Dialog */}
      <Dialog
        open={!!revokeTokenId}
        onOpenChange={() => setRevokeTokenId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeTokenTitle")}</DialogTitle>
            <DialogDescription>{t("revokeTokenDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setRevokeTokenId(null)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleRevokeToken}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white"
            >
              {t("confirmRevoke")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
