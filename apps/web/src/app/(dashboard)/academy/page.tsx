"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  BookOpen,
  GraduationCap,
  Award,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";

interface DashboardData {
  totalCourses: number;
  mandatoryCourses: number;
  activeCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  overdueEnrollments: number;
  inProgressEnrollments: number;
  avgProgressPct: number;
  totalCertificates: number;
  completionRate: number;
}

export default function AcademyPage() {
  return (
    <ModuleGate moduleKey="academy">
      <AcademyDashboard />
    </ModuleGate>
  );
}

function AcademyDashboard() {
  const t = useTranslations("academy");
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/academy/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const d = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<BookOpen className="h-5 w-5 text-blue-600" />}
          label={t("activeCourses")}
          value={String(d?.activeCourses ?? 0)}
          onClick={() => router.push("/academy/courses")}
        />
        <KpiCard
          icon={<GraduationCap className="h-5 w-5 text-green-600" />}
          label={t("completionRate")}
          value={`${d?.completionRate ?? 0}%`}
          onClick={() => router.push("/academy/enrollments")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("overdue")}
          value={String(d?.overdueEnrollments ?? 0)}
          highlight={(d?.overdueEnrollments ?? 0) > 0}
          onClick={() => router.push("/academy/enrollments")}
        />
        <KpiCard
          icon={<Award className="h-5 w-5 text-yellow-600" />}
          label={t("certificatesIssued")}
          value={String(d?.totalCertificates ?? 0)}
          onClick={() => router.push("/academy/certificates")}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Clock className="h-5 w-5 text-purple-600" />}
          label={t("inProgress")}
          value={String(d?.inProgressEnrollments ?? 0)}
        />
        <KpiCard
          icon={<BookOpen className="h-5 w-5 text-orange-600" />}
          label={t("mandatoryCourses")}
          value={String(d?.mandatoryCourses ?? 0)}
        />
        <KpiCard
          icon={<GraduationCap className="h-5 w-5 text-teal-600" />}
          label={t("totalEnrollments")}
          value={String(d?.totalEnrollments ?? 0)}
        />
        <KpiCard
          icon={<BookOpen className="h-5 w-5 text-indigo-600" />}
          label={t("avgProgress")}
          value={`${d?.avgProgressPct ?? 0}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <NavCard
          href="/academy/courses"
          label={t("courses.title")}
          description={t("courses.description")}
        />
        <NavCard
          href="/academy/enrollments"
          label={t("enrollments.title")}
          description={t("enrollments.description")}
        />
        <NavCard
          href="/academy/certificates"
          label={t("certificates.title")}
          description={t("certificates.description")}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left hover:shadow-sm transition-shadow w-full ${highlight ? "border-red-300 bg-red-50" : "border-gray-200"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold ${highlight ? "text-red-700" : "text-gray-900"}`}
      >
        {value}
      </p>
    </button>
  );
}

function NavCard({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
    >
      <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </Link>
  );
}
