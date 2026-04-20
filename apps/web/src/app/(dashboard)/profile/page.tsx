"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const t = useTranslations("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(session?.user?.name ?? "");
  const [language, setLanguage] = useState(
    (session?.user as any)?.language ?? "de",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch(`/api/v1/users/${session?.user?.id}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      await update();
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("email")}
          </label>
          <input
            type="email"
            value={session?.user?.email ?? ""}
            disabled
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>

        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("name")}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Language */}
        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("language")}
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="de">{t("languages.de")}</option>
            <option value="en">{t("languages.en")}</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {saving ? "..." : t("save")}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              {t("saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
