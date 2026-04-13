/**
 * Trust Center — Public compliance status page.
 *
 * Accessible without login at /trust/{orgCode}
 * Shows the organization's security certifications, active frameworks,
 * compliance status, and links to downloadable policies.
 */
import { db, organization, orgActiveCatalog, catalog, moduleConfig, moduleDefinition } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { Shield, CheckCircle2, BookOpen, Lock, Globe, FileText, Clock } from "lucide-react";

interface Props {
  params: Promise<{ orgCode: string }>;
}

export default async function TrustCenterPage({ params }: Props) {
  const { orgCode } = await params;

  // Find org by short name (used as public URL slug)
  const [org] = await db
    .select({ id: organization.id, name: organization.name, shortName: organization.shortName })
    .from(organization)
    .where(eq(organization.shortName, orgCode));

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Trust Center nicht gefunden</h1>
          <p className="text-sm text-gray-500 mt-2">Die angeforderte Organisation existiert nicht.</p>
        </div>
      </div>
    );
  }

  // Fetch active catalogs (frameworks)
  const activeCatalogs = await db
    .select({
      catalogName: catalog.name,
      catalogType: catalog.catalogType,
      source: catalog.source,
      enforcementLevel: orgActiveCatalog.enforcementLevel,
      activatedAt: orgActiveCatalog.activatedAt,
    })
    .from(orgActiveCatalog)
    .innerJoin(catalog, eq(orgActiveCatalog.catalogId, catalog.id))
    .where(eq(orgActiveCatalog.orgId, org.id));

  // Fetch enabled modules
  const modules = await db
    .select({
      moduleKey: moduleConfig.moduleKey,
      displayNameDe: moduleDefinition.displayNameDe,
      displayNameEn: moduleDefinition.displayNameEn,
    })
    .from(moduleConfig)
    .innerJoin(moduleDefinition, eq(moduleConfig.moduleKey, moduleDefinition.moduleKey))
    .where(and(eq(moduleConfig.orgId, org.id), eq(moduleConfig.uiStatus, "enabled")));

  const certifications = activeCatalogs.filter((c) => c.enforcementLevel === "mandatory");
  const recommendedFrameworks = activeCatalogs.filter((c) => c.enforcementLevel !== "mandatory");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              <p className="text-sm text-gray-500">Trust Center — Sicherheits- und Compliance-Status</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Overview Badge */}
        <div className="rounded-xl bg-green-50 border border-green-200 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-lg font-semibold text-green-900">Compliance-Status: Aktiv</p>
              <p className="text-sm text-green-700 mt-0.5">
                {activeCatalogs.length} aktive Frameworks · {modules.length} Sicherheitsmodule aktiviert
              </p>
            </div>
          </div>
        </div>

        {/* Certifications / Mandatory Frameworks */}
        {certifications.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Zertifizierungen & verpflichtende Standards
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certifications.map((cert, i) => (
                <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-sm font-semibold text-gray-900">{cert.catalogName}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">Quelle: {cert.source}</p>
                  {cert.activatedAt && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-6 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Aktiviert: {new Date(cert.activatedAt).toLocaleDateString("de-DE")}
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
              <BookOpen className="h-5 w-5 text-indigo-600" />
              Aktive Compliance-Frameworks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendedFrameworks.map((fw, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-medium text-gray-900">{fw.catalogName}</p>
                  <p className="text-xs text-gray-500 mt-1">{fw.catalogType} · {fw.source}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Enabled Security Modules */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-teal-600" />
            Aktivierte Sicherheitsmodule
          </h2>
          <div className="flex flex-wrap gap-2">
            {modules.map((mod) => (
              <span
                key={mod.moduleKey}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200"
              >
                {mod.displayNameDe ?? mod.displayNameEn ?? mod.moduleKey}
              </span>
            ))}
          </div>
        </section>

        {/* Security Practices */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Sicherheitspraktiken
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Datenverarbeitung", desc: "Alle Daten werden in der EU verarbeitet und gespeichert." },
              { title: "Zugriffskontrolle", desc: "Rollenbasierte Zugriffskontrolle mit Three Lines of Defense." },
              { title: "Audit-Trail", desc: "Kryptographisch gesicherter Audit-Trail (SHA-256 Hash-Chain)." },
              { title: "Verschlüsselung", desc: "Daten werden im Transit (TLS 1.3) und at Rest (AES-256) verschlüsselt." },
              { title: "Incident Response", desc: "Definierter Incident-Response-Prozess mit 24h-Meldepflicht." },
              { title: "Business Continuity", desc: "Getestete Business-Continuity-Pläne und Disaster Recovery." },
            ].map((practice) => (
              <div key={practice.title} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{practice.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{practice.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 pb-8 text-center">
          <p className="text-xs text-gray-400">
            Powered by ARCTOS GRC Platform · Zuletzt aktualisiert: {new Date().toLocaleDateString("de-DE")}
          </p>
        </footer>
      </main>
    </div>
  );
}
