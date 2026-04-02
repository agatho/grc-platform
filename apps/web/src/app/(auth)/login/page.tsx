"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Shield, ShieldCheck, Lock, BarChart3 } from "lucide-react";
import { motion } from "motion/react";

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
    <div className="space-y-5">
      {/* Enterprise SSO Button */}
      {ssoInfo && (
        <>
          <button
            type="button"
            onClick={handleSsoSignIn}
            disabled={ssoLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            {ssoLoading
              ? t("redirecting")
              : `${t("loginWith")} ${ssoInfo.displayName}`}
          </button>

          {!ssoInfo.enforceSSO && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white px-3 text-gray-400">{t("or")}</span>
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {ssoLoading ? t("redirecting") : t("signInWithMicrosoft")}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-white px-3 text-gray-400">{t("or")}</span>
            </div>
          </div>
        </>
      )}

      {/* Local Login (hidden when SSO enforced) */}
      {(!ssoInfo || !ssoInfo.enforceSSO) && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-inner ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 transition-all focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:outline-none"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="block w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-inner ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 transition-all focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-white animate-[pulse_1s_ease-in-out_0ms_infinite]" />
                  <span className="h-1 w-1 rounded-full bg-white animate-[pulse_1s_ease-in-out_150ms_infinite]" />
                  <span className="h-1 w-1 rounded-full bg-white animate-[pulse_1s_ease-in-out_300ms_infinite]" />
                </span>
                {t("signingIn")}
              </span>
            ) : t("signIn")}
          </button>
        </form>
      )}

      {/* SSO Enforced: show break-glass link */}
      {ssoInfo?.enforceSSO && (
        <div className="text-center pt-2">
          <a
            href="/admin-login"
            className="text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            {t("adminEmergencyAccess")}
          </a>
        </div>
      )}
    </div>
  );
}

function FeatureItem({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
        <Icon className="h-4.5 w-4.5 text-blue-200" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-blue-200/70 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const t = useTranslations("identity");

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="relative hidden w-[45%] overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 lg:flex lg:flex-col lg:justify-between p-12">
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Radial glow */}
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Top: Logo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">ARCTOS</span>
          </div>
        </motion.div>

        {/* Middle: Tagline + features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative space-y-8"
        >
          <div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              {t("loginSubtitle")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-blue-200/60 max-w-sm">
              {t("loginBrandingDescription")}
            </p>
          </div>

          <div className="space-y-4">
            <FeatureItem
              icon={ShieldCheck}
              title={t("featureCompliance")}
              description={t("featureComplianceDesc")}
            />
            <FeatureItem
              icon={Lock}
              title={t("featureSecurity")}
              description={t("featureSecurityDesc")}
            />
            <FeatureItem
              icon={BarChart3}
              title={t("featureAnalytics")}
              description={t("featureAnalyticsDesc")}
            />
          </div>
        </motion.div>

        {/* Bottom: Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative"
        >
          <p className="text-xs text-blue-300/40">
            {t("loginFooter")}
          </p>
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
              <ShieldCheck className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">ARCTOS</span>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/60 ring-1 ring-gray-100">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">{t("signIn")}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t("loginFormSubtitle")}
              </p>
            </div>

            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            {t("loginFooter")}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
