"use client";

import { useTranslations } from "next-intl";
import { Workflow } from "lucide-react";

export default function ProcessesPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t("processes")}</h1>
      <p className="mt-2 text-sm text-gray-500">
        Business process management and workflow automation.
      </p>
      <div className="mt-6 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
        <div className="text-center">
          <Workflow className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            Coming in Sprint 2
          </p>
        </div>
      </div>
    </div>
  );
}
