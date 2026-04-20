"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, BookOpen, Clock, CheckCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";

interface CourseDetail {
  id: string;
  courseType: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingScorePct: number;
  isMandatory: boolean;
  isActive: boolean;
  language: string;
  version: number;
}

interface Lesson {
  id: string;
  title: string;
  lessonType: string;
  durationMinutes: number;
  sortOrder: number;
}

export default function CourseDetailPage() {
  return (
    <ModuleGate moduleKey="academy">
      <CourseDetail />
    </ModuleGate>
  );
}

function CourseDetail() {
  const t = useTranslations("academy");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, lRes] = await Promise.all([
        fetch(`/api/v1/academy/courses/${id}`),
        fetch(`/api/v1/academy/lessons?courseId=${id}`),
      ]);
      if (cRes.ok) setCourse((await cRes.json()).data);
      if (lRes.ok) setLessons((await lRes.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  if (!course)
    return (
      <div className="text-center py-12 text-gray-400">{t("notFound")}</div>
    );

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> {t("backToCourses")}
      </button>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          {course.isMandatory && (
            <Badge className="bg-red-100 text-red-800">{t("mandatory")}</Badge>
          )}
          <Badge variant="outline">
            {course.courseType.replace(/_/g, " ")}
          </Badge>
        </div>
        {course.description && (
          <p className="text-sm text-gray-500 mt-2">{course.description}</p>
        )}
        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={14} /> {course.durationMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle size={14} /> {t("passingScore")}:{" "}
            {course.passingScorePct}%
          </span>
          <span>
            {t("version")}: {course.version}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold mb-4">
          {t("lessons.title")} ({lessons.length})
        </h2>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-400">{t("lessons.empty")}</p>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson, i) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between rounded border border-gray-100 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                  <BookOpen size={14} className="text-gray-400" />
                  <span className="text-sm font-medium">{lesson.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {lesson.lessonType}
                  </Badge>
                </div>
                <span className="text-xs text-gray-400">
                  {lesson.durationMinutes} min
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
