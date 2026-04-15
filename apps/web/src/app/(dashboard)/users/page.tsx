"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldPlus, X, Loader2, UserPlus, Mail, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { DataTable, SortableHeader } from "@/components/ui/data-table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type { UserRole, LineOfDefense } from "@grc/shared";

// ---------- Types ----------

interface UserRoleRecord {
  id: string;
  role: UserRole;
  department: string | null;
  lineOfDefense: LineOfDefense | null;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  language: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: UserRoleRecord[];
}

// ---------- Constants ----------

const ALL_ROLES: UserRole[] = [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
];

const LOD_OPTIONS: Array<{ value: LineOfDefense; key: string }> = [
  { value: "first", key: "lod.first" },
  { value: "second", key: "lod.second" },
  { value: "third", key: "lod.third" },
];

/** Map role to suggested Line of Defense */
function suggestLod(role: UserRole): LineOfDefense | null {
  switch (role) {
    case "process_owner":
    case "control_owner":
      return "first";
    case "risk_manager":
    case "dpo":
      return "second";
    case "auditor":
      return "third";
    default:
      return null;
  }
}

/** Badge color per role for visual distinction */
function roleBadgeVariant(
  role: UserRole,
): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "admin":
      return "destructive";
    case "auditor":
      return "default";
    case "risk_manager":
    case "dpo":
      return "secondary";
    default:
      return "outline";
  }
}

// ---------- Page Component ----------

export default function UsersPage() {
  const t = useTranslations();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<UserRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Assign Role dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<UserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");
  const [selectedLod, setSelectedLod] = useState<LineOfDefense | "none" | "">("");
  const [assigning, setAssigning] = useState(false);

  // Revoke confirmation dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{
    user: UserRecord;
    roleRecord: UserRoleRecord;
  } | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ---------- Fetch users + their roles ----------

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch the user list (paginated, up to 100)
      const res = await fetch("/api/v1/users?limit=100");
      if (!res.ok) throw new Error("Failed to fetch users");
      const { data: userList } = (await res.json()) as {
        data: Omit<UserRecord, "roles">[];
      };

      // Fetch roles for each user in parallel
      const withRoles = await Promise.all(
        userList.map(async (u) => {
          const detailRes = await fetch(`/api/v1/users/${u.id}`);
          if (!detailRes.ok) return { ...u, roles: [] as UserRoleRecord[] };
          const { data } = (await detailRes.json()) as {
            data: { roles: UserRoleRecord[] };
          };
          return { ...u, roles: data.roles };
        }),
      );

      setUsers(withRoles);
    } catch {
      toast.error(t("users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ---------- Auto-suggest LoD when role changes ----------

  useEffect(() => {
    if (selectedRole) {
      const suggested = suggestLod(selectedRole as UserRole);
      setSelectedLod(suggested ?? "none");
    }
  }, [selectedRole]);

  // ---------- Assign Role ----------

  function openAssignDialog(user: UserRecord) {
    setAssignTarget(user);
    setSelectedRole("");
    setSelectedLod("");
    setAssignDialogOpen(true);
  }

  async function handleAssignRole() {
    if (!assignTarget || !selectedRole) return;

    setAssigning(true);
    try {
      const body: { role: UserRole; lineOfDefense?: LineOfDefense } = {
        role: selectedRole as UserRole,
      };
      if (selectedLod && selectedLod !== "none") {
        body.lineOfDefense = selectedLod as LineOfDefense;
      }

      const res = await fetch(`/api/v1/users/${assignTarget.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Unknown error");
      }

      toast.success(t("users.assignSuccess"));
      setAssignDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error(
        t("users.assignError") +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setAssigning(false);
    }
  }

  // ---------- Revoke Role ----------

  function openRevokeDialog(user: UserRecord, roleRecord: UserRoleRecord) {
    setRevokeTarget({ user, roleRecord });
    setRevokeDialogOpen(true);
  }

  async function handleRevokeRole() {
    if (!revokeTarget) return;

    setRevoking(true);
    try {
      const res = await fetch(
        `/api/v1/users/${revokeTarget.user.id}/roles/${revokeTarget.roleRecord.id}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Unknown error");
      }

      toast.success(t("users.revokeSuccess"));
      setRevokeDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error(
        t("users.revokeError") +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setRevoking(false);
    }
  }

  // ---------- Table columns ----------

  const columns = useMemo<ColumnDef<UserRecord, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("users.name")}</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue<string>("name")}</div>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <SortableHeader column={column}>{t("users.email")}</SortableHeader>
        ),
      },
      {
        id: "roles",
        header: t("users.roles"),
        cell: ({ row }) => {
          const roles = row.original.roles;
          if (!roles.length) {
            return (
              <span className="text-sm text-gray-400 italic">
                {t("users.noRoles")}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge
                  key={r.id}
                  variant={roleBadgeVariant(r.role)}
                  className="gap-1 pr-1"
                >
                  {t(`roles.${r.role}`)}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRevokeDialog(row.original, r);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                    aria-label={t("users.revokeRole")}
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue: string) => {
          // Allow searching by role name for convenience
          return row.original.roles.some((r) =>
            r.role.toLowerCase().includes(filterValue.toLowerCase()),
          );
        },
      },
      {
        accessorKey: "is_active",
        header: t("users.status"),
        cell: ({ row }) => {
          const active = row.getValue<boolean>("is_active");
          return (
            <Badge variant={active ? "default" : "secondary"}>
              {active ? t("status.active") : t("status.inactive")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "last_login_at",
        header: ({ column }) => (
          <SortableHeader column={column}>
            {t("users.lastLogin")}
          </SortableHeader>
        ),
        cell: ({ row }) => {
          const val = row.getValue<string | null>("last_login_at");
          if (!val) {
            return (
              <span className="text-sm text-gray-400">{t("users.never")}</span>
            );
          }
          return (
            <span className="text-sm text-gray-600">
              {new Date(val).toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("users.actions"),
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAssignDialog(row.original)}
          >
            <ShieldPlus size={14} />
            {t("users.assignRole")}
          </Button>
        ),
      },
    ],
    
    [t],
  );

  // ---------- Global filter for name + email ----------

  const filteredData = useMemo(() => users, [users]);

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">
          {t("common.loading")}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("users.title")}
        </h1>
        <Button onClick={() => { setShowInvite(true); setInviteLink(""); setInvEmail(""); }}>
          <UserPlus size={16} className="mr-2" />
          Benutzer einladen
        </Button>
      </div>

      {/* Invite Form */}
      {showInvite && !inviteLink && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">Neuen Benutzer einladen</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowInvite(false)}><X size={16} /></Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
              placeholder="kollege@firma.de" className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <select value={invRole} onChange={e => setInvRole(e.target.value as UserRole)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              {ALL_ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </select>
            <Button disabled={inviting || !invEmail.trim()} onClick={async () => {
              setInviting(true);
              try {
                const res = await fetch("/api/v1/invitations", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: invEmail.trim(), role: invRole }),
                });
                if (res.ok) {
                  const json = await res.json();
                  setInviteLink(`${window.location.origin}/invite/${json.data.token}`);
                  toast.success("Einladung erstellt");
                } else {
                  const json = await res.json();
                  toast.error(json.error ?? "Fehler");
                }
              } finally { setInviting(false); }
            }}>
              {inviting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Mail size={14} className="mr-1" />}
              Einladen
            </Button>
          </div>
        </div>
      )}

      {/* Invite Link */}
      {inviteLink && (
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-green-600" />
            <span className="font-semibold text-green-900">Einladung fuer {invEmail} erstellt</span>
          </div>
          <p className="text-sm text-green-800">Link ist 7 Tage gueltig. Senden Sie ihn per E-Mail oder Chat.</p>
          <div className="flex gap-2">
            <input value={inviteLink} readOnly className="flex-1 rounded-md border bg-white px-3 py-2 text-sm font-mono" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}>
              {linkCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {linkCopied ? "Kopiert!" : "Kopieren"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowInvite(false); setInviteLink(""); fetchUsers(); }}>Schliessen</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInviteLink(""); setInvEmail(""); }}>Weitere einladen</Button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        searchKey="name"
        searchPlaceholder={t("users.searchPlaceholder")}
        pageSize={10}
      />

      {/* ---------- Assign Role Dialog ---------- */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.assignRole")}</DialogTitle>
            <DialogDescription>
              {assignTarget?.name} ({assignTarget?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Role select */}
            <div className="space-y-2">
              <Label>{t("users.selectRole")}</Label>
              <Select
                value={selectedRole}
                onValueChange={(val) => setSelectedRole(val as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line of Defense select */}
            <div className="space-y-2">
              <Label>{t("users.lineOfDefense")}</Label>
              <Select
                value={selectedLod}
                onValueChange={(val) =>
                  setSelectedLod(val as LineOfDefense | "none")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectLod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("lod.none")}</SelectItem>
                  {LOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole && suggestLod(selectedRole as UserRole) && (
                <p className="text-xs text-gray-500">
                  {t("users.lineOfDefense")}:{" "}
                  {t(`lod.${suggestLod(selectedRole as UserRole)}`)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={!selectedRole || assigning}
            >
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("users.assignRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Revoke Role Confirmation Dialog ---------- */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.revokeRole")}</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? t("users.revokeConfirm", {
                    role: t(`roles.${revokeTarget.roleRecord.role}`),
                    user: revokeTarget.user.name,
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={revoking}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeRole}
              disabled={revoking}
            >
              {revoking && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("users.revokeRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
