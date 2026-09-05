"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calendar, Loader2, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDateFormat } from "@/lib/format-date";
import { ApiRequestError, fetchAllPages } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewSchedule {
  id?: string;
  isActive: boolean;
  reviewIntervalMonths: number;
  nextReviewDate: string;
  assignedReviewerId?: string;
  assignedReviewerName?: string;
  lastReminderSentAt?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProcessReviewConfigProps {
  processId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INTERVAL_OPTIONS = [3, 6, 12, 24, 36, 48, 60];

export function ProcessReviewConfig({ processId }: ProcessReviewConfigProps) {
  const t = useTranslations("processGovernance");
  const { formatDate } = useDateFormat();

  const [schedule, setSchedule] = useState<ReviewSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  // [OP-050] Der Grund, aus dem die Liste leer ist, gehört an die Oberfläche.
  const [usersError, setUsersError] = useState<string | null>(null);

  // Local edit state
  const [isActive, setIsActive] = useState(false);
  const [intervalMonths, setIntervalMonths] = useState(12);
  const [reviewerId, setReviewerId] = useState<string>("");

  // Fetch schedule
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/review-schedule`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as ReviewSchedule | null;
        setSchedule(data);
        if (data) {
          setIsActive(data.isActive);
          setIntervalMonths(data.reviewIntervalMonths);
          setReviewerId(data.assignedReviewerId ?? "");
        }
      }
    } catch {
      // No schedule exists yet — that is fine
    } finally {
      setLoading(false);
    }
  }, [processId]);

  // Nutzerliste für die Prüferauswahl.
  //
  // [ARCTOS-FULL-2026-08-31 · OP-050] Hier stand
  // `fetch("/api/v1/users?limit=200")` in einem `try { … } catch { /* ignore */ }`.
  // `GET /api/v1/users` benutzt `paginate()`, das `limit > 100` seit
  // #NIGHT-059 mit 422 beantwortet — die Auswahl blieb also **immer leer**,
  // und der `catch` hat den einzigen Hinweis darauf verschluckt. Wer eine
  // Prüfung terminieren wollte, fand niemanden, den er als Prüfer eintragen
  // konnte, und bekam keinen Grund genannt.
  const fetchUsers = useCallback(async () => {
    try {
      const rows = await fetchAllPages<Record<string, string>>("/api/v1/users");
      setUsers(
        rows.map((u) => ({
          id: u.id!,
          name: u.name ?? u.email!,
          email: u.email!,
        })),
      );
      setUsersError(null);
    } catch (err) {
      setUsers([]);
      setUsersError(
        err instanceof ApiRequestError
          ? `Prüferliste nicht geladen (${err.status})`
          : "Prüferliste nicht geladen",
      );
    }
  }, []);

  useEffect(() => {
    void fetchSchedule();
    void fetchUsers();
  }, [fetchSchedule, fetchUsers]);

  // Save schedule
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/review-schedule`,
        {
          method: schedule?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive,
            reviewIntervalMonths: intervalMonths,
            assignedReviewerId: reviewerId || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save review schedule");
      toast.success(t("review.saved"));
      void fetchSchedule();
    } catch {
      toast.error("Failed to save review schedule");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw size={16} />
          {t("review.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle active */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            {t("review.enable")}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isActive ? "bg-indigo-600" : "bg-gray-200"
            }`}
            onClick={() => setIsActive(!isActive)}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {isActive && (
          <>
            {/* Interval */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {t("review.interval")}
              </label>
              <Select
                value={String(intervalMonths)}
                onValueChange={(v) => setIntervalMonths(Number(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? "month" : "months"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reviewer */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {t("review.reviewer")}
              </label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/*
                [OP-050] Eine leere Prüferauswahl hiess vorher zweierlei und
                sah einmal aus. Der Fehlerfall sagt es jetzt.
              */}
              {usersError !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {usersError}
                </p>
              )}
            </div>

            {/* Next review date */}
            {schedule?.nextReviewDate && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} />
                <span>{t("review.nextReview")}:</span>
                <span className="font-medium">
                  {formatDate(schedule.nextReviewDate)}
                </span>
              </div>
            )}
          </>
        )}

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="w-full"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {t("review.title")}
        </Button>
      </CardContent>
    </Card>
  );
}
