"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface AccessLogEntry {
  id: string;
  userId: string | null;
  emailAttempted: string | null;
  eventType: string;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  geoLocation: string | null;
  failureReason: string | null;
  sessionId: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const ACCESS_EVENT_TYPES = [
  "login_success",
  "login_failed",
  "logout",
  "token_refresh",
  "password_change",
  "mfa_challenge",
  "mfa_success",
  "mfa_failed",
  "account_locked",
  "sso_login",
  "api_key_used",
  "session_expired",
] as const;

const EVENT_TYPE_COLORS: Record<string, string> = {
  login_success: "bg-green-100 text-green-800 border-green-200",
  login_failed: "bg-red-100 text-red-800 border-red-200",
  logout: "bg-gray-100 text-gray-600 border-gray-200",
  token_refresh: "bg-slate-100 text-slate-700 border-slate-200",
  password_change: "bg-yellow-100 text-yellow-800 border-yellow-200",
  mfa_challenge: "bg-blue-100 text-blue-800 border-blue-200",
  mfa_success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  mfa_failed: "bg-rose-100 text-rose-800 border-rose-200",
  account_locked: "bg-red-200 text-red-900 border-red-300",
  sso_login: "bg-indigo-100 text-indigo-800 border-indigo-200",
  api_key_used: "bg-purple-100 text-purple-800 border-purple-200",
  session_expired: "bg-orange-100 text-orange-800 border-orange-200",
};

const AUTH_METHOD_LABELS: Record<string, string> = {
  password: "Password",
  sso_azure_ad: "Azure AD SSO",
  sso_oidc: "OIDC SSO",
  api_key: "API Key",
  mfa_totp: "MFA (TOTP)",
  mfa_webauthn: "MFA (WebAuthn)",
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function AccessLogPage() {
  const t = useTranslations("accessLog");

  const [entries, setEntries] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("__all__");

  // Fetch access log entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (eventTypeFilter !== "__all__")
        params.set("event_type", eventTypeFilter);

      const res = await fetch(`/api/v1/access-log?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: AccessLogEntry[] };
      setEntries(json.data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // Table columns
  const columns = useMemo<ColumnDef<AccessLogEntry, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("timestamp")}</SortableHeader>
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-gray-600">
            {formatTimestamp(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "emailAttempted",
        header: t("email"),
        cell: ({ getValue }) => {
          const email = getValue() as string | null;
          return <span className="text-sm text-gray-700">{email ?? "-"}</span>;
        },
      },
      {
        accessorKey: "eventType",
        header: t("eventType"),
        cell: ({ getValue }) => {
          const eventType = getValue() as string;
          const colorClass =
            EVENT_TYPE_COLORS[eventType] ??
            "bg-gray-100 text-gray-800 border-gray-200";
          return (
            <Badge
              variant="outline"
              className={`${colorClass} text-xs font-medium`}
            >
              {eventType.replace(/_/g, " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "authMethod",
        header: t("authMethod"),
        cell: ({ getValue }) => {
          const method = getValue() as string | null;
          if (!method) return <span className="text-xs text-gray-400">-</span>;
          return (
            <span className="text-xs text-gray-600">
              {AUTH_METHOD_LABELS[method] ?? method}
            </span>
          );
        },
      },
      {
        accessorKey: "ipAddress",
        header: t("ipAddress"),
        cell: ({ getValue }) => {
          const ip = getValue() as string | null;
          return (
            <span className="font-mono text-xs text-gray-600">{ip ?? "-"}</span>
          );
        },
      },
      {
        accessorKey: "failureReason",
        header: t("failureReason"),
        cell: ({ getValue }) => {
          const reason = getValue() as string | null;
          if (!reason) return <span className="text-xs text-gray-400">-</span>;
          return (
            <span className="text-xs font-medium text-red-600">{reason}</span>
          );
        },
      },
    ],
    [t],
  );

  // Toolbar with event type filter
  const toolbar = (
    <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder={t("allEventTypes")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{t("allEventTypes")}</SelectItem>
        {ACCESS_EVENT_TYPES.map((et) => (
          <SelectItem key={et} value={et}>
            {et.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <DataTable
          data={entries}
          columns={columns}
          toolbar={toolbar}
          searchKey="emailAttempted"
          searchPlaceholder={t("email") + "..."}
          pageSize={15}
        />
      )}
    </div>
  );
}
