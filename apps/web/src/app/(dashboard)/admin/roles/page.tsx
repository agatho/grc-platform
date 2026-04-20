"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Shield,
  Pencil,
  Trash2,
  Users,
  X,
  Check,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MODULE_KEYS = [
  { key: "erm", label: "ERM" },
  { key: "isms", label: "ISMS" },
  { key: "ics", label: "ICS" },
  { key: "dpms", label: "DPMS" },
  { key: "bcms", label: "BCMS" },
  { key: "audit", label: "Audit" },
  { key: "tprm", label: "TPRM" },
  { key: "contract", label: "Vertraege" },
  { key: "esg", label: "ESG" },
  { key: "bpm", label: "BPM" },
  { key: "eam", label: "EAM" },
  { key: "reporting", label: "Reporting" },
  { key: "whistleblowing", label: "Whistleblowing" },
  { key: "dms", label: "DMS" },
  { key: "academy", label: "Academy" },
];

const ACTIONS = ["read", "write", "admin", "none"] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_COLORS: Record<Action, string> = {
  admin: "bg-purple-100 text-purple-800",
  write: "bg-blue-100 text-blue-800",
  read: "bg-green-100 text-green-800",
  none: "bg-gray-100 text-gray-400",
};

const ACTION_LABELS: Record<Action, string> = {
  admin: "Admin",
  write: "Schreiben",
  read: "Lesen",
  none: "Kein Zugriff",
};

interface Permission {
  moduleKey: string;
  action: string;
}
interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  systemRoleKey: string | null;
  permissions: Permission[];
}

export default function RolesAdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/roles");
      if (res.ok) setRoles((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Rollenverwaltung
          </h1>
          <p className="text-muted-foreground">
            System- und benutzerdefinierte Rollen mit Modul-Berechtigungen
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" /> Neue Rolle erstellen
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <RoleForm
          onSave={async (data) => {
            const res = await fetch("/api/v1/admin/roles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (res.ok) {
              setShowCreate(false);
              fetchRoles();
            }
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* System Roles */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Shield size={18} /> Systemrollen ({systemRoles.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {systemRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onRefresh={fetchRoles}
                  isEditing={editingId === role.id}
                  onEdit={() =>
                    setEditingId(editingId === role.id ? null : role.id)
                  }
                />
              ))}
            </div>
          </div>

          {/* Custom Roles */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users size={18} /> Benutzerdefinierte Rollen (
              {customRoles.length})
            </h2>
            {customRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine benutzerdefinierten Rollen erstellt
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {customRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onRefresh={fetchRoles}
                    isEditing={editingId === role.id}
                    onEdit={() =>
                      setEditingId(editingId === role.id ? null : role.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RoleCard({
  role,
  onRefresh,
  isEditing,
  onEdit,
}: {
  role: Role;
  onRefresh: () => void;
  isEditing: boolean;
  onEdit: () => void;
}) {
  const permMap = Object.fromEntries(
    role.permissions.map((p) => [p.moduleKey, p.action as Action]),
  );
  const activeModules = role.permissions.filter(
    (p) => p.action !== "none",
  ).length;

  const handleDelete = async () => {
    if (!confirm(`Rolle "${role.name}" wirklich loeschen?`)) return;
    await fetch(`/api/v1/admin/roles/${role.id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: role.color ?? "#6B7280" }}
          />
          <span className="font-medium">{role.name}</span>
          {role.isSystem && (
            <Badge variant="outline" className="text-[9px]">
              System
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {!role.isSystem && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil size={12} />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete}>
                <Trash2 size={12} className="text-red-500" />
              </Button>
            </>
          )}
        </div>
      </div>

      {role.description && (
        <p className="text-xs text-muted-foreground">{role.description}</p>
      )}

      {/* Permission Badges */}
      <div className="flex flex-wrap gap-1">
        {MODULE_KEYS.filter(
          (m) => permMap[m.key] && permMap[m.key] !== "none",
        ).map((m) => (
          <Badge
            key={m.key}
            variant="outline"
            className={`text-[9px] ${ACTION_COLORS[permMap[m.key] as Action] ?? ""}`}
          >
            {m.label}:{" "}
            {ACTION_LABELS[permMap[m.key] as Action] ?? permMap[m.key]}
          </Badge>
        ))}
        {activeModules === 0 && (
          <span className="text-xs text-muted-foreground">
            Keine Berechtigungen
          </span>
        )}
      </div>

      {/* Edit Form (inline) */}
      {isEditing && !role.isSystem && (
        <RoleForm
          initial={{
            name: role.name,
            description: role.description ?? "",
            color: role.color,
            permissions: role.permissions.map((p) => ({
              moduleKey: p.moduleKey,
              action: p.action,
            })),
          }}
          onSave={async (data) => {
            await fetch(`/api/v1/admin/roles/${role.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            onEdit();
            onRefresh();
          }}
          onCancel={onEdit}
        />
      )}
    </div>
  );
}

function RoleForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: {
    name: string;
    description: string;
    color: string;
    permissions: { moduleKey: string; action: string }[];
  };
  onSave: (data: {
    name: string;
    description?: string;
    color: string;
    permissions: { moduleKey: string; action: string }[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6B7280");
  const [perms, setPerms] = useState<Record<string, Action>>(() => {
    const map: Record<string, Action> = {};
    MODULE_KEYS.forEach((m) => {
      map[m.key] = "none";
    });
    initial?.permissions.forEach((p) => {
      map[p.moduleKey] = p.action as Action;
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const permissions = Object.entries(perms)
        .filter(([, action]) => action !== "none")
        .map(([moduleKey, action]) => ({ moduleKey, action }));
      await onSave({
        name,
        description: description || undefined,
        color,
        permissions:
          permissions.length > 0
            ? permissions
            : [{ moduleKey: "erm", action: "read" }],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Rollenname *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Compliance-Manager"
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Beschreibung
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurzbeschreibung..."
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Farbe
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 rounded border"
          />
        </div>
      </div>

      {/* Permission Matrix */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Berechtigungen pro Modul
        </label>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left font-medium">Modul</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="p-2 text-center font-medium">
                    {ACTION_LABELS[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_KEYS.map((m) => (
                <tr key={m.key} className="border-t">
                  <td className="p-2 font-medium">{m.label}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`perm-${m.key}`}
                        checked={perms[m.key] === a}
                        onChange={() => setPerms((p) => ({ ...p, [m.key]: a }))}
                        className="h-3.5 w-3.5 text-blue-600"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin mr-1" />
          ) : (
            <Save size={12} className="mr-1" />
          )}
          {initial ? "Aktualisieren" : "Rolle erstellen"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
