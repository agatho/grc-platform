"use client";

// W21-DMS-MULTISIGN-01: "Signaturen" tab on the document detail page.
//
// Shows every signature request of the document with per-signer
// progress, a "request signatures" dialog (ordered multi-select,
// sequential toggle, message, due date), a prominent sign/decline
// area for the responsible signer (with the eIDAS Art. 25 simple
// electronic signature notice), certificate download, and an inline
// chain-verification result.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  Loader2,
  PenLine,
  Plus,
  ShieldCheck,
  ShieldX,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDateFormat } from "@/lib/format-date";

// ── Types (API response shapes) ─────────────────────────────────────

export interface SignatureEntry {
  id: string;
  requestId: string;
  signerUserId: string;
  signerName: string | null;
  signerEmail: string | null;
  signOrder: number;
  status: "pending" | "signed" | "declined";
  signedAt: string | null;
  declineReason: string | null;
  chainHash: string | null;
}

export interface SignatureRequestEntry {
  id: string;
  documentId: string;
  versionId: string;
  fileSha256: string;
  title: string;
  message: string | null;
  status: "pending" | "completed" | "declined" | "cancelled";
  sequential: boolean;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  signatures: SignatureEntry[];
}

interface VerificationLink {
  signatureId: string;
  signerName: string | null;
  signOrder: number;
  status: string;
  contentHashValid: boolean | null;
  chainLinkValid: boolean | null;
}

interface VerificationReport {
  chainValid: boolean;
  fileIntegrityValid: boolean;
  valid: boolean;
  brokenAt: number | null;
  links: VerificationLink[];
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  docId: string;
  requests: SignatureRequestEntry[];
  onChanged: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function requestBadgeClass(status: SignatureRequestEntry["status"]): string {
  const map: Record<SignatureRequestEntry["status"], string> = {
    pending: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    declined: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-slate-200 text-slate-600 border-slate-300",
  };
  return map[status];
}

/** Is this signer's slot actionable right now? */
function isSlotActionable(
  request: SignatureRequestEntry,
  slot: SignatureEntry,
): boolean {
  if (request.status !== "pending" || slot.status !== "pending") return false;
  if (!request.sequential) return true;
  return !request.signatures.some(
    (s) => s.signOrder < slot.signOrder && s.status === "pending",
  );
}

// ── Component ───────────────────────────────────────────────────────

export function DocumentSignaturesTab({ docId, requests, onChanged }: Props) {
  const t = useTranslations("documentSignature");
  const { formatDate } = useDateFormat();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Request-signatures dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedSigners, setSelectedSigners] = useState<OrgUser[]>([]);
  const [sequential, setSequential] = useState(false);
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sign / decline state
  const [signTarget, setSignTarget] = useState<SignatureRequestEntry | null>(
    null,
  );
  const [declineTarget, setDeclineTarget] =
    useState<SignatureRequestEntry | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Verification state per request
  const [verifyResults, setVerifyResults] = useState<
    Record<string, VerificationReport>
  >({});
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    void (async () => {
      try {
        const res = await fetch("/api/v1/users?limit=100");
        if (res.ok) {
          const json = await res.json();
          setUsers(json.data ?? []);
        }
      } catch {
        // dropdown stays empty; user sees no options
      }
    })();
  }, [dialogOpen]);

  const addSigner = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u || selectedSigners.some((s) => s.id === userId)) return;
    setSelectedSigners((prev) => [...prev, u]);
  };

  const moveSigner = (index: number, dir: -1 | 1) => {
    setSelectedSigners((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedSigners.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/documents/${docId}/signature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signers: selectedSigners.map((s) => s.id),
          sequential,
          message: message || null,
          dueDate: dueDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(t("toasts.requestCreated"));
      setDialogOpen(false);
      setSelectedSigners([]);
      setSequential(false);
      setMessage("");
      setDueDate("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!signTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/v1/signature-requests/${signTarget.id}/sign`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(t("toasts.signed"));
      setSignTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!declineTarget || declineReason.trim().length < 3) return;
    setActionBusy(true);
    try {
      const res = await fetch(
        `/api/v1/signature-requests/${declineTarget.id}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: declineReason.trim() }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(t("toasts.declined"));
      setDeclineTarget(null);
      setDeclineReason("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const res = await fetch(`/api/v1/signature-requests/${requestId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(t("toasts.cancelled"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    }
  };

  const handleVerify = async (requestId: string) => {
    setVerifying(requestId);
    try {
      const res = await fetch(`/api/v1/signature-requests/${requestId}/verify`);
      if (!res.ok) throw new Error("Verification failed");
      const json = await res.json();
      setVerifyResults((prev) => ({ ...prev, [requestId]: json.data }));
    } catch {
      toast.error(t("toasts.verifyError"));
    } finally {
      setVerifying(null);
    }
  };

  const availableUsers = users.filter(
    (u) => !selectedSigners.some((s) => s.id === u.id),
  );

  return (
    <div className="space-y-4">
      {/* Header row: request-signatures dialog */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{t("description")}</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} />
              {t("requestDialog.trigger")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("requestDialog.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("requestDialog.signers")}</Label>
                <Select value="" onValueChange={addSigner}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("requestDialog.addSigner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSigners.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    {t("requestDialog.noSigners")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {selectedSigners.map((s, i) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5"
                      >
                        <span className="w-5 text-xs font-mono text-gray-500">
                          {i + 1}.
                        </span>
                        <span className="flex-1 truncate text-sm">
                          {s.name ?? s.email}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={i === 0}
                          onClick={() => moveSigner(i, -1)}
                          title={t("requestDialog.moveUp")}
                        >
                          <ArrowUp size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          disabled={i === selectedSigners.length - 1}
                          onClick={() => moveSigner(i, 1)}
                          title={t("requestDialog.moveDown")}
                        >
                          <ArrowDown size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            setSelectedSigners((prev) =>
                              prev.filter((x) => x.id !== s.id),
                            )
                          }
                          title={t("requestDialog.remove")}
                        >
                          <Trash2 size={12} className="text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sig-sequential">
                    {t("requestDialog.sequential")}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {t("requestDialog.sequentialHint")}
                  </p>
                </div>
                <Switch
                  id="sig-sequential"
                  checked={sequential}
                  onCheckedChange={setSequential}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig-message">{t("requestDialog.message")}</Label>
                <Textarea
                  id="sig-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("requestDialog.messagePlaceholder")}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig-due">{t("requestDialog.dueDate")}</Label>
                <Input
                  id="sig-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                {t("requestDialog.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={selectedSigners.length === 0 || submitting}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t("requestDialog.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <FileSignature size={28} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("empty")}</p>
        </div>
      ) : (
        requests.map((request) => {
          const mySlot = currentUserId
            ? request.signatures.find((s) => s.signerUserId === currentUserId)
            : undefined;
          const canAct = mySlot ? isSlotActionable(request, mySlot) : false;
          const verification = verifyResults[request.id];

          return (
            <Card key={request.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSignature size={16} className="text-gray-400" />
                    {request.title}
                    <Badge
                      variant="outline"
                      className={requestBadgeClass(request.status)}
                    >
                      {t(`requestStatus.${request.status}`)}
                    </Badge>
                    {request.sequential && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("sequentialBadge")}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(request.id)}
                      disabled={verifying === request.id}
                    >
                      {verifying === request.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      {t("actions.verify")}
                    </Button>
                    <a
                      href={`/api/v1/signature-requests/${request.id}/certificate`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      <Download size={14} />
                      {t("actions.certificate")}
                    </a>
                    {request.status === "pending" &&
                      request.createdBy === currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(request.id)}
                          title={t("actions.cancel")}
                        >
                          <XCircle size={14} className="text-red-500" />
                        </Button>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    {t("requestedAt")}: {formatDate(request.createdAt)}
                  </span>
                  {request.dueDate && (
                    <span>
                      {t("dueDate")}: {formatDate(request.dueDate)}
                    </span>
                  )}
                  <span
                    className="font-mono truncate max-w-48"
                    title={request.fileSha256}
                  >
                    SHA-256: {request.fileSha256.slice(0, 16)}…
                  </span>
                </div>
                {request.message && (
                  <p className="text-xs text-gray-600 italic">
                    {request.message}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Signer progress */}
                <div className="space-y-1.5">
                  {request.signatures.map((sig) => {
                    const actionable = isSlotActionable(request, sig);
                    return (
                      <div
                        key={sig.id}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                          actionable
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="w-5 text-xs font-mono text-gray-500">
                          {sig.signOrder}.
                        </span>
                        {sig.status === "signed" ? (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-500 shrink-0"
                          />
                        ) : sig.status === "declined" ? (
                          <XCircle size={16} className="text-red-500 shrink-0" />
                        ) : (
                          <Clock size={16} className="text-gray-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {sig.signerName ?? sig.signerEmail ?? sig.signerUserId}
                            {sig.signerUserId === currentUserId && (
                              <span className="ml-1 text-xs text-gray-400">
                                ({t("you")})
                              </span>
                            )}
                          </p>
                          {sig.status === "signed" && sig.signedAt && (
                            <p className="text-xs text-gray-500">
                              {t("signerStatus.signedAt", {
                                date: formatDate(sig.signedAt),
                              })}
                            </p>
                          )}
                          {sig.status === "declined" && sig.declineReason && (
                            <p className="text-xs text-red-600">
                              {t("signerStatus.declineReason")}:{" "}
                              {sig.declineReason}
                            </p>
                          )}
                          {actionable && sig.status === "pending" && (
                            <p className="text-xs text-blue-600">
                              {t("signerStatus.upNext")}
                            </p>
                          )}
                        </div>
                        {sig.chainHash && (
                          <span
                            className="hidden md:inline text-[10px] font-mono text-gray-400 truncate max-w-32"
                            title={sig.chainHash}
                          >
                            {sig.chainHash.slice(0, 12)}…
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Prominent sign / decline area for the responsible signer */}
                {canAct && (
                  <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <PenLine size={16} className="text-blue-600" />
                      <p className="text-sm font-medium text-blue-900">
                        {t("signArea.title")}
                      </p>
                    </div>
                    <p className="text-xs text-blue-800">
                      {t("signArea.legalNotice")}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => setSignTarget(request)}>
                        <BadgeCheck size={14} />
                        {t("actions.sign")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeclineTarget(request)}
                      >
                        <XCircle size={14} />
                        {t("actions.decline")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Verification result */}
                {verification && (
                  <div
                    className={`rounded-lg border p-3 space-y-2 ${
                      verification.valid
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {verification.valid ? (
                        <ShieldCheck size={16} className="text-emerald-600" />
                      ) : (
                        <ShieldX size={16} className="text-red-600" />
                      )}
                      <p className="text-sm font-medium">
                        {verification.valid
                          ? t("verify.valid")
                          : t("verify.invalid")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={
                          verification.chainValid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }
                      >
                        {verification.chainValid
                          ? t("verify.chainValid")
                          : t("verify.chainBroken", {
                              index: (verification.brokenAt ?? 0) + 1,
                            })}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          verification.fileIntegrityValid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }
                      >
                        {verification.fileIntegrityValid
                          ? t("verify.fileUnchanged")
                          : t("verify.fileChanged")}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Sign confirmation (legal notice) */}
      <AlertDialog
        open={!!signTarget}
        onOpenChange={(open) => !open && setSignTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("signConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t("signConfirm.body", { title: signTarget?.title ?? "" })}
              </span>
              <span className="block text-xs text-gray-500">
                {t("signArea.legalNotice")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>
              {t("signConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSign} disabled={actionBusy}>
              {actionBusy && <Loader2 size={14} className="animate-spin" />}
              {t("signConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline dialog (mandatory reason) */}
      <Dialog
        open={!!declineTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineTarget(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("declineDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">
              {t("declineDialog.reason")} *
            </Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t("declineDialog.reasonPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineTarget(null)}
              disabled={actionBusy}
            >
              {t("declineDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={declineReason.trim().length < 3 || actionBusy}
            >
              {actionBusy && <Loader2 size={14} className="animate-spin" />}
              {t("declineDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
