"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Settings, Globe } from "lucide-react";

const LANGUAGES = [
  { code: "de", label: "DE" },
  { code: "en", label: "EN" },
] as const;

export function UserMenu() {
  const { data: session, update } = useSession();
  const t = useTranslations("profile");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingLang, setSwitchingLang] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLanguage = (session?.user as any)?.language ?? "de";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLanguageSwitch = useCallback(
    async (lang: string) => {
      if (lang === currentLanguage || switchingLang || !session?.user?.id) return;
      setSwitchingLang(true);
      try {
        const res = await fetch(`/api/v1/users/${session.user.id}/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: lang }),
        });
        if (res.ok) {
          // Refresh the session so the JWT picks up the new language
          await update();
          // Full page refresh to reload next-intl messages from the new locale cookie
          router.refresh();
        }
      } catch {
        // Silently fail — the user can retry
      } finally {
        setSwitchingLang(false);
      }
    },
    [currentLanguage, switchingLang, session?.user?.id, update, router],
  );

  const initials = (session?.user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="User menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
          {initials}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <User size={14} />
            <span>{t("title")}</span>
          </Link>

          {/* Language switcher */}
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700">
            <Globe size={14} className="shrink-0" />
            <span className="mr-auto">{t("language")}</span>
            <div className="flex rounded-md border border-gray-200 overflow-hidden">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => handleLanguageSwitch(code)}
                  disabled={switchingLang}
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                    currentLanguage === code
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  } ${switchingLang ? "opacity-50 cursor-not-allowed" : ""}`}
                  aria-label={t(`languages.${code}`)}
                  aria-pressed={currentLanguage === code}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Settings size={14} />
            <span>Settings</span>
          </Link>

          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={14} />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
