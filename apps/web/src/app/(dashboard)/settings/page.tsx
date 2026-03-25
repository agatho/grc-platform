"use client";

import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t("settings")}</h1>
      <p className="mt-2 text-sm text-gray-500">
        Platform settings and configuration will be available here.
      </p>
    </div>
  );
}
