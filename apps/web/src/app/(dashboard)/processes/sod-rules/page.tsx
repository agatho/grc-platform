"use client";

// [ARCTOS-FULL-2026-08-31 · OP-001] Pflegemaske 2 von 4 — `sod_rule`.
//
// Von den zehn Tabellen die einzige, die kein Importpfad je füllen kann: eine
// Unverträglichkeit zweier fachlicher Aufgaben steht in keinem BPMN-XML und in
// keinem Ereignisprotokoll. Ohne diese Seite war Layer F3 tot.
//
// Zwei Feinheiten, beide aus `STUFE2-E-SCHEMA.md` §1.2:
//
//  * **Die Selbstpaarung ist erlaubt** und ausdrücklich erklärt — „dieselbe
//    Rolle verantwortet beide Aufgaben" ist der Verstoss, den ein IKS-Prüfer
//    sucht, nicht ein Eingabefehler.
//  * **Deaktivieren statt löschen** ist der Regelfall; eine ausser Kraft
//    gesetzte Regel bleibt nachvollziehbar, erzeugt aber keinen Konflikt mehr.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorRetry } from "@/components/ui/error-retry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { fetchJson, ApiRequestError } from "@/lib/api-client";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
type Severity = (typeof SEVERITIES)[number];

/**
 * Farbpaare, gegen `contrast-pairs.test.ts` gerechnet: alle vier über 4,5:1
 * im hellen Standardthema.
 */
const SEVERITY_CLASS: Record<Severity, string> = {
  low: "bg-blue-100 text-blue-900",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-900",
};

interface RuleRow {
  id: string;
  roleAId: string;
  roleAName: string | null;
  roleBId: string;
  roleBName: string | null;
  severity: string;
  rationale: string | null;
  frameworkRef: string | null;
  isActive: boolean;
}

interface Option {
  id: string;
  name: string;
}

interface RulesResponse {
  data: RuleRow[];
  options: { roles: Option[] };
}

export default function SodRulesPage() {
  const t = useTranslations("processGrc");
  const [resp, setResp] = useState<RulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [roleAId, setRoleAId] = useState("");
  const [roleBId, setRoleBId] = useState("");
  const [severity, setSeverity] = useState<Severity>("high");
  const [rationale, setRationale] = useState("");
  const [frameworkRef, setFrameworkRef] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `limit` bleibt bei der Vorgabe der Route (100). Wächst die Regelmenge
      // über eine Seite hinaus, gehört hier `fetchAllPages` hin — heute wäre
      // das eine Blätterschleife über eine Liste, die keine zweite Seite hat.
      setResp(await fetchJson<RulesResponse>("/api/v1/processes/sod-rules"));
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? (e.detail ?? e.message)
          : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await fetchJson("/api/v1/processes/sod-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleAId,
          roleBId,
          severity,
          rationale: rationale || undefined,
          frameworkRef: frameworkRef || undefined,
          isActive: true,
        }),
      });
      setRoleAId("");
      setRoleBId("");
      setRationale("");
      setFrameworkRef("");
      await load();
    } catch (e) {
      setFormError(
        e instanceof ApiRequestError && e.status === 409
          ? t("sod.duplicate")
          : e instanceof ApiRequestError
            ? (e.detail ?? e.message)
            : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (rule: RuleRow) => {
    setBusy(true);
    try {
      await fetchJson(`/api/v1/processes/sod-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      await load();
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? (e.detail ?? e.message)
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rule: RuleRow) => {
    if (!window.confirm(t("sod.deleteConfirm"))) return;
    setBusy(true);
    try {
      await fetchJson(`/api/v1/processes/sod-rules/${rule.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? (e.detail ?? e.message)
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const severityLabel = (value: string) =>
    value === "low"
      ? t("sod.severityLow")
      : value === "medium"
        ? t("sod.severityMedium")
        : value === "critical"
          ? t("sod.severityCritical")
          : t("sod.severityHigh");

  const roles = resp?.options.roles ?? [];

  return (
    <ModuleGate moduleKey="bpm">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Link
            href="/processes"
            className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("nav.backToProcesses")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("sod.title")}</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            {t("sod.description")}
          </p>
        </div>

        {loading && !resp && (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("common.loading")}
          </p>
        )}

        {error && <ErrorRetry message={error} onRetry={load} />}

        {resp && !error && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("sod.newRule")}</CardTitle>
                <CardDescription>{t("sod.selfPairHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {roles.length === 0 ? (
                  <p className="text-sm text-gray-700">{t("sod.noRoles")}</p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="role-a">{t("sod.roleA")}</Label>
                        <select
                          id="role-a"
                          className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                          value={roleAId}
                          onChange={(e) => setRoleAId(e.target.value)}
                        >
                          <option value="">{t("common.none")}</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="role-b">{t("sod.roleB")}</Label>
                        <select
                          id="role-b"
                          className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                          value={roleBId}
                          onChange={(e) => setRoleBId(e.target.value)}
                        >
                          <option value="">{t("common.none")}</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="severity">{t("sod.severity")}</Label>
                        <select
                          id="severity"
                          className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
                          value={severity}
                          onChange={(e) =>
                            setSeverity(e.target.value as Severity)
                          }
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>
                              {severityLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="rationale">{t("sod.rationale")}</Label>
                        <Textarea
                          id="rationale"
                          rows={2}
                          value={rationale}
                          placeholder={t("sod.rationalePlaceholder")}
                          onChange={(e) => setRationale(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="framework-ref">
                          {t("sod.frameworkRef")}
                        </Label>
                        <Input
                          id="framework-ref"
                          value={frameworkRef}
                          placeholder={t("sod.frameworkRefPlaceholder")}
                          onChange={(e) => setFrameworkRef(e.target.value)}
                        />
                      </div>
                    </div>

                    {formError && (
                      <p className="text-sm text-red-700">{formError}</p>
                    )}

                    <Button
                      onClick={create}
                      disabled={busy || !roleAId || !roleBId}
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("common.add")}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {resp.data.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-gray-700">
                  {t("sod.empty")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">{t("sod.activeHint")}</p>
                {resp.data.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {rule.roleAName ?? rule.roleAId}
                          {" ↔ "}
                          {rule.roleBName ?? rule.roleBId}
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded px-2 py-0.5 ${
                              SEVERITY_CLASS[rule.severity as Severity] ??
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {severityLabel(rule.severity)}
                          </span>
                          {rule.frameworkRef && (
                            <span className="text-gray-600">
                              {rule.frameworkRef}
                            </span>
                          )}
                        </p>
                        {rule.rationale && (
                          <p className="max-w-2xl text-sm text-gray-700">
                            {rule.rationale}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`active-${rule.id}`}
                            checked={rule.isActive}
                            disabled={busy}
                            onCheckedChange={() => toggleActive(rule)}
                          />
                          <Label htmlFor={`active-${rule.id}`}>
                            {rule.isActive
                              ? t("sod.active")
                              : t("sod.inactive")}
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => remove(rule)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModuleGate>
  );
}
