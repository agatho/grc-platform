"use client";

// Risk-detail "Risikoakzeptanz" tab (ISO 27005 Clause 10).
//
// Shows the acceptance history for one risk, highlights the active
// acceptance (with revoke action) and offers the formal accept dialog.
// Server-side governance errors (four-eyes 422, authority-band 403,
// already-accepted 409, unscored 422) are mapped to i18n messages via
// mapAcceptanceApiError.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CalendarClock,
  Undo2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { RiskScoreBadge } from "@/components/risk/risk-score-badge";
import { RiskAcceptanceStatusBadge } from "@/components/risk/risk-acceptance-status-badge";
import { useDateFormat } from "@/lib/format-date";
import {
  acceptanceExpiryState,
  daysUntil,
  mapAcceptanceApiError,
} from "@/lib/risk-acceptance-ui";

// ---------------------------------------------------------------------------
// Types (shape of GET /api/v1/risks/:id/acceptance rows, enriched with
// acceptor identity from the joined org-wide list endpoint)
// ---------------------------------------------------------------------------

interface AcceptanceRecord {
  id: string;
  riskId: string;
  status: string;
  acceptedAt: string;
  acceptedBy: string;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
  riskScoreAtAcceptance: number;
  riskLevelAtAcceptance: string;
  justification: string;
  acceptanceConditions?: string | null;
  validUntil?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: string | null;
  tags: string[];
}

interface JoinedListRow {
  id: string;
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
}

interface RiskAcceptancePanelProps {
  riskId: string;
  /** Called after accept/revoke so the parent can refetch the risk
   *  (the risk status flips to accepted / back to identified). */
  onChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskAcceptancePanel({
  riskId,
  onChanged,
}: RiskAcceptancePanelProps) {
  const t = useTranslations("risk.acceptance");
  const { formatDate, formatDateTime } = useDateFormat();

  const [records, setRecords] = useState<AcceptanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Accept dialog
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptForm, setAcceptForm] = useState({
    justification: "",
    acceptanceConditions: "",
    validUntil: "",
    tags: [] as string[],
  });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<AcceptanceRecord | null>(
    null,
  );
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // Per-risk history (full rows incl. revokeReason) + org-wide list
      // (joined acceptor identity) — merged by id.
      const [historyRes, joinedRes] = await Promise.all([
        fetch(`/api/v1/risks/${riskId}/acceptance`),
        fetch(
          `/api/v1/risk-acceptances?riskId=${riskId}&limit=100&sort=acceptedAt&sortDir=desc`,
        ),
      ]);
      if (!historyRes.ok) throw new Error("Failed");
      const historyJson = await historyRes.json();
      const rows: AcceptanceRecord[] = historyJson.data ?? [];

      if (joinedRes.ok) {
        const joinedJson = await joinedRes.json();
        const byId = new Map<string, JoinedListRow>(
          ((joinedJson.data ?? []) as JoinedListRow[]).map((r) => [r.id, r]),
        );
        for (const row of rows) {
          const joined = byId.get(row.id);
          if (joined) {
            row.acceptedByName = joined.acceptedByName;
            row.acceptedByEmail = joined.acceptedByEmail;
          }
        }
      }
      setRecords(rows);
    } catch {
      setLoadError(true);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [riskId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const active = useMemo(
    () => records.find((r) => r.status === "active") ?? null,
    [records],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function submitAccept() {
    if (acceptForm.justification.trim().length < 10) {
      setAcceptError(t("accept.justificationTooShort"));
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/v1/risks/${riskId}/acceptance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          justification: acceptForm.justification.trim(),
          acceptanceConditions:
            acceptForm.acceptanceConditions.trim() || undefined,
          validUntil: acceptForm.validUntil || undefined,
          tags: acceptForm.tags.length > 0 ? acceptForm.tags : undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("accept.success"));
        setAcceptOpen(false);
        setAcceptForm({
          justification: "",
          acceptanceConditions: "",
          validUntil: "",
          tags: [],
        });
        await fetchHistory();
        onChanged?.();
        return;
      }
      const body: unknown = await res.json().catch(() => ({}));
      const mapped = mapAcceptanceApiError(res.status, body);
      setAcceptError(
        mapped.key === "generic" && mapped.serverMessage
          ? mapped.serverMessage
          : t(`errors.${mapped.key}`, mapped.params),
      );
    } catch {
      setAcceptError(t("errors.generic"));
    } finally {
      setAccepting(false);
    }
  }

  async function submitRevoke() {
    if (!revokeTarget) return;
    if (revokeReason.trim().length < 10) {
      setRevokeError(t("revoke.reasonTooShort"));
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch(
        `/api/v1/risks/${riskId}/acceptance/${revokeTarget.id}/revoke`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: revokeReason.trim() }),
        },
      );
      if (res.ok) {
        toast.success(t("revoke.success"));
        setRevokeTarget(null);
        setRevokeReason("");
        await fetchHistory();
        onChanged?.();
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
  // Render helpers
  // ---------------------------------------------------------------------------

  function acceptorLabel(r: AcceptanceRecord): string {
    return r.acceptedByName ?? r.acceptedByEmail ?? "—";
  }

  function validUntilCell(r: AcceptanceRecord) {
    if (!r.validUntil) {
      return <span className="text-gray-400">{t("expiry.unlimited")}</span>;
    }
    const state =
      r.status === "active" ? acceptanceExpiryState(r.validUntil) : "none";
    const days = daysUntil(r.validUntil);
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span
          className={
            state === "expired"
              ? "text-red-600 font-semibold"
              : state === "expiringSoon"
                ? "text-amber-700 font-medium"
                : "text-gray-700"
          }
        >
          {formatDate(r.validUntil)}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <AlertTriangle size={28} className="mb-2" />
        <p className="text-sm">{t("loadError")}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void fetchHistory()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Active acceptance / accept CTA ─────────────────────── */}
      {active ? (
        <Card className="border-green-300 bg-green-50/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck size={16} className="text-green-700" />
                  {t("history.activeTitle")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t("detail.acceptedAt")}: {formatDateTime(active.acceptedAt)}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => {
                  setRevokeReason("");
                  setRevokeError(null);
                  setRevokeTarget(active);
                }}
              >
                <Undo2 size={14} />
                {t("revoke.action")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <RiskScoreBadge score={active.riskScoreAtAcceptance} />
              <RiskAcceptanceStatusBadge status={active.status} />
              <span className="flex items-center gap-1 text-gray-600">
                <User size={13} />
                {acceptorLabel(active)}
              </span>
              <span className="text-gray-600">
                {t("detail.validUntil")}: {validUntilCell(active)}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-0.5">
                {t("detail.justification")}
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {active.justification}
              </p>
            </div>
            {active.acceptanceConditions && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">
                  {t("detail.conditions")}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {active.acceptanceConditions}
                </p>
              </div>
            )}
            {active.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {active.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 flex-wrap py-5">
            <p className="text-sm text-gray-500">{t("history.noActive")}</p>
            <Button
              size="sm"
              onClick={() => {
                setAcceptError(null);
                setAcceptOpen(true);
              }}
            >
              <ShieldCheck size={14} />
              {t("accept.action")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── History ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {t("history.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-gray-200 px-4 py-3 space-y-2"
                >
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <RiskAcceptanceStatusBadge status={r.status} />
                    <RiskScoreBadge score={r.riskScoreAtAcceptance} size="sm" />
                    <span className="flex items-center gap-1 text-gray-600">
                      <User size={13} />
                      {acceptorLabel(r)}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatDateTime(r.acceptedAt)}
                    </span>
                    <span className="text-xs text-gray-600 ml-auto">
                      {t("detail.validUntil")}: {validUntilCell(r)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {r.justification}
                  </p>
                  {r.status === "revoked" && r.revokeReason && (
                    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-xs font-medium text-red-800">
                        {t("detail.revokeReason")}
                        {r.revokedAt ? ` (${formatDateTime(r.revokedAt)})` : ""}
                      </p>
                      <p className="text-xs text-red-700 whitespace-pre-wrap mt-0.5">
                        {r.revokeReason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Accept dialog ────────────────────────────────────────── */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("accept.title")}</DialogTitle>
            <DialogDescription>{t("accept.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="acceptance-justification">
                {t("accept.justificationLabel")}
              </Label>
              <Textarea
                id="acceptance-justification"
                rows={4}
                value={acceptForm.justification}
                onChange={(e) =>
                  setAcceptForm((f) => ({
                    ...f,
                    justification: e.target.value,
                  }))
                }
                placeholder={t("accept.justificationPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acceptance-conditions">
                {t("accept.conditionsLabel")}
              </Label>
              <Textarea
                id="acceptance-conditions"
                rows={3}
                value={acceptForm.acceptanceConditions}
                onChange={(e) =>
                  setAcceptForm((f) => ({
                    ...f,
                    acceptanceConditions: e.target.value,
                  }))
                }
                placeholder={t("accept.conditionsPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acceptance-valid-until">
                {t("accept.validUntilLabel")}
              </Label>
              <Input
                id="acceptance-valid-until"
                type="date"
                value={acceptForm.validUntil}
                onChange={(e) =>
                  setAcceptForm((f) => ({ ...f, validUntil: e.target.value }))
                }
              />
              <p className="text-xs text-gray-400">
                {t("accept.validUntilHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("accept.tagsLabel")}</Label>
              <TagInput
                value={acceptForm.tags}
                onChange={(tags) => setAcceptForm((f) => ({ ...f, tags }))}
                maxTags={20}
              />
            </div>
            {acceptError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="text-red-600 mt-0.5 shrink-0"
                />
                <p className="text-sm text-red-700">{acceptError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={accepting}
            >
              {t("accept.cancel")}
            </Button>
            <Button onClick={() => void submitAccept()} disabled={accepting}>
              {accepting && <Loader2 size={14} className="animate-spin" />}
              {t("accept.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke dialog ────────────────────────────────────────── */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("revoke.title")}</DialogTitle>
            <DialogDescription>{t("revoke.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="revoke-reason">{t("revoke.reasonLabel")}</Label>
              <Textarea
                id="revoke-reason"
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
              onClick={() => setRevokeTarget(null)}
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
