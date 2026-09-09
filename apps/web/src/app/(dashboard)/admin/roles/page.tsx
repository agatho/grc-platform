"use client";

import { useCallback, useState, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Shield,
  Pencil,
  Trash2,
  Users,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch
 * ("Vertraege", "loeschen" mit transliterierten Umlauten).
 *
 * ZWEI BARRIEREFREIHEITSMAENGEL, die beim Umstellen sichtbar wurden — dieselbe
 * Klasse wie C-13 aus Welle 5a:
 *   • Die 60 Auswahlknoepfe der Berechtigungsmatrix trugen KEINEN
 *     zugaenglichen Namen. Ein Screenreader las „Optionsfeld" — sechzig Mal,
 *     ohne zu sagen, welches Modul und welche Stufe gemeint ist.
 *   • Die Modulspalte war ein `<td>`, kein `<th scope="row">`; damit fehlte
 *     auch die Zeilenzuordnung, die eine Tabelle ueberhaupt lesbar macht.
 * Beides ist behoben; die Beschriftung kommt aus dem Katalog.
 */

const MODULE_KEYS = [
  "erm",
  "isms",
  "ics",
  "dpms",
  "bcms",
  "audit",
  "tprm",
  "contract",
  "esg",
  "bpm",
  "eam",
  "reporting",
  "whistleblowing",
  "dms",
  "academy",
] as const;

const ACTIONS = ["read", "write", "admin", "none"] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_COLORS: Record<Action, string> = {
  admin: "bg-purple-100 text-purple-800",
  write: "bg-blue-100 text-blue-800",
  read: "bg-green-100 text-green-800",
  none: "bg-gray-100 text-gray-600",
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
  const t = useTranslations("admin");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert
  // wie vorher eine leere Liste.
  const {
    data: roles = [],
    isPending: loading,
    refetch,
  } = useQuery<Role[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/roles");
      if (!res.ok) return [];
      return ((await res.json()).data ?? []) as Role[];
    },
  });

  const fetchRoles = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("roles.title")}
          </h1>
          <p className="text-muted-foreground">{t("roles.description")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" /> {t("roles.createNew")}
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
              <Shield size={18} />{" "}
              {t("roles.systemRoles", { count: systemRoles.length })}
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
              <Users size={18} />{" "}
              {t("roles.customRoles", { count: customRoles.length })}
            </h2>
            {customRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("roles.noCustomRoles")}
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
  const t = useTranslations("admin");
  const permMap = Object.fromEntries(
    role.permissions.map((p) => [p.moduleKey, p.action as Action]),
  );
  const activeModules = role.permissions.filter(
    (p) => p.action !== "none",
  ).length;

  const handleDelete = async () => {
    if (!confirm(t("roles.deleteConfirm", { name: role.name }))) return;
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
              {t("roles.system")}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {!role.isSystem && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                aria-label={t("roles.editRole", { name: role.name })}
              >
                <Pencil size={12} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                aria-label={t("roles.deleteRole", { name: role.name })}
              >
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
        {MODULE_KEYS.filter((m) => permMap[m] && permMap[m] !== "none").map(
          (m) => (
            <Badge
              key={m}
              variant="outline"
              className={`text-[9px] ${ACTION_COLORS[permMap[m] as Action] ?? ""}`}
            >
              {t(`roles.module.${m}`)}: {t(`roles.action.${permMap[m]}`)}
            </Badge>
          ),
        )}
        {activeModules === 0 && (
          <span className="text-xs text-muted-foreground">
            {t("roles.noPermissions")}
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
  // [ARCTOS-FULL-2026-08-31 / WP12 · S14-09] One id root per component
  // instance, so every <label htmlFor> below points at its own control
  // even when this component is rendered more than once on a page.
  const a11yId = useId();
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6B7280");
  const [perms, setPerms] = useState<Record<string, Action>>(() => {
    const map: Record<string, Action> = {};
    MODULE_KEYS.forEach((m) => {
      map[m] = "none";
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
          <label
            htmlFor={`${a11yId}-rollenname`}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            {t("roles.form.name")}
          </label>
          <input
            id={`${a11yId}-rollenname`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("roles.form.namePlaceholder")}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={`${a11yId}-beschreibung`}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            {t("roles.form.description")}
          </label>
          <input
            id={`${a11yId}-beschreibung`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("roles.form.descriptionPlaceholder")}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={`${a11yId}-farbe`}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            {t("roles.form.color")}
          </label>
          <input
            id={`${a11yId}-farbe`}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 rounded border"
          />
        </div>
      </div>

      {/* Permission Matrix */}
      <div>
        {/* [WP12 · S14-09] This was a <label> with no control: it heads a
            permission matrix table, not a single field. A <label> that names
            nothing is worse than no label — it is announced as a form label
            and leads nowhere. It captions the table now. */}
        <p
          id={`${a11yId}-permissions-caption`}
          className="block text-xs font-medium text-gray-600 mb-2"
        >
          {t("roles.form.permissionMatrix")}
        </p>
        <div className="rounded-md border overflow-hidden">
          <table
            className="w-full text-xs"
            aria-labelledby={`${a11yId}-permissions-caption`}
          >
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left font-medium">
                  {t("roles.form.module")}
                </th>
                {ACTIONS.map((a) => (
                  <th key={a} className="p-2 text-center font-medium">
                    {t(`roles.action.${a}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_KEYS.map((m) => (
                <tr key={m} className="border-t">
                  <th scope="row" className="p-2 text-left font-medium">
                    {t(`roles.module.${m}`)}
                  </th>
                  {ACTIONS.map((a) => (
                    <td key={a} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`perm-${m}`}
                        checked={perms[m] === a}
                        onChange={() => setPerms((p) => ({ ...p, [m]: a }))}
                        className="h-3.5 w-3.5 text-blue-600"
                        aria-label={t("roles.form.permissionOption", {
                          module: t(`roles.module.${m}`),
                          action: t(`roles.action.${a}`),
                        })}
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
          {/* NICHT `common.actions.refresh`: dort steht zwar dasselbe deutsche
              Wort „Aktualisieren", englisch aber „Refresh" — und dieser Knopf
              speichert, er laedt nicht neu. Gleicher Text ist noch kein
              gleicher Schluessel. */}
          {initial ? t("roles.form.update") : t("roles.form.create")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {tCommon("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
