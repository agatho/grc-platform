"use client";

// Risk-Acceptance Review Cockpit (ISO 27005 Clause 10).
//
// Org-wide list of all formal acceptance decisions with status filter,
// "expiring soon" toggle (validUntil within 30 days) and server-side
// pagination via GET /api/v1/risk-acceptances. The detail dialog loads
// the full record (incl. revoker identity), offers the revoke action
// (mandatory reason) and the limited edit (conditions / validUntil /
// tags — only while status is active).

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ShieldCheck,
  Loader2,
  RefreshCcw,
  CalendarClock,
  AlertTriangle,
  Eye,
  Undo2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { RiskScoreBadge } from "@/components/risk/risk-score-badge";
import { RiskAcceptanceStatusBadge } from "@/components/risk/risk-acceptance-status-badge";
import { useDateFormat } from "@/lib/format-date";
import {
  acceptanceExpiryState,
  buildAcceptanceListQuery,
  daysUntil,
  truncateText,
} from "@/lib/risk-acceptance-ui";
import { RISK_ACCEPTANCE_STATUSES } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types (see GET /api/v1/risk-acceptances + /[id])
// ---------------------------------------------------------------------------

interface AcceptanceListRow {
  id: string;
  riskId: string;
  riskTitle: string | null;
  status: string;
  acceptedAt: string;
  acceptedBy: string;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  riskScoreAtAcceptance: number;
  riskLevelAtAcceptance: string;
  validUntil: string | null;
  acceptanceConditions: string | null;
  justification: string;
  revokedAt: string | null;
  tags: string[];
}

interface AcceptanceDetail extends AcceptanceListRow {
  riskStatus?: string | null;
  revokedBy: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RiskAcceptancesPage() {
  return (
    <ModuleGate moduleKey="erm">
      <ModuleTabNav />
      <RiskAcceptancesInner />
    </ModuleGate>
  );
}

function RiskAcceptancesInner() {
  const t = useTranslations("risk.acceptance");
  const { formatDate, formatDateTime } = useDateFormat();

  // List state
  const [rows, setRows] = useState<AcceptanceListRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Detail dialog
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AcceptanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    acceptanceConditions: "",
    validUntil: "",
    tags: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Revoke dialog
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const qs = buildAcceptanceListQuery({
        page,
        limit: PAGE_SIZE,
        status:
          statusFilter === "__all__"
            ? undefined
            : (statusFilter as (typeof RISK_ACCEPTANCE_STATUSES)[number]),
        expiringOnly,
      });
      const res = await fetch(`/api/v1/risk-acceptances?${qs}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setRows(json.data ?? []);
      if (json.pagination) setPagination(json.pagination);
    } catch {
      setLoadError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, expiringOnly]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/v1/risk-acceptances/${id}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setDetail(json.data ?? null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (detailId) void fetchDetail(detailId);
  }, [detailId, fetchDetail]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openEdit() {
    if (!detail) return;
    setEditForm({
      acceptanceConditions: detail.acceptanceConditions ?? "",
      validUntil: detail.validUntil ?? "",
      tags: detail.tags ?? [],
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!detail) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/v1/risk-acceptances/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptanceConditions: editForm.acceptanceConditions.trim() || null,
          validUntil: editForm.validUntil || null,
          tags: editForm.tags,
        }),
      });
      if (res.ok) {
        toast.success(t("edit.success"));
        setEditOpen(false);
        await Promise.all([fetchDetail(detail.id), fetchList()]);
        return;
      }
      const body: unknown = await res.json().catch(() => ({}));
      const message =
        typeof (body as Record<string, unknown>).error === "string"
          ? String((body as Record<string, unknown>).error)
          : t("edit.error");
      setEditError(message);
    } catch {
      setEditError(t("edit.error"));
    } finally {
      setSaving(false);
    }
  }

  async function submitRevoke() {
    if (!detail) return;
    if (revokeReason.trim().length < 10) {
      setRevokeError(t("revoke.reasonTooShort"));
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch(
        `/api/v1/risks/${detail.riskId}/acceptance/${detail.id}/revoke`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: revokeReason.trim() }),
        },
      );
      if (res.ok) {
        toast.success(t("revoke.success"));
        setRevokeOpen(false);
        setRevokeReason("");
        await Promise.all([fetchDetail(detail.id), fetchList()]);
        return;
      }
      const body: unknown = await res.json().catch(() => ({}));
      const message =
        typeof (body as Record<string, unknown>).error === "string"
          ? String((body as Record<string, unknown>).error)
          : t("revoke.error");
      setRevokeError(message);
    } catch {
      setRevokeError(t("revoke.error"));
    } finally {
      setRevoking(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Cells
  // ---------------------------------------------------------------------------

  function validUntilCell(row: { validUntil: string | null; status: string }) {
    if (!row.validUntil) {
      return (
        <span className="text-sm text-gray-400">{t("expiry.unlimited")}</span>
      );
    }
    const state =
      row.status === "active" ? acceptanceExpiryState(row.validUntil) : "none";
    const days = daysUntil(row.validUntil);
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-sm ${
            state === "expired"
              ? "text-red-600 font-semibold"
              : state === "expiringSoon"
                ? "text-amber-700 font-medium"
                : "text-gray-700"
          }`}
        >
          {formatDate(row.validUntil)}
        </span>
        {state === "expiringSoon" && days !== null && (
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-900 border-amber-200 text-[10px]"
          >
            <CalendarClock size={10} className="mr-1" />
            {days === 0
              ? t("expiry.expiresToday")
              : t("expiry.expiresInDays", { days })}
          </Badge>
        )}
        {state === "expired" && (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-900 border-red-200 text-[10px]"
          >
            {t("expiry.expired")}
          </Badge>
        )}
      </span>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && rows.length === 0 && !loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-green-700" />
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("subtitle")}
            {pagination.total > 0 && (
              <span>
                {" "}
                — {t("pagination.total", { total: pagination.total })}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchList()}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("columns.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("filter.allStatuses")}</SelectItem>
            {RISK_ACCEPTANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => {
            setExpiringOnly((v) => !v);
            setPage(1);
          }}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            expiringOnly
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CalendarClock size={12} />
          {t("filter.expiringSoonOnly")}
        </button>
      </div>

      {/* ── Error state ────────────────────────────────────────── */}
      {loadError && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <AlertTriangle size={28} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void fetchList()}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      {!loadError && (
        <>
          {rows.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Search size={28} className="text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {t("empty.title")}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t("empty.hint")}</p>
            </div>
          ) : (
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.risk")}</TableHead>
                    <TableHead>{t("columns.score")}</TableHead>
                    <TableHead>{t("columns.acceptedBy")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.validUntil")}</TableHead>
                    <TableHead>{t("columns.justification")}</TableHead>
                    <TableHead className="w-[60px]">
                      <span className="sr-only">{t("columns.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/risks/${row.riskId}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {row.riskTitle ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <RiskScoreBadge
                          score={row.riskScoreAtAcceptance}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm text-gray-700">
                          <User size={13} className="text-gray-400" />
                          {row.acceptedByName ?? row.acceptedByEmail ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RiskAcceptanceStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{validUntilCell(row)}</TableCell>
                      <TableCell>
                        <span
                          className="text-sm text-gray-600"
                          title={row.justification}
                        >
                          {truncateText(row.justification, 90)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailId(row.id)}
                          aria-label={t("details")}
                        >
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Pagination ─────────────────────────────────────── */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-gray-500">
                {t("pagination.pageOf", {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={14} />
                {t("pagination.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page >= pagination.totalPages || loading}
              >
                {t("pagination.next")}
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Detail dialog ──────────────────────────────────────── */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("detail.title")}</DialogTitle>
            {detail && (
              <DialogDescription>
                {t("detail.acceptedAt")}: {formatDateTime(detail.acceptedAt)}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          )}

          {!detailLoading && !detail && (
            <p className="text-sm text-gray-500 py-6 text-center">
              {t("detail.loadError")}
            </p>
          )}

          {!detailLoading && detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <RiskAcceptanceStatusBadge status={detail.status} />
                <RiskScoreBadge score={detail.riskScoreAtAcceptance} />
                <Link
                  href={`/risks/${detail.riskId}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {detail.riskTitle ?? t("detail.openRisk")}
                </Link>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    {t("detail.acceptedBy")}
                  </dt>
                  <dd className="text-gray-800">
                    {detail.acceptedByName ?? detail.acceptedByEmail ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    {t("detail.validUntil")}
                  </dt>
                  <dd>{validUntilCell(detail)}</dd>
                </div>
                {detail.status === "revoked" && (
                  <>
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        {t("detail.revokedBy")}
                      </dt>
                      <dd className="text-gray-800">
                        {detail.revokedByName ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-gray-500">
                        {t("detail.revokedAt")}
                      </dt>
                      <dd className="text-gray-800">
                        {detail.revokedAt
                          ? formatDateTime(detail.revokedAt)
                          : "—"}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">
                  {t("detail.justification")}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {detail.justification}
                </p>
              </div>

              {detail.acceptanceConditions && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    {t("detail.conditions")}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {detail.acceptanceConditions}
                  </p>
                </div>
              )}

              {detail.status === "revoked" && detail.revokeReason && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs font-medium text-red-800">
                    {t("detail.revokeReason")}
                  </p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap mt-0.5">
                    {detail.revokeReason}
                  </p>
                </div>
              )}

              {detail.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {detail.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {!detailLoading && detail && detail.status === "active" && (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil size={14} />
                {t("edit.action")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setRevokeReason("");
                  setRevokeError(null);
                  setRevokeOpen(true);
                }}
              >
                <Undo2 size={14} />
                {t("revoke.action")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog (active only: conditions / validUntil / tags) ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("edit.title")}</DialogTitle>
            <DialogDescription>{t("edit.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-conditions">{t("edit.conditions")}</Label>
              <Textarea
                id="edit-conditions"
                rows={3}
                value={editForm.acceptanceConditions}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    acceptanceConditions: e.target.value,
                  }))
                }
                placeholder={t("edit.conditionsPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-valid-until">{t("edit.validUntil")}</Label>
              <Input
                id="edit-valid-until"
                type="date"
                value={editForm.validUntil}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, validUntil: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("edit.tags")}</Label>
              <TagInput
                value={editForm.tags}
                onChange={(tags) => setEditForm((f) => ({ ...f, tags }))}
                maxTags={20}
              />
            </div>
            {editError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="text-red-600 mt-0.5 shrink-0"
                />
                <p className="text-sm text-red-700">{editError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              {t("edit.cancel")}
            </Button>
            <Button onClick={() => void submitEdit()} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t("edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke dialog ──────────────────────────────────────── */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("revoke.title")}</DialogTitle>
            <DialogDescription>{t("revoke.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cockpit-revoke-reason">
                {t("revoke.reasonLabel")}
              </Label>
              <Textarea
                id="cockpit-revoke-reason"
                rows={4}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder={t("revoke.reasonPlaceholder")}
              />
            </div>
            {revokeError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="text-red-600 mt-0.5 shrink-0"
                />
                <p className="text-sm text-red-700">{revokeError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeOpen(false)}
              disabled={revoking}
            >
              {t("revoke.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitRevoke()}
              disabled={revoking}
            >
              {revoking && <Loader2 size={14} className="animate-spin" />}
              {t("revoke.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
