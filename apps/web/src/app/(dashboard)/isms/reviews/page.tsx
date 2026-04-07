"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, CalendarCheck } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ManagementReview, ReviewStatus } from "@grc/shared";

const STATUS_COLORS: Record<ReviewStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

export default function ReviewsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ReviewsInner />
    </ModuleGate>
  );
}

function ReviewsInner() {
  const t = useTranslations("ismsAssessment");
  const router = useRouter();
  const [reviews, setReviews] = useState<ManagementReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/reviews?limit=50");
      if (res.ok) {
        const json = await res.json();
        setReviews(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleCreate = async (formData: { title: string; reviewDate: string; nextReviewDate: string }) => {
    const res = await fetch("/api/v1/isms/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setShowCreate(false);
      void fetchReviews();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("review.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("review.subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} className="mr-1" /> {t("review.create")}
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 space-y-4">
          <CreateReviewForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} t={t} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarCheck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>{t("review.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/isms/reviews/${r.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">{r.title}</h3>
                    <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                      {t(`review.statuses.${r.status}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{t("review.date")}: {r.reviewDate}</span>
                    {r.nextReviewDate && <span>{t("review.nextReview")}: {r.nextReviewDate}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateReviewForm({
  onSubmit,
  onCancel,
  t,
}: {
  onSubmit: (data: { title: string; reviewDate: string; nextReviewDate: string }) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [title, setTitle] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-900">{t("review.create")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t("review.titleField")}</label>
          <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t("review.date")}</label>
          <input type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t("review.nextReview")}</label>
          <input type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("actions.cancel")}</Button>
        <Button size="sm" onClick={() => onSubmit({ title, reviewDate, nextReviewDate })} disabled={!title || !reviewDate}>{t("review.create")}</Button>
      </div>
    </>
  );
}
