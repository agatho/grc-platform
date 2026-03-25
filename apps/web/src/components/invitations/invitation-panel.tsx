"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { UserPlus, XCircle, Mail, Clock, Loader2 } from "lucide-react";
import type { UserRole, LineOfDefense, InvitationStatus } from "@grc/shared";

interface InvitationRow {
  id: string;
  email: string;
  role: UserRole;
  lineOfDefense?: LineOfDefense | null;
  status: InvitationStatus;
  invitedByName?: string | null;
  expiresAt: string;
  createdAt: string;
}

const ROLES: UserRole[] = [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
];

const LOD_OPTIONS: LineOfDefense[] = ["first", "second", "third"];

function StatusBadge({ status, t }: { status: InvitationStatus; t: (key: string) => string }) {
  const variants: Record<InvitationStatus, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    accepted: "default",
    expired: "secondary",
    revoked: "destructive",
  };

  return (
    <Badge variant={variants[status]}>
      {t(`invitations.${status}`)}
    </Badge>
  );
}

export function InvitationPanel() {
  const t = useTranslations();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [lineOfDefense, setLineOfDefense] = useState<string>("");

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/v1/invitations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setInvitations(json.data);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleInvite = async () => {
    setSubmitting(true);
    try {
      const payload: { email: string; role: UserRole; lineOfDefense?: string } = {
        email,
        role,
      };
      if (lineOfDefense) {
        payload.lineOfDefense = lineOfDefense;
      }

      const res = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      toast.success(t("invitations.sent"));
      setDialogOpen(false);
      resetForm();
      fetchInvitations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("invitations.sendError");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (inv: InvitationRow) => {
    if (!confirm(t("invitations.revokeConfirm", { email: inv.email }))) {
      return;
    }

    setRevokingId(inv.id);
    try {
      const res = await fetch("/api/v1/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id }),
      });

      if (!res.ok) throw new Error("Failed to revoke");

      toast.success(t("invitations.revokeSuccess"));
      fetchInvitations();
    } catch {
      toast.error(t("invitations.revokeError"));
    } finally {
      setRevokingId(null);
    }
  };

  const resetForm = () => {
    setEmail("");
    setRole("viewer");
    setLineOfDefense("");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("invitations.title")}</h2>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.total")}</SelectItem>
              <SelectItem value="pending">{t("invitations.pending")}</SelectItem>
              <SelectItem value="accepted">{t("invitations.accepted")}</SelectItem>
              <SelectItem value="expired">{t("invitations.expired")}</SelectItem>
              <SelectItem value="revoked">{t("invitations.revoked")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            {t("invitations.invite")}
          </Button>
        </div>
      </div>

      {/* Invitations table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invitations.email")}</TableHead>
              <TableHead>{t("invitations.role")}</TableHead>
              <TableHead>{t("invitations.status")}</TableHead>
              <TableHead>{t("invitations.expiresAt")}</TableHead>
              <TableHead>{t("invitations.invitedBy")}</TableHead>
              <TableHead className="w-[100px]">{t("users.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("invitations.noInvitations")}
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {inv.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`roles.${inv.role}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} t={t} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(inv.expiresAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.invitedByName || "-"}
                  </TableCell>
                  <TableCell>
                    {inv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(inv)}
                        disabled={revokingId === inv.id}
                      >
                        {revokingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="ml-1">{t("invitations.revoke")}</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invitations.invite")}</DialogTitle>
            <DialogDescription>
              {t("invitations.title")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t("invitations.email")}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("invitations.role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("invitations.lineOfDefense")}</Label>
              <Select value={lineOfDefense} onValueChange={setLineOfDefense}>
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectLod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("lod.none")}</SelectItem>
                  {LOD_OPTIONS.map((lod) => (
                    <SelectItem key={lod} value={lod}>
                      {t(`lod.${lod}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={submitting || !email}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("invitations.sending")}
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("invitations.sendInvitation")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
