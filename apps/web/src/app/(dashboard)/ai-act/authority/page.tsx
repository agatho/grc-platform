"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Auch diese Seite galt der
 * Ratsche als uebersetzt — `const _t = useTranslations("aiAct")`, nie
 * benutzt — und stand vollstaendig auf fest verdrahtetem Deutsch mit
 * abgeschnittenen Umlauten („Behordenkommunikation", „Behorde").
 *
 * `getDeadlineInfo` ist eine Funktion, keine Komponente, und darf deshalb
 * keinen Hook lesen; sie nimmt die Uebersetzungsfunktion als Parameter.
 */

/** Die Uebersetzungsfunktion, wie sie `getDeadlineInfo` braucht. */
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

interface AuthorityCommunication {
  id: string;
  authority_name: string;
  subject: string;
  direction: string;
  communication_date: string;
  response_deadline: string | null;
  content: string | null;
  status: string;
  created_at: string;
}

function getDeadlineInfo(deadline: string | null, t: Translate) {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 0)
    return (
      <Badge className="bg-red-600 text-white">
        <Clock className="h-3 w-3 mr-1" />
        {t("authority.deadlineExpired")}
      </Badge>
    );
  if (diffDays < 3)
    return (
      <Badge className="bg-red-100 text-red-900">
        <Clock className="h-3 w-3 mr-1" />
        {t("authority.daysRemainingShort", { days: diffDays })}
      </Badge>
    );
  return (
    <Badge className="bg-yellow-100 text-yellow-900">
      <Clock className="h-3 w-3 mr-1" />
      {t("authority.daysRemaining", { days: diffDays })}
    </Badge>
  );
}

function AuthorityPageInner() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  const [rows, setRows] = useState<AuthorityCommunication[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    authority_name: "",
    subject: "",
    direction: "outgoing",
    communication_date: "",
    response_deadline: "",
    content: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/authority?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    const payload = {
      ...form,
      communication_date: form.communication_date || null,
      response_deadline: form.response_deadline || null,
      content: form.content || null,
    };
    const res = await fetch("/api/v1/ai-act/authority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({
        authority_name: "",
        subject: "",
        direction: "outgoing",
        communication_date: "",
        response_deadline: "",
        content: "",
      });
      void fetchData();
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("authority.title")}</h1>
          <p className="text-muted-foreground">{t("authority.description")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("authority.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("authority.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("penalties.authority")}</Label>
                <Input
                  value={form.authority_name}
                  onChange={(e) =>
                    setForm({ ...form, authority_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("authority.subject")}</Label>
                <Input
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("authority.direction")}</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => setForm({ ...form, direction: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outgoing">
                      {t("authority.outgoing")}
                    </SelectItem>
                    <SelectItem value="incoming">
                      {t("authority.incoming")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("authority.date")}</Label>
                <Input
                  type="date"
                  value={form.communication_date}
                  onChange={(e) =>
                    setForm({ ...form, communication_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("authority.responseDeadline")}</Label>
                <Input
                  type="date"
                  value={form.response_deadline}
                  onChange={(e) =>
                    setForm({ ...form, response_deadline: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("authority.content")}</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.authority_name || !form.subject}
              >
                {tCommon("actions.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {/* Timeline-style list */}
      <div className="relative border-l-2 border-muted ml-4 space-y-4">
        {rows.map((c) => (
          <div key={c.id} className="relative pl-6">
            <div className="absolute -left-[9px] top-4 h-4 w-4 rounded-full border-2 border-primary bg-background" />
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.direction === "outgoing" ? (
                      <ArrowUpRight className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-green-600" />
                    )}
                    <p className="font-medium">{c.subject}</p>
                  </div>
                  <div className="flex gap-2">
                    {c.response_deadline &&
                      getDeadlineInfo(c.response_deadline, t)}
                    <Badge variant="outline">
                      {c.direction === "outgoing"
                        ? t("authority.outgoing")
                        : t("authority.incoming")}
                    </Badge>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {c.authority_name} |{" "}
                  {c.communication_date ? formatDate(c.communication_date) : ""}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8 pl-6">
            {t("authority.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AuthorityPage() {
  return (
    <ModuleGate moduleKey="isms">
      <AuthorityPageInner />
    </ModuleGate>
  );
}
