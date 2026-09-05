/**
 * Trust Center — public compliance status page for /trust/{orgCode}.
 *
 * [ARCTOS-FULL-2026-08-31 / WP12 · S12-05] Two defects sat on top of each
 * other here, and the second is the reason the first cannot simply be undone:
 *
 *  A) The page is NOT reachable. `/trust` is absent from the middleware
 *     allowlist (`packages/auth/src/rbac.ts`, PUBLIC_EXACT_PATHS /
 *     PUBLIC_PREFIXES), and the matcher covers `/trust/*` — an anonymous
 *     GET is redirected to `/login?callbackUrl=/trust/ACME`. That file is
 *     WP3's; the allowlist entry is handed over in
 *     /work/audit/remediation/WP12.md.
 *
 *  B) As a React Server Component this page never runs through `withAuth()`
 *     and therefore never through `establishRequestScopedContext()`. The `db`
 *     proxy fell back to the base pool, which by construction never carries an
 *     `app.current_org_id`. Under the production role `grc_app` the RLS
 *     policies on `org_active_catalog` and `module_config` then matched
 *     nothing, so the page rendered "0 aktive Frameworks · 0 Sicherheitsmodule"
 *     under a green "Compliance-Status: Aktiv" tile. Under the DEV
 *     configuration (`APP_DATABASE_URL` unset → superuser `grc`) the very same
 *     code returned complete data for ANY orgCode — which is why no test would
 *     ever have shown the defect, and which would have become an
 *     unauthenticated cross-tenant read the moment (A) was fixed.
 *
 * (B) is fixed here: every query runs inside `withOrgReadContext(org.id, …)`,
 * so the page behaves identically under `grc_app` and under the dev superuser,
 * and reads exactly one organisation's rows by construction. This is the
 * precondition for (A) — adding `/trust` to the allowlist before this would
 * have exposed every organisation of the installation without a login.
 *
 * The status tile no longer claims "Aktiv" regardless of content (see below).
 *
 * [ARCTOS-FULL-2026-08-31 · OP-070] Diese Seite ist die oeffentliche
 * Selbstauskunft einer Organisation gegenueber ihren Kunden und Partnern —
 * genau die Leserschaft, die am wenigsten zwingend Deutsch spricht. Sie stand
 * vollstaendig auf Deutsch.
 *
 * Ein zweiter Mangel steckte in den DATEN, nicht im Text: die Modulnamen
 * wurden als `displayNameDe ?? displayNameEn` gerendert. Das Schema fuehrt
 * beide Spalten, die deutsche gewann aber immer — die englische Bezeichnung
 * war in der Datenbank vorhanden und unerreichbar. Jetzt entscheidet das
 * Gebietsschema, welche Spalte fuehrt, mit der jeweils anderen als Rueckfall.
 */
import {
  db,
  withOrgReadContext,
  organization,
  orgActiveCatalog,
  catalog,
  moduleConfig,
  moduleDefinition,
} from "@grc/db";
import { eq, and } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Shield,
  CheckCircle2,
  BookOpen,
  Lock,
  Globe,
  FileText,
  Clock,
} from "lucide-react";

interface Props {
  params: Promise<{ orgCode: string }>;
}

export default async function TrustCenterPage({ params }: Props) {
  const { orgCode } = await params;
  const t = await getTranslations("trust");
  const locale = await getLocale();

  // Find org by short name (used as public URL slug)
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      shortName: organization.shortName,
    })
    .from(organization)
    .where(eq(organization.shortName, orgCode));

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield
            className="h-12 w-12 text-gray-500 mx-auto mb-4"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            {t("notFoundTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">{t("notFoundBody")}</p>
        </div>
      </div>
    );
  }

  // [WP12 · S12-05 B] Both queries run under an explicit org context on a
  // reserved connection. Without it the base pool carries no
  // `app.current_org_id`, RLS matched no rows under `grc_app`, and the dev
  // superuser matched ALL rows — the two environments disagreed silently.
  const { activeCatalogs, modules } = await withOrgReadContext(
    org.id,
    async (scopedDb) => ({
      activeCatalogs: await scopedDb
        .select({
          catalogName: catalog.name,
          catalogType: catalog.catalogType,
          source: catalog.source,
          enforcementLevel: orgActiveCatalog.enforcementLevel,
          activatedAt: orgActiveCatalog.activatedAt,
        })
        .from(orgActiveCatalog)
        .innerJoin(catalog, eq(orgActiveCatalog.catalogId, catalog.id))
        .where(eq(orgActiveCatalog.orgId, org.id)),
      modules: await scopedDb
        .select({
          moduleKey: moduleConfig.moduleKey,
          displayNameDe: moduleDefinition.displayNameDe,
          displayNameEn: moduleDefinition.displayNameEn,
        })
        .from(moduleConfig)
        .innerJoin(
          moduleDefinition,
          eq(moduleConfig.moduleKey, moduleDefinition.moduleKey),
        )
        .where(
          and(
            eq(moduleConfig.orgId, org.id),
            eq(moduleConfig.uiStatus, "enabled"),
          ),
        ),
    }),
  );

  const certifications = activeCatalogs.filter(
    (c) => c.enforcementLevel === "mandatory",
  );
  const recommendedFrameworks = activeCatalogs.filter(
    (c) => c.enforcementLevel !== "mandatory",
  );
  // S12-05: "active" is a claim about data, not a constant.
  const hasPublishedStatus = activeCatalogs.length > 0 || modules.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Shield className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              <p className="text-sm text-gray-500">{t("subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Overview Badge — [WP12 · S12-05] the tile used to read
            "Compliance-Status: Aktiv" on a green background even when both
            counts were zero, which is the most misleading possible rendering
            of "we have no data". The wording follows the numbers now. */}
        {hasPublishedStatus ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2
                className="h-6 w-6 text-green-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-lg font-semibold text-green-900">
                  {t("statusActive")}
                </p>
                <p className="text-sm text-green-700 mt-0.5">
                  {t("statusCounts", {
                    frameworks: String(activeCatalogs.length),
                    modules: String(modules.length),
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="rounded-xl bg-gray-50 border border-gray-200 p-6"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-gray-600" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {t("statusEmptyTitle")}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {t("statusEmptyBody")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Certifications / Mandatory Frameworks */}
        {certifications.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" aria-hidden="true" />
              {t("certifications")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certifications.map((cert, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-blue-200 bg-blue-50/50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 text-blue-600 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-gray-900">
                      {cert.catalogName}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    {t("source", { source: cert.source })}
                  </p>
                  {cert.activatedAt && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-6 flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t("activatedOn", {
                        date: new Date(cert.activatedAt).toLocaleDateString(
                          locale,
                        ),
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Frameworks */}
        {recommendedFrameworks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen
                className="h-5 w-5 text-indigo-600"
                aria-hidden="true"
              />
              {t("frameworks")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendedFrameworks.map((fw, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {fw.catalogName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {fw.catalogType} · {fw.source}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Enabled Security Modules */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-teal-600" aria-hidden="true" />
            {t("modules")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {modules.map((mod) => (
              <span
                key={mod.moduleKey}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200"
              >
                {(locale === "de"
                  ? (mod.displayNameDe ?? mod.displayNameEn)
                  : (mod.displayNameEn ?? mod.displayNameDe)) ?? mod.moduleKey}
              </span>
            ))}
          </div>
        </section>

        {/* Security Practices */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" aria-hidden="true" />
            {t("practices")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              "dataProcessing",
              "accessControl",
              "auditTrail",
              // #S06-11 (ARCTOS-FULL-2026-08-31): der frühere Text versprach
              // „im Transit (TLS 1.3) und at Rest (AES-256)" als
              // Produktzusage. At Rest war für den Dokumentenspeicher NICHT
              // implementiert. Die Zusage steht jetzt unter
              // `trust.practice.encryptionDesc` — in BEIDEN Sprachen auf
              // demselben, zurückgenommenen Stand. Eine Produktzusage, die
              // sich zwischen zwei Sprachfassungen unterscheidet, wäre genau
              // der Defekt, den S06-11 beschrieben hat.
              "encryption",
              "incident",
              "continuity",
            ].map((practice) => (
              <div
                key={practice}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2
                    className="h-4 w-4 text-green-500 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t(`practice.${practice}Title`)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t(`practice.${practice}Desc`)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 pb-8 text-center">
          <p className="text-xs text-gray-400">
            {t("lastUpdated", {
              date: new Date().toLocaleDateString(locale),
            })}
          </p>
        </footer>
      </main>
    </div>
  );
}
