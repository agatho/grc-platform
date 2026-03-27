"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Shield, AlertTriangle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("identity");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // First validate via break-glass endpoint
      const res = await fetch("/api/v1/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("breakGlassError"));
        setLoading(false);
        return;
      }

      // Then sign in via Auth.js credentials
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("breakGlassCredentialError"));
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError(t("breakGlassError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <Shield className="mx-auto h-8 w-8 text-amber-600" />
          <h1 className="mt-2 text-xl font-bold">{t("breakGlassTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("breakGlassSubtitle")}</p>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">{t("breakGlassWarning")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">
              {t("email")}
            </label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">
              {t("password")}
            </label>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? t("signingIn") : t("breakGlassSignIn")}
          </button>
        </form>

        <div className="text-center">
          <a href="/login" className="text-xs text-gray-500 hover:text-gray-700">
            {t("backToLogin")}
          </a>
        </div>
      </div>
    </div>
  );
}
