"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Copy,
  Check,
  Key,
  Trash2,
  ExternalLink,
  Calendar,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CalendarSettingsPage() {
  const t = useTranslations("calendarSettings");
  const [loading, setLoading] = useState(false);
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [icalToken, setIcalToken] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);

  // ──────────────────────────────────────────────────────────
  // Generate Token
  // ──────────────────────────────────────────────────────────
  const generateToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/calendar/ical/generate-token", {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setIcalToken(json.data.icalToken);
        setIcalUrl(json.data.icalUrl);
        setTokenCreatedAt(json.data.createdAt);
        setJustGenerated(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Revoke Token
  // ──────────────────────────────────────────────────────────
  const revokeToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/calendar/ical/revoke-token", {
        method: "DELETE",
      });
      if (res.ok) {
        setIcalToken(null);
        setIcalUrl(null);
        setTokenCreatedAt(null);
        setJustGenerated(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Copy URL to clipboard
  // ──────────────────────────────────────────────────────────
  async function copyToClipboard() {
    if (!icalUrl) return;
    await navigator.clipboard.writeText(icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      {/* iCal Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>{t("icalSubscription")}</CardTitle>
          </div>
          <CardDescription>{t("icalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {icalUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input value={icalUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {justGenerated && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-800">
                    <Shield className="h-4 w-4" />
                    {t("tokenWarning")}
                  </div>
                  <p className="mt-1 text-amber-700">{t("tokenWarningDetail")}</p>
                </div>
              )}
              {tokenCreatedAt && (
                <div className="text-sm text-muted-foreground">
                  {t("tokenCreated")}: {new Date(tokenCreatedAt).toLocaleDateString()}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={generateToken} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Key className="h-4 w-4 mr-2" />
                  {t("regenerateToken")}
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" disabled={loading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("revokeToken")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("revokeConfirmTitle")}</DialogTitle>
                      <DialogDescription>{t("revokeConfirmDescription")}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">{t("cancel")}</Button>
                      <Button variant="destructive" onClick={revokeToken}>{t("revokeConfirm")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("noTokenYet")}</p>
              <Button onClick={generateToken} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Key className="h-4 w-4 mr-2" />
                {t("generateToken")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("setupInstructions")}</CardTitle>
          <CardDescription>{t("setupDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Outlook */}
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {t("outlookSetup")}
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>{t("outlookStep1")}</li>
              <li>{t("outlookStep2")}</li>
              <li>{t("outlookStep3")}</li>
              <li>{t("outlookStep4")}</li>
            </ol>
          </div>

          {/* Google Calendar */}
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              {t("googleSetup")}
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>{t("googleStep1")}</li>
              <li>{t("googleStep2")}</li>
              <li>{t("googleStep3")}</li>
              <li>{t("googleStep4")}</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
