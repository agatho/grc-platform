"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";

interface SsoInfo {
  provider: "saml" | "oidc";
  displayName: string;
  enforceSSO: boolean;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("identity");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const orgId = searchParams.get("orgId");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoInfo, setSsoInfo] = useState<SsoInfo | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [checkingSso, setCheckingSso] = useState(true);

  // Check if org has SSO configured
  useEffect(() => {
    async function checkSso() {
      try {
        // Try org from URL or cookie
        const checkOrgId = orgId;
        if (!checkOrgId) {
          setCheckingSso(false);
          return;
        }

        const res = await fetch(`/api/v1/auth/sso/config?orgId=${checkOrgId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.sso) {
            setSsoInfo(json.sso);
          }
        }
      } catch {
        // SSO check failed silently
      } finally {
        setCheckingSso(false);
      }
    }
    checkSso();
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Block local login if SSO is enforced
    if (ssoInfo?.enforceSSO) {
      setError(t("ssoEnforced"));
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("invalidCredentials"));
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  async function handleSsoSignIn() {
    if (!ssoInfo || !orgId) return;
    setSsoLoading(true);
    setError("");

    const endpoint = ssoInfo.provider === "saml"
      ? `/api/v1/auth/sso/saml/login?orgId=${orgId}&callbackUrl=${encodeURIComponent(callbackUrl)}`
      : `/api/v1/auth/sso/oidc/login?orgId=${orgId}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

    window.location.href = endpoint;
  }

  // Also check for legacy Azure AD SSO
  const [legacySsoAvailable, setLegacySsoAvailable] = useState(false);
  useEffect(() => {
    async function checkProviders() {
      try {
        const res = await fetch("/api/auth/providers");
        if (res.ok) {
          const providers = await res.json();
          setLegacySsoAvailable("microsoft-entra-id" in providers);
        }
      } catch {
        // Silently ignore
      }
    }
    if (!ssoInfo) checkProviders();
  }, [ssoInfo]);

  async function handleLegacySsoSignIn() {
    setSsoLoading(true);
    setError("");
    await signIn("microsoft-entra-id", { callbackUrl });
  }

  return (
    <div className="space-y-4">
      {/* Enterprise SSO Button */}
      {ssoInfo && (
        <>
          <button
            type="button"
            onClick={handleSsoSignIn}
            disabled={ssoLoading}
            className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Shield className="mr-2 h-4 w-4" />
            {ssoLoading
              ? t("redirecting")
              : `${t("loginWith")} ${ssoInfo.displayName}`}
          </button>

          {!ssoInfo.enforceSSO && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">{t("or")}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Legacy Azure AD SSO */}
      {!ssoInfo && legacySsoAvailable && (
        <>
          <button
            type="button"
            onClick={handleLegacySsoSignIn}
            disabled={ssoLoading}
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {ssoLoading ? t("redirecting") : t("signInWithMicrosoft")}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">{t("or")}</span>
            </div>
          </div>
        </>
      )}

      {/* Local Login (hidden when SSO enforced) */}
      {(!ssoInfo || !ssoInfo.enforceSSO) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>
      )}

      {/* SSO Enforced: show break-glass link */}
      {ssoInfo?.enforceSSO && (
        <div className="text-center">
          <a
            href="/admin-login"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t("adminEmergencyAccess")}
          </a>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const t = useTranslations("identity");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">ARCTOS</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("loginSubtitle")}
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
