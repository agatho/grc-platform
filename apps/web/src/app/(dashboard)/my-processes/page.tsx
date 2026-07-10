"use client";

// Process-Portal (Endanwender): "Meine Prozesse" — published processes
// in which the logged-in user has a role (owner / RACI) or an open
// acknowledgment. UX modelled on /my-policies.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCcw,
  Search,
  User,
  Workflow,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDateFormat } from "@/lib/format-date";
import type { MyProcessRole } from "@/lib/process-portal-roles";

interface MyProcessItem {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  currentVersion: number;
  publishedAt: string | null;
  ownerName: string | null;
  myRoles: MyProcessRole[];
  acknowledgment: {
    stepId: string;
    status: string;
    dueDate: string | null;
    decidedAt: string | null;
  } | null;
}

function hasPendingAcknowledgment(item: MyProcessItem): boolean {
  return (
    item.acknowledgment !== null && item.acknowledgment.status !== "completed"
  );
}

export default function MyProcessesPage() {
  const t = useTranslations("processPortal");
  const [items, setItems] = useState<MyProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bpm/my-processes");
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        (item.department ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  // A process with a pending acknowledgment only shows in the prominent
  // top group (its card carries the role badges too) — no duplicates.
  const pendingAck = filtered.filter(hasPendingAcknowledgment);
  const myProcesses = filtered.filter(
    (item) => !hasPendingAcknowledgment(item),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ModuleGate moduleKey="bpm">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Pending acknowledgments — prominent on top */}
        {pendingAck.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-600">
                {t("pendingAcknowledgment")}
              </h2>
              <Badge className="bg-amber-100 text-amber-800">
                {pendingAck.length}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pendingAck.map((item) => (
                <ProcessCard key={`ack-${item.id}`} item={item} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* My processes */}
        {myProcesses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{t("myProcesses")}</h2>
              <Badge variant="secondary">{myProcesses.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {myProcesses.map((item) => (
                <ProcessCard key={item.id} item={item} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <Workflow className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {search ? t("noResults") : t("empty")}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? t("noResultsDesc") : t("emptyDesc")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ModuleGate>
  );
}

function ProcessCard({
  item,
  t,
}: {
  item: MyProcessItem;
  t: ReturnType<typeof useTranslations>;
}) {
  const { formatDate } = useDateFormat();
  const pending = hasPendingAcknowledgment(item);
  const dueDate = item.acknowledgment?.dueDate
    ? new Date(item.acknowledgment.dueDate)
    : null;
  const overdue = pending && dueDate !== null && dueDate.getTime() < Date.now();

  return (
    <Link href={`/my-processes/${item.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
              {item.name}
            </div>
          </CardTitle>
          <CardDescription>
            v{item.currentVersion}
            {item.department ? ` · ${item.department}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.myRoles.map((role) => (
              <Badge
                key={role}
                variant={role === "owner" ? "default" : "outline"}
              >
                {t(`roles.${role}`)}
              </Badge>
            ))}
            {!pending &&
              item.acknowledgment?.status === "completed" && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {t("acknowledged")}
                </Badge>
              )}
          </div>
          {item.ownerName && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {item.ownerName}
            </p>
          )}
          {pending && (
            <p
              className={`text-sm font-medium ${
                overdue ? "text-red-600" : "text-amber-600"
              }`}
            >
              {overdue ? t("ackOverdue") : t("ackPendingShort")}
              {dueDate && (
                <span className="ml-1">
                  ({t("dueBy")} {formatDate(dueDate)})
                </span>
              )}
            </p>
          )}
          {pending && (
            <Button size="sm" className="w-full mt-2" variant="secondary">
              {t("openAndAcknowledge")}
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
