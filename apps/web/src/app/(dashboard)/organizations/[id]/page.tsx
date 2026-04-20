"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Building2,
  Info,
  Loader2,
  Save,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgDetail {
  id: string;
  name: string;
  shortName: string | null;
  type: "subsidiary" | "holding" | "joint_venture" | "branch";
  country: string;
  isEu: boolean;
  parentOrgId: string | null;
  parentOrgName: string | null;
  legalForm: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  orgCode: string | null;
  isDataController: boolean;
  supervisoryAuthority: string | null;
  dataResidency: string | null;
  dpoUserId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface GdprFormData {
  orgCode: string;
  isDataController: boolean;
  supervisoryAuthority: string;
  dataResidency: string;
  dpoUserId: string;
}

const EU_COUNTRIES = [
  { code: "AUT", label: "Austria" },
  { code: "BEL", label: "Belgium" },
  { code: "BGR", label: "Bulgaria" },
  { code: "HRV", label: "Croatia" },
  { code: "CYP", label: "Cyprus" },
  { code: "CZE", label: "Czech Republic" },
  { code: "DNK", label: "Denmark" },
  { code: "EST", label: "Estonia" },
  { code: "FIN", label: "Finland" },
  { code: "FRA", label: "France" },
  { code: "DEU", label: "Germany" },
  { code: "GRC", label: "Greece" },
  { code: "HUN", label: "Hungary" },
  { code: "IRL", label: "Ireland" },
  { code: "ITA", label: "Italy" },
  { code: "LVA", label: "Latvia" },
  { code: "LTU", label: "Lithuania" },
  { code: "LUX", label: "Luxembourg" },
  { code: "MLT", label: "Malta" },
  { code: "NLD", label: "Netherlands" },
  { code: "POL", label: "Poland" },
  { code: "PRT", label: "Portugal" },
  { code: "ROU", label: "Romania" },
  { code: "SVK", label: "Slovakia" },
  { code: "SVN", label: "Slovenia" },
  { code: "ESP", label: "Spain" },
  { code: "SWE", label: "Sweden" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrganizationDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const t = useTranslations("organizations");
  const tGdpr = useTranslations("organizations.gdpr");
  const tStatus = useTranslations("status");
  const tActions = useTranslations("actions");

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // GDPR form
  const [gdprForm, setGdprForm] = useState<GdprFormData>({
    orgCode: "",
    isDataController: false,
    supervisoryAuthority: "",
    dataResidency: "",
    dpoUserId: "",
  });
  const [gdprSaving, setGdprSaving] = useState(false);
  const [orgCodeLocked, setOrgCodeLocked] = useState(false);

  // Overview form
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    name: "",
    shortName: "",
    type: "subsidiary" as string,
    country: "",
    legalForm: "",
  });

  // DPO users
  const [dpoUsers, setDpoUsers] = useState<OrgUser[]>([]);

  // Fetch organization
  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const data: OrgDetail = json.data ?? json;
      setOrg(data);

      // Populate forms
      setOverviewForm({
        name: data.name,
        shortName: data.shortName ?? "",
        type: data.type,
        country: data.country,
        legalForm: data.legalForm ?? "",
      });

      const hasOrgCode = Boolean(data.orgCode);
      setOrgCodeLocked(hasOrgCode);
      setGdprForm({
        orgCode: data.orgCode ?? "",
        isDataController: data.isDataController ?? false,
        supervisoryAuthority: data.supervisoryAuthority ?? "",
        dataResidency: data.dataResidency ?? "",
        dpoUserId: data.dpoUserId ?? "",
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Fetch DPO users (users with dpo role in this org)
  useEffect(() => {
    fetch(`/api/v1/users?limit=200`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((json) => {
        const users = (json.data ?? [])
          .filter((u: Record<string, unknown>) => {
            const roles = (u.roles ?? []) as Array<{
              role: string;
              orgId: string;
            }>;
            return roles.some((r) => r.role === "dpo" && r.orgId === orgId);
          })
          .map((u: Record<string, unknown>) => ({
            id: u.id as string,
            name: (u.name as string) || (u.email as string),
            email: u.email as string,
          }));
        setDpoUsers(users);
      })
      .catch(() => {
        // Non-critical
      });
  }, [orgId]);

  useEffect(() => {
    void fetchOrg();
  }, [fetchOrg]);

  // Save overview
  const handleOverviewSave = async () => {
    setOverviewSaving(true);
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: overviewForm.name.trim(),
          shortName: overviewForm.shortName.trim() || null,
          type: overviewForm.type,
          country: overviewForm.country,
          legalForm: overviewForm.legalForm.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("saved"));
      await fetchOrg();
    } catch {
      toast.error(t("saveError"));
    } finally {
      setOverviewSaving(false);
    }
  };

  // Save GDPR
  const handleGdprSave = async () => {
    setGdprSaving(true);
    try {
      const payload: Record<string, unknown> = {
        isDataController: gdprForm.isDataController,
      };
      if (gdprForm.orgCode.trim() && !orgCodeLocked) {
        payload.orgCode = gdprForm.orgCode.trim();
      }
      if (gdprForm.supervisoryAuthority.trim()) {
        payload.supervisoryAuthority = gdprForm.supervisoryAuthority.trim();
      }
      if (gdprForm.dataResidency) {
        payload.dataResidency = gdprForm.dataResidency;
      }
      if (gdprForm.dpoUserId) {
        payload.dpoUserId = gdprForm.dpoUserId;
      }

      const res = await fetch(`/api/v1/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(tGdpr("saved"));
      await fetchOrg();
    } catch {
      toast.error(tGdpr("saveError"));
    } finally {
      setGdprSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <Link href="/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <AlertCircle size={32} className="mb-2" />
          <p className="text-sm">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link href="/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-blue-50">
          <Building2 size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{t(`types.${org.type}`)}</Badge>
            <Badge
              variant={org.deletedAt ? "destructive" : "outline"}
              className={
                !org.deletedAt
                  ? "bg-green-100 text-green-800 border-green-200"
                  : undefined
              }
            >
              {org.deletedAt ? tStatus("archived") : tStatus("active")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="gdpr">{tGdpr("tabTitle")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("overview")}</CardTitle>
              <CardDescription>{t("overviewDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="ov-name">{t("name")} *</Label>
                  <Input
                    id="ov-name"
                    value={overviewForm.name}
                    onChange={(e) =>
                      setOverviewForm({ ...overviewForm, name: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Short Name */}
                <div className="space-y-2">
                  <Label htmlFor="ov-short">{t("shortName")}</Label>
                  <Input
                    id="ov-short"
                    value={overviewForm.shortName}
                    onChange={(e) =>
                      setOverviewForm({
                        ...overviewForm,
                        shortName: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <Select
                    value={overviewForm.type}
                    onValueChange={(v) =>
                      setOverviewForm({ ...overviewForm, type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "subsidiary",
                          "holding",
                          "joint_venture",
                          "branch",
                        ] as const
                      ).map((orgType) => (
                        <SelectItem key={orgType} value={orgType}>
                          {t(`types.${orgType}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="ov-country">{t("country")}</Label>
                  <Input
                    id="ov-country"
                    value={overviewForm.country}
                    onChange={(e) =>
                      setOverviewForm({
                        ...overviewForm,
                        country: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={3}
                  />
                </div>

                {/* Parent org (read only) */}
                <div className="space-y-2">
                  <Label>{t("parentOrg")}</Label>
                  <Input
                    value={org.parentOrgName ?? t("parentOrgPlaceholder")}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                {/* Legal Form */}
                <div className="space-y-2">
                  <Label htmlFor="ov-legal">{t("legalForm")}</Label>
                  <Input
                    id="ov-legal"
                    value={overviewForm.legalForm}
                    onChange={(e) =>
                      setOverviewForm({
                        ...overviewForm,
                        legalForm: e.target.value,
                      })
                    }
                    placeholder="GmbH, AG, ..."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleOverviewSave}
                  disabled={overviewSaving || !overviewForm.name.trim()}
                >
                  {overviewSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {tActions("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GDPR / Data Privacy Tab */}
        <TabsContent value="gdpr" className="mt-4 space-y-4">
          {/* Info banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800">{tGdpr("gdprInfo")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tGdpr("tabTitle")}</CardTitle>
              <CardDescription>{tGdpr("tabDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Org Code */}
                <div className="space-y-2">
                  <Label htmlFor="gdpr-code">{tGdpr("orgCode")}</Label>
                  <Input
                    id="gdpr-code"
                    value={gdprForm.orgCode}
                    onChange={(e) =>
                      setGdprForm({ ...gdprForm, orgCode: e.target.value })
                    }
                    disabled={orgCodeLocked}
                    className={orgCodeLocked ? "bg-gray-50" : ""}
                    placeholder="ORG-001"
                  />
                  {orgCodeLocked && (
                    <p className="text-xs text-gray-400">
                      {tGdpr("orgCodeLocked")}
                    </p>
                  )}
                </div>

                {/* Data Residency */}
                <div className="space-y-2">
                  <Label>{tGdpr("dataResidency")}</Label>
                  <Select
                    value={gdprForm.dataResidency || "__none__"}
                    onValueChange={(v) =>
                      setGdprForm({
                        ...gdprForm,
                        dataResidency: v === "__none__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tGdpr("selectCountry")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">\u2014</SelectItem>
                      {EU_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Supervisory Authority */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="gdpr-authority">
                    {tGdpr("supervisoryAuthority")}
                  </Label>
                  <Input
                    id="gdpr-authority"
                    value={gdprForm.supervisoryAuthority}
                    onChange={(e) =>
                      setGdprForm({
                        ...gdprForm,
                        supervisoryAuthority: e.target.value,
                      })
                    }
                    placeholder={tGdpr("supervisoryAuthorityPlaceholder")}
                  />
                </div>

                {/* DPO picker */}
                <div className="space-y-2">
                  <Label>{tGdpr("dpoUser")}</Label>
                  <Select
                    value={gdprForm.dpoUserId || "__none__"}
                    onValueChange={(v) =>
                      setGdprForm({
                        ...gdprForm,
                        dpoUserId: v === "__none__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tGdpr("selectDpo")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">\u2014</SelectItem>
                      {dpoUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                      {dpoUsers.length === 0 && (
                        <SelectItem value="__none__" disabled>
                          {tGdpr("noDpoUsers")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {dpoUsers.length === 0 && (
                    <p className="text-xs text-gray-400">
                      {tGdpr("noDpoUsersHint")}
                    </p>
                  )}
                </div>

                {/* Is Data Controller */}
                <div className="space-y-2">
                  <Label>{tGdpr("isDataController")}</Label>
                  <div className="flex items-center gap-3 pt-1">
                    <Switch
                      checked={gdprForm.isDataController}
                      onCheckedChange={(checked) =>
                        setGdprForm({ ...gdprForm, isDataController: checked })
                      }
                    />
                    <span className="text-sm text-gray-600">
                      {gdprForm.isDataController
                        ? tGdpr("isDataControllerYes")
                        : tGdpr("isDataControllerNo")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleGdprSave} disabled={gdprSaving}>
                  {gdprSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {tActions("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
