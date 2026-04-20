"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ArrowRight,
  Network,
  Building2,
  Eraser,
  AlertCircle,
  Info,
  Anchor,
  Bitcoin,
  Clock,
  Download,
} from "lucide-react";

import { SortableHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface AuditLogEntry {
  id: string;
  orgId: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  action: string;
  actionDetail: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  previousHash: string | null;
  entryHash: string | null;
  previousHashScope: string | null;
  piiTombstonedAt: string | null;
  piiTombstoneReason: string | null;
  createdAt: string;
}

// ADR-011 rev.2 per-tenant integrity endpoint shape
interface IntegrityCheckResult {
  scope: string;
  total: number;
  rowVerified: number;
  chainVerified: number;
  legacyRowCount: number;
  healthy: boolean;
  rowMismatches?: Array<{
    id: string;
    entityType: string;
    action: string;
    createdAt: string;
  }>;
  chainMismatches?: Array<{
    id: string;
    entityType: string;
    action: string;
    createdAt: string;
  }>;
}

type IntegrityState =
  | { kind: "loading" }
  | { kind: "healthy"; data: IntegrityCheckResult }
  | { kind: "unhealthy"; data: IntegrityCheckResult }
  | { kind: "error"; message: string };

interface AuditLogListResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  scope?: {
    orgId: string;
    includeDescendants: boolean;
    resolvedOrgIds: string[];
  };
}

// ADR-011 rev.3 — external anchor status (FreeTSA + OpenTimestamps)
interface AnchorRecord {
  id: string;
  anchorDate: string;
  provider: "freetsa" | "opentimestamps";
  merkleRoot: string;
  leafCount: number;
  proofStatus: "complete" | "pending" | "failed";
  bitcoinBlockHeight: number | null;
  lastError: string | null;
  createdAt: string;
  upgradedAt: string | null;
}

interface AnchorStatusResponse {
  data: AnchorRecord[];
  latest: {
    freetsa: AnchorRecord | null;
    opentimestamps: AnchorRecord | null;
  };
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "restore",
  "status_change",
  "approve",
  "reject",
  "assign",
  "unassign",
  "upload_evidence",
  "delete_evidence",
  "acknowledge",
  "export",
  "bulk_update",
  "comment",
  "link",
  "unlink",
] as const;

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 border-green-200",
  update: "bg-blue-100 text-blue-800 border-blue-200",
  delete: "bg-red-100 text-red-800 border-red-200",
  restore: "bg-purple-100 text-purple-800 border-purple-200",
  status_change: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approve: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reject: "bg-rose-100 text-rose-800 border-rose-200",
  assign: "bg-indigo-100 text-indigo-800 border-indigo-200",
  unassign: "bg-orange-100 text-orange-800 border-orange-200",
  upload_evidence: "bg-teal-100 text-teal-800 border-teal-200",
  delete_evidence: "bg-red-100 text-red-800 border-red-200",
  acknowledge: "bg-cyan-100 text-cyan-800 border-cyan-200",
  export: "bg-slate-100 text-slate-800 border-slate-200",
  bulk_update: "bg-blue-100 text-blue-800 border-blue-200",
  comment: "bg-gray-100 text-gray-800 border-gray-200",
  link: "bg-violet-100 text-violet-800 border-violet-200",
  unlink: "bg-amber-100 text-amber-800 border-amber-200",
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

function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ──────────────────────────────────────────────────────────────
// Integrity Badge Component
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// AnchorBadges — shows the latest FreeTSA + OpenTimestamps anchor
// status and lets admin/auditor trigger one on demand
// ──────────────────────────────────────────────────────────────

function AnchorBadges({
  status,
  t,
  canAnchor,
  onTrigger,
  busy,
  onUpgrade,
  upgradeBusy,
}: {
  status: AnchorStatusResponse | null;
  t: ReturnType<typeof useTranslations>;
  canAnchor: boolean;
  onTrigger: () => void;
  busy: boolean;
  onUpgrade: () => void;
  upgradeBusy: boolean;
}) {
  const freetsa = status?.latest.freetsa;
  const ots = status?.latest.opentimestamps;

  // Show upgrade button when at least one OTS anchor is pending
  const hasPendingOts = !!status?.data.some(
    (a) => a.provider === "opentimestamps" && a.proofStatus === "pending",
  );

  const freetsaBadge = renderAnchorBadge({
    provider: "freetsa",
    anchor: freetsa ?? null,
    icon: <Clock size={12} />,
    t,
  });
  const otsBadge = renderAnchorBadge({
    provider: "opentimestamps",
    anchor: ots ?? null,
    icon: <Bitcoin size={12} />,
    t,
  });

  return (
    <div className="flex items-center gap-2">
      {freetsaBadge}
      {otsBadge}
      {canAnchor && hasPendingOts && (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={upgradeBusy}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-100 disabled:opacity-50"
          title={t("anchorUpgradeHint")}
        >
          {upgradeBusy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Bitcoin size={12} />
          )}
          {t("anchorUpgrade")}
        </button>
      )}
      {canAnchor && (
        <button
          type="button"
          onClick={onTrigger}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-50"
          title={t("anchorNowHint")}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Anchor size={12} />
          )}
          {t("anchorNow")}
        </button>
      )}
    </div>
  );
}

function renderAnchorBadge({
  provider,
  anchor,
  icon,
  t,
}: {
  provider: "freetsa" | "opentimestamps";
  anchor: AnchorRecord | null;
  icon: React.ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  const label = provider === "freetsa" ? "FreeTSA" : "OpenTimestamps";

  if (!anchor) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-gray-200 bg-gray-50 px-2.5 py-1.5 text-gray-500"
      >
        {icon}
        {label}: {t("anchorNever")}
      </Badge>
    );
  }

  const ageMs = Date.now() - new Date(anchor.createdAt).getTime();
  const ageHours = Math.round(ageMs / 3_600_000);
  const ageText =
    ageHours < 1
      ? t("anchorJustNow")
      : ageHours < 24
        ? t("anchorHoursAgo", { h: ageHours })
        : t("anchorDaysAgo", { d: Math.round(ageHours / 24) });

  if (anchor.proofStatus === "failed") {
    return (
      <Badge
        variant="destructive"
        className="gap-1.5 px-2.5 py-1.5"
        title={anchor.lastError ?? undefined}
      >
        {icon}
        {label}: {t("anchorFailed")}
      </Badge>
    );
  }

  if (anchor.proofStatus === "pending") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800"
        title={t("anchorPendingHint")}
      >
        {icon}
        {label}: {t("anchorPending")} · {ageText}
      </Badge>
    );
  }

  // complete
  const blockSuffix = anchor.bitcoinBlockHeight
    ? ` · block ${anchor.bitcoinBlockHeight.toLocaleString()}`
    : "";
  return (
    <Badge
      className="gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800 shadow-none"
      title={`${anchor.leafCount} leaves · root ${anchor.merkleRoot.slice(0, 12)}…${anchor.bitcoinBlockHeight ? ` · Bitcoin block ${anchor.bitcoinBlockHeight}` : ""}`}
    >
      {icon}
      {label}: {t("anchorAnchored")} · {ageText}
      {blockSuffix}
    </Badge>
  );
}

function IntegrityBadge({
  state,
  t,
}: {
  state: IntegrityState;
  t: ReturnType<typeof useTranslations>;
}) {
  if (state.kind === "loading") {
    return (
      <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
        <Loader2 size={14} className="animate-spin" />
        {t("checking")}
      </Badge>
    );
  }

  if (state.kind === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
        <ShieldAlert size={14} />
        {t("integrityCheck")}: {state.message}
      </Badge>
    );
  }

  const { data } = state;
  const brokenRow = data.total - data.rowVerified;
  const brokenChain = data.total - data.chainVerified;

  if (state.kind === "healthy") {
    return (
      <div className="flex items-center gap-2">
        <Badge className="gap-1.5 border-green-200 bg-green-100 px-3 py-1.5 text-green-800 shadow-none">
          <ShieldCheck size={14} />
          {t("chainIntact")}
          <span className="ml-1 text-xs font-normal text-green-600">
            ({data.rowVerified} / {data.total})
          </span>
        </Badge>
        {data.legacyRowCount > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 px-2 py-1 text-amber-700"
            title={t("legacyRowsHint")}
          >
            <Info size={11} />
            {data.legacyRowCount} {t("legacyRows")}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
        <ShieldAlert size={14} />
        {t("chainBroken")}
        <span className="ml-1 text-xs font-normal">
          ({brokenRow}/{data.total} {t("rowBreaks")}, {brokenChain}/{data.total}{" "}
          {t("chainBreaks")})
        </span>
      </Badge>
      {data.legacyRowCount > 0 && (
        <Badge
          variant="outline"
          className="gap-1 border-amber-200 bg-amber-50 px-2 py-1 text-amber-700"
        >
          <Info size={11} />
          {data.legacyRowCount} {t("legacyRows")}
        </Badge>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Change Detail Dialog
// ──────────────────────────────────────────────────────────────

const TOMBSTONE_REASONS = [
  "gdpr_art_17",
  "person_deceased",
  "contract_end",
  "legal_hold_expired",
  "data_minimisation",
] as const;

function ChangeDetailDialog({
  entry,
  open,
  onOpenChange,
  t,
  canTombstone,
  onTombstoned,
}: {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: ReturnType<typeof useTranslations>;
  canTombstone: boolean;
  onTombstoned: () => void;
}) {
  const [tombstoneOpen, setTombstoneOpen] = useState(false);
  const [tombstoneReason, setTombstoneReason] = useState<string>("gdpr_art_17");
  const [tombstoneBusy, setTombstoneBusy] = useState(false);
  const [tombstoneError, setTombstoneError] = useState<string | null>(null);

  if (!entry) return null;

  const changes = entry.changes;
  const hasChanges =
    changes && typeof changes === "object" && Object.keys(changes).length > 0;
  const isTombstoned = !!entry.piiTombstonedAt;

  async function handleTombstone() {
    if (!entry) return;
    setTombstoneBusy(true);
    setTombstoneError(null);
    try {
      const res = await fetch("/api/v1/dpms/audit-log-tombstone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogId: entry.id, reason: tombstoneReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setTombstoneOpen(false);
      onTombstoned();
      onOpenChange(false);
    } catch (e) {
      setTombstoneError(e instanceof Error ? e.message : String(e));
    } finally {
      setTombstoneBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("changeDetail")}
            {isTombstoned && (
              <Badge
                variant="outline"
                className="gap-1 border-purple-200 bg-purple-50 text-purple-700"
              >
                <Eraser size={11} />
                {t("tombstoned")}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {entry.entityType} &mdash; {entry.entityTitle ?? entry.entityId}
          </DialogDescription>
        </DialogHeader>

        {/* Change diff table */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            {t("changes")}
          </h4>
          {hasChanges ? (
            <div className="rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("fieldName")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("oldValue")}
                    </th>
                    <th className="w-6 px-1 py-2" />
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t("newValue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(changes).map(([field, diff]) => {
                    const d = diff as { old?: unknown; new?: unknown };
                    return (
                      <tr
                        key={field}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">
                          {field}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700">
                            {displayValue(d.old)}
                          </span>
                        </td>
                        <td className="px-1 py-2 text-center text-gray-400">
                          <ArrowRight size={12} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">
                            {displayValue(d.new)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("noChanges")}</p>
          )}

          {/* Metadata section */}
          <h4 className="text-sm font-semibold text-gray-700">
            {t("metadata")}
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{t("ipAddress")}</dt>
            <dd className="font-mono text-xs text-gray-700">
              {entry.ipAddress ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("userAgent")}</dt>
            <dd className="max-w-sm truncate font-mono text-xs text-gray-700">
              {entry.userAgent ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("sessionId")}</dt>
            <dd className="font-mono text-xs text-gray-700">
              {entry.sessionId ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("hash")}</dt>
            <dd className="font-mono text-xs text-gray-700">
              {entry.entryHash ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("previousHash")}</dt>
            <dd className="font-mono text-xs text-gray-700">
              {entry.previousHash ?? "-"}
            </dd>

            <dt className="text-gray-500">{t("scope")}</dt>
            <dd className="font-mono text-xs text-gray-700">
              {entry.previousHashScope ?? t("legacy")}
            </dd>

            {isTombstoned && (
              <>
                <dt className="text-gray-500">{t("tombstonedAt")}</dt>
                <dd className="font-mono text-xs text-purple-700">
                  {formatTimestamp(entry.piiTombstonedAt!)}
                </dd>

                <dt className="text-gray-500">{t("tombstoneReason")}</dt>
                <dd className="font-mono text-xs text-purple-700">
                  {entry.piiTombstoneReason ?? "-"}
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* DPO tombstone action */}
        {canTombstone && !isTombstoned && (
          <DialogFooter className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setTombstoneOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:border-purple-300 hover:bg-purple-100"
            >
              <Eraser size={12} />
              {t("tombstoneAction")}
            </button>
          </DialogFooter>
        )}

        {/* Tombstone confirmation dialog */}
        <Dialog open={tombstoneOpen} onOpenChange={setTombstoneOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-purple-900">
                <Eraser size={18} />
                {t("tombstoneTitle")}
              </DialogTitle>
              <DialogDescription>{t("tombstoneDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                {t("tombstoneReasonLabel")}
              </label>
              <Select
                value={tombstoneReason}
                onValueChange={setTombstoneReason}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOMBSTONE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`tombstoneReasons.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {tombstoneError && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{tombstoneError}</span>
                </div>
              )}

              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {t("tombstoneWarning")}
              </p>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setTombstoneOpen(false)}
                disabled={tombstoneBusy}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleTombstone}
                disabled={tombstoneBusy}
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-800 disabled:opacity-50"
              >
                {tombstoneBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Eraser size={12} />
                )}
                {t("tombstoneConfirm")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const t = useTranslations("auditLog");
  const { data: session } = useSession();

  // Data state
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrity, setIntegrity] = useState<IntegrityState>({
    kind: "loading",
  });

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>("__all__");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("__all__");
  const [includeDescendants, setIncludeDescendants] = useState(false);

  // Response scope
  const [scope, setScope] = useState<AuditLogListResponse["scope"] | null>(
    null,
  );

  // Dialog state
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Derive capabilities from session roles scoped to current org
  const currentOrgId =
    session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId;
  const currentOrgRoles = useMemo(
    () =>
      (session?.user?.roles ?? [])
        .filter((r) => r.orgId === currentOrgId)
        .map((r) => r.role),
    [session?.user?.roles, currentOrgId],
  );
  const canIncludeDescendants =
    currentOrgRoles.includes("admin") || currentOrgRoles.includes("auditor");
  const canTombstone =
    currentOrgRoles.includes("admin") || currentOrgRoles.includes("dpo");
  const canAnchor =
    currentOrgRoles.includes("admin") || currentOrgRoles.includes("auditor");

  // Anchor state
  const [anchorStatus, setAnchorStatus] = useState<AnchorStatusResponse | null>(
    null,
  );
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  // Archive download state
  const [archiveBusy, setArchiveBusy] = useState(false);

  // Derive unique entity types from data
  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      set.add(e.entityType);
    }
    return Array.from(set).sort();
  }, [entries]);

  // Fetch audit log entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (actionFilter !== "__all__") params.set("action", actionFilter);
      if (entityTypeFilter !== "__all__")
        params.set("entity_type", entityTypeFilter);
      if (includeDescendants && canIncludeDescendants) {
        params.set("includeDescendants", "true");
      }

      const res = await fetch(`/api/v1/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AuditLogListResponse;
      setEntries(json.data);
      setScope(json.scope ?? null);
    } catch {
      setEntries([]);
      setScope(null);
    } finally {
      setLoading(false);
    }
  }, [
    actionFilter,
    entityTypeFilter,
    includeDescendants,
    canIncludeDescendants,
  ]);

  // Fetch integrity check — ADR-011 rev.2 per-tenant endpoint
  const fetchIntegrity = useCallback(async () => {
    setIntegrity({ kind: "loading" });
    try {
      // 503 means "chain broken" — the body is still valid JSON, we read it
      const res = await fetch("/api/v1/audit-log/integrity");
      if (res.status !== 200 && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: IntegrityCheckResult };
      setIntegrity(
        json.data.healthy
          ? { kind: "healthy", data: json.data }
          : { kind: "unhealthy", data: json.data },
      );
    } catch (err) {
      setIntegrity({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  // Fetch anchor status (ADR-011 rev.3)
  const fetchAnchorStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/audit-log/anchor");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAnchorStatus((await res.json()) as AnchorStatusResponse);
    } catch {
      setAnchorStatus(null);
    }
  }, []);

  async function triggerAnchor() {
    setAnchorBusy(true);
    setAnchorError(null);
    try {
      const res = await fetch("/api/v1/audit-log/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchAnchorStatus();
      await fetchIntegrity();
    } catch (e) {
      setAnchorError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnchorBusy(false);
    }
  }

  async function triggerUpgrade() {
    setUpgradeBusy(true);
    setAnchorError(null);
    try {
      const res = await fetch("/api/v1/audit-log/anchor/upgrade", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchAnchorStatus();
    } catch (e) {
      setAnchorError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpgradeBusy(false);
    }
  }

  async function downloadArchive() {
    setArchiveBusy(true);
    setAnchorError(null);
    try {
      // Last-30-days window by default. A future iteration can add a
      // custom date picker; for now this covers most audit-prep needs.
      const res = await fetch("/api/v1/audit-log/archive");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Extract filename from Content-Disposition if present
      const disp = res.headers.get("content-disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(disp);
      const filename = m ? m[1] : "arctos-audit-archive.zip";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setAnchorError(e instanceof Error ? e.message : String(e));
    } finally {
      setArchiveBusy(false);
    }
  }

  useEffect(() => {
    void fetchIntegrity();
  }, [fetchIntegrity]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    void fetchAnchorStatus();
  }, [fetchAnchorStatus]);

  // Table columns
  const columns = useMemo<ColumnDef<AuditLogEntry, unknown>[]>(
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
        accessorKey: "userName",
        header: t("user"),
        cell: ({ row }) => {
          const name = row.original.userName;
          const email = row.original.userEmail;
          return (
            <div className="min-w-[120px]">
              <div className="text-sm font-medium text-gray-900">
                {name ?? "-"}
              </div>
              {email && <div className="text-xs text-gray-500">{email}</div>}
            </div>
          );
        },
      },
      {
        accessorKey: "action",
        header: t("action"),
        cell: ({ getValue }) => {
          const action = getValue() as string;
          const colorClass =
            ACTION_COLORS[action] ??
            "bg-gray-100 text-gray-800 border-gray-200";
          return (
            <Badge
              variant="outline"
              className={`${colorClass} text-xs font-medium`}
            >
              {action.replace(/_/g, " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "entityType",
        header: t("entityType"),
        cell: ({ getValue, row }) => (
          <span className="font-mono text-xs text-gray-600 inline-flex items-center gap-1">
            {getValue() as string}
            {row.original.piiTombstonedAt && (
              <span
                title={t("tombstonedHint")}
                className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium text-purple-700"
              >
                <Eraser size={9} className="mr-0.5" />
                {t("tombstonedShort")}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "entityTitle",
        header: t("entityTitle"),
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return (
            <span className="max-w-[200px] truncate text-sm text-gray-700">
              {val ?? "-"}
            </span>
          );
        },
      },
      {
        accessorKey: "changes",
        header: t("changes"),
        enableSorting: false,
        cell: ({ row }) => {
          const changes = row.original.changes;
          if (!changes || typeof changes !== "object") {
            return <span className="text-xs text-gray-400">-</span>;
          }
          const fieldCount = Object.keys(changes).length;
          return (
            <button
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntry(row.original);
                setDialogOpen(true);
              }}
            >
              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
            </button>
          );
        },
      },
    ],
    [t],
  );

  // Row click handler
  const handleRowClick = useCallback((entry: AuditLogEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  }, []);

  // Custom toolbar with filter dropdowns
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={actionFilter} onValueChange={setActionFilter}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder={t("allActions")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t("allActions")}</SelectItem>
          {AUDIT_ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder={t("allEntityTypes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t("allEntityTypes")}</SelectItem>
          {entityTypes.map((et) => (
            <SelectItem key={et} value={et}>
              {et}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canIncludeDescendants && (
        <label
          className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
            includeDescendants
              ? "border-blue-300 bg-blue-50 text-blue-800"
              : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/40"
          }`}
          title={t("includeDescendantsHint")}
        >
          <input
            type="checkbox"
            checked={includeDescendants}
            onChange={(e) => setIncludeDescendants(e.target.checked)}
            className="h-3 w-3 rounded border-gray-300 text-blue-600"
          />
          <Network size={12} />
          {t("includeDescendants")}
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <IntegrityBadge state={integrity} t={t} />
          <AnchorBadges
            status={anchorStatus}
            t={t}
            canAnchor={canAnchor}
            onTrigger={triggerAnchor}
            busy={anchorBusy}
            onUpgrade={triggerUpgrade}
            upgradeBusy={upgradeBusy}
          />
          {canAnchor && (
            <button
              type="button"
              onClick={downloadArchive}
              disabled={archiveBusy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
              title={t("archiveDownloadHint")}
            >
              {archiveBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {t("archiveDownload")}
            </button>
          )}
        </div>
      </div>

      {anchorError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{anchorError}</span>
        </div>
      )}

      {/* Scope banner — visible when descendants are included */}
      {scope && scope.includeDescendants && scope.resolvedOrgIds.length > 1 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <Building2 size={16} className="mt-0.5 shrink-0 text-blue-700" />
          <div className="flex-1">
            <div className="font-semibold">
              {t("scopeBannerTitle", { count: scope.resolvedOrgIds.length })}
            </div>
            <div className="text-xs text-blue-800/80">
              {t("scopeBannerBody")}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <AuditLogTable
          data={entries}
          columns={columns}
          toolbar={toolbar}
          searchPlaceholder={t("searchEntity")}
          onRowClick={handleRowClick}
        />
      )}

      {/* Detail dialog */}
      <ChangeDetailDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        t={t}
        canTombstone={canTombstone}
        onTombstoned={() => {
          void fetchEntries();
          void fetchIntegrity();
        }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Audit Log Table wrapper (adds row click)
// ──────────────────────────────────────────────────────────────

function AuditLogTable({
  data,
  columns,
  toolbar,
  searchPlaceholder,
  onRowClick,
}: {
  data: AuditLogEntry[];
  columns: ColumnDef<AuditLogEntry, unknown>[];
  toolbar: React.ReactNode;
  searchPlaceholder: string;
  onRowClick: (entry: AuditLogEntry) => void;
}) {
  // We render DataTable but wrap rows with click handlers via a wrapper
  // DataTable does not natively support row click, so we wrap it and
  // add a click listener at the table container level
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const row = target.closest("tbody tr[data-row-index]");
        if (!row) return;
        const idx = Number(row.getAttribute("data-row-index"));
        if (!Number.isNaN(idx) && data[idx]) {
          onRowClick(data[idx]);
        }
      }}
    >
      <DataTableWithRowIndex
        data={data}
        columns={columns}
        toolbar={toolbar}
        searchKey="entityTitle"
        searchPlaceholder={searchPlaceholder}
        pageSize={15}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DataTable variant that marks rows with data-row-index
// ──────────────────────────────────────────────────────────────

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function DataTableWithRowIndex<TData>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Filter...",
  pageSize = 10,
  toolbar,
}: {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {searchKey && (
          <input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
            }
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="rounded-md border border-gray-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-row-index={row.index}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-500"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{table.getFilteredRowModel().rows.length} row(s)</span>
        <div className="flex items-center gap-2">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
