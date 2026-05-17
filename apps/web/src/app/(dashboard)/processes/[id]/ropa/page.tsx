"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RopaProfile {
  isProcessingActivity: boolean;
  processingPurpose: string | null;
  legalBasis: string | null;
  legalBasisDetail: string | null;
  dataSubjectCategories: string[] | null;
  personalDataCategories: string[] | null;
  specialCategories: string[] | null;
  recipients: string[] | null;
  thirdCountryTransfers: boolean;
  thirdCountrySafeguards: string | null;
  retentionPeriodDescription: string | null;
  retentionPeriodMonths: number | null;
  tomDescription: string | null;
  requiresDpia: boolean;
  dpiaTriggerReason: string | null;
}

const empty: RopaProfile = {
  isProcessingActivity: false,
  processingPurpose: "",
  legalBasis: null,
  legalBasisDetail: "",
  dataSubjectCategories: [],
  personalDataCategories: [],
  specialCategories: [],
  recipients: [],
  thirdCountryTransfers: false,
  thirdCountrySafeguards: "",
  retentionPeriodDescription: "",
  retentionPeriodMonths: null,
  tomDescription: "",
  requiresDpia: false,
  dpiaTriggerReason: "",
};

function csvField(v: string[] | null | undefined): string {
  return (v ?? []).join(", ");
}

function parseCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function RopaProfilePage() {
  const params = useParams<{ id: string }>();
  const processId = params?.id ?? "";
  const [profile, setProfile] = useState<RopaProfile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const resp = await fetch(`/api/v1/processes/${processId}/ropa-profile`);
    if (resp.ok) {
      const j = await resp.json();
      if (j.data) setProfile({ ...empty, ...j.data });
    }
    setLoading(false);
  }, [processId]);

  useEffect(() => {
    if (processId) reload();
  }, [processId, reload]);

  const save = useCallback(async () => {
    setSaving(true);
    const resp = await fetch(`/api/v1/processes/${processId}/ropa-profile`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (resp.ok) {
      toast.success("ROPA profile saved");
      reload();
    } else {
      const e = await resp.json().catch(() => ({}));
      toast.error(e.error ?? "Save failed");
    }
    setSaving(false);
  }, [processId, profile, reload]);

  if (loading) {
    return <Loader2 className="mx-auto mt-12 h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-4 p-4">
        <Link
          href={`/processes/${processId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to process
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>GDPR Art. 30 — ROPA Profile</CardTitle>
            <CardDescription>
              Record of processing activity for this process. Auto-flags DPIA when high-risk
              indicators are present.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={profile.isProcessingActivity}
                onCheckedChange={(v) =>
                  setProfile({ ...profile, isProcessingActivity: v })
                }
              />
              <Label>This process is a personal-data processing activity</Label>
            </div>

            {profile.isProcessingActivity && (
              <>
                <Field label="Processing purpose">
                  <Textarea
                    value={profile.processingPurpose ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, processingPurpose: e.target.value })
                    }
                  />
                </Field>

                <Field label="Legal basis (Art. 6)">
                  <Select
                    value={profile.legalBasis ?? ""}
                    onValueChange={(v) => setProfile({ ...profile, legalBasis: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose legal basis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consent">Consent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="legal_obligation">Legal obligation</SelectItem>
                      <SelectItem value="vital_interest">Vital interest</SelectItem>
                      <SelectItem value="public_interest">Public interest</SelectItem>
                      <SelectItem value="legitimate_interest">Legitimate interest</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Legal basis detail">
                  <Textarea
                    value={profile.legalBasisDetail ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, legalBasisDetail: e.target.value })
                    }
                  />
                </Field>

                <Field label="Data subject categories (comma-separated)">
                  <Input
                    value={csvField(profile.dataSubjectCategories)}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        dataSubjectCategories: parseCsv(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field label="Personal data categories (comma-separated)">
                  <Input
                    value={csvField(profile.personalDataCategories)}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        personalDataCategories: parseCsv(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field label="Special categories — Art. 9 (comma-separated)">
                  <Input
                    value={csvField(profile.specialCategories)}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        specialCategories: parseCsv(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field label="Recipients (comma-separated)">
                  <Input
                    value={csvField(profile.recipients)}
                    onChange={(e) =>
                      setProfile({ ...profile, recipients: parseCsv(e.target.value) })
                    }
                  />
                </Field>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={profile.thirdCountryTransfers}
                    onCheckedChange={(v) =>
                      setProfile({ ...profile, thirdCountryTransfers: v })
                    }
                  />
                  <Label>Transfers to third countries / international organisations</Label>
                </div>

                {profile.thirdCountryTransfers && (
                  <Field label="Safeguards (SCC, BCR, Adequacy Decision)">
                    <Textarea
                      value={profile.thirdCountrySafeguards ?? ""}
                      onChange={(e) =>
                        setProfile({ ...profile, thirdCountrySafeguards: e.target.value })
                      }
                    />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Retention period (description)">
                    <Input
                      value={profile.retentionPeriodDescription ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          retentionPeriodDescription: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Retention period (months)">
                    <Input
                      type="number"
                      value={profile.retentionPeriodMonths ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          retentionPeriodMonths: e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        })
                      }
                    />
                  </Field>
                </div>

                <Field label="Technical & organisational measures (TOMs)">
                  <Textarea
                    value={profile.tomDescription ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, tomDescription: e.target.value })
                    }
                  />
                </Field>

                {(profile.specialCategories?.length ?? 0) > 0 ||
                profile.thirdCountryTransfers ? (
                  <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <div>
                      <strong>DPIA likely required</strong> based on special data categories or
                      third-country transfers (Art. 35 GDPR).
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </div>
      </div>
    </ModuleGate>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
