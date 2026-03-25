"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationPreferences {
  emailMode: "immediate" | "daily_digest" | "disabled";
  digestTime: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailMode: "immediate",
  digestTime: "07:00",
  quietHoursStart: null,
  quietHoursEnd: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationSettingsPage() {
  const t = useTranslations("settings.notifications");
  const tActions = useTranslations("actions");

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/users/me/notification-preferences");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const data = json.data ?? json;
      setPrefs({
        emailMode: data.emailMode ?? "immediate",
        digestTime: data.digestTime ?? "07:00",
        quietHoursStart: data.quietHoursStart ?? null,
        quietHoursEnd: data.quietHoursEnd ?? null,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrefs();
  }, [fetchPrefs]);

  // Save preferences
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/users/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailMode: prefs.emailMode,
          digestTime: prefs.digestTime,
          quietHoursStart: prefs.quietHoursStart || null,
          quietHoursEnd: prefs.quietHoursEnd || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Bell size={32} className="mb-2" />
          <p className="text-sm">{t("loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={fetchPrefs}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* Email Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("emailMode")}</CardTitle>
          <CardDescription>{t("emailModeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={prefs.emailMode}
            onValueChange={(v) =>
              setPrefs({
                ...prefs,
                emailMode: v as NotificationPreferences["emailMode"],
              })
            }
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">{t("immediate")}</SelectItem>
              <SelectItem value="daily_digest">{t("dailyDigest")}</SelectItem>
              <SelectItem value="disabled">{t("disabled")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Digest Time */}
      {prefs.emailMode === "daily_digest" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("digestTime")}</CardTitle>
            <CardDescription>{t("digestTimeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="time"
              value={prefs.digestTime}
              onChange={(e) =>
                setPrefs({ ...prefs, digestTime: e.target.value })
              }
              className="w-full max-w-xs"
            />
          </CardContent>
        </Card>
      )}

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("quietHours")}</CardTitle>
          <CardDescription>{t("quietHoursDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div className="space-y-2">
              <Label htmlFor="quiet-start">{t("quietStart")}</Label>
              <Input
                id="quiet-start"
                type="time"
                value={prefs.quietHoursStart ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHoursStart: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-end">{t("quietEnd")}</Label>
              <Input
                id="quiet-end"
                type="time"
                value={prefs.quietHoursEnd ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHoursEnd: e.target.value || null,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
