// BPM Overhaul Phase 2 A1: Resolve a framework_code + entry_code pair to a
// real catalog_entry.id. Returns null if no match.
//
// Framework codes map to catalog rows via a heuristic on `catalog.source`
// and `catalog.name`. The mapping is intentionally generous (ILIKE on both
// columns) so seed-naming drift doesn't break resolution.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

// Short code → list of search tokens to match against catalog.source / name.
const FRAMEWORK_TOKENS: Record<string, string[]> = {
  "iso-27001": ["ISO/IEC 27001", "ISO 27001"],
  "iso-27002": ["ISO/IEC 27002", "ISO 27002"],
  "iso-22301": ["ISO 22301"],
  "iso-9001": ["ISO 9001"],
  "iso-27005": ["ISO/IEC 27005", "ISO 27005"],
  "iso-27017": ["ISO/IEC 27017", "ISO 27017"],
  "iso-27018": ["ISO/IEC 27018", "ISO 27018"],
  "iso-27019": ["ISO/IEC 27019", "ISO 27019"],
  "iso-27701": ["ISO/IEC 27701", "ISO 27701"],
  "iso-42001": ["ISO/IEC 42001", "ISO 42001"],
  nis2: ["NIS2", "NIS 2", "(EU) 2022/2555"],
  dora: ["DORA", "(EU) 2022/2554"],
  gdpr: ["GDPR", "DSGVO", "(EU) 2016/679"],
  "ai-act": ["AI Act", "KI-Verordnung", "(EU) 2024/1689"],
  coso: ["COSO"],
  cobit: ["COBIT"],
  nist: ["NIST CSF", "NIST SP 800"],
  "nist-csf": ["NIST CSF"],
  "nist-800-53": ["NIST SP 800-53"],
  "nist-800-171": ["NIST SP 800-171"],
  cmmc: ["CMMC"],
  cis: ["CIS Controls"],
  "bsi-grundschutz": ["BSI IT-Grundschutz", "BSI Grundschutz"],
  "bsi-c5": ["BSI C5"],
  hipaa: ["HIPAA"],
  pci: ["PCI DSS"],
  "csa-ccm": ["CSA Cloud Controls", "CCM"],
  tisax: ["TISAX"],
  "iec-62443": ["IEC 62443"],
  swift: ["SWIFT CSCF"],
  cra: ["Cyber Resilience Act", "(EU) 2024/2847"],
  owasp: ["OWASP ASVS"],
  esrs: ["ESRS", "CSRD"],
  lksg: ["LkSG"],
  mitre: ["MITRE ATT&CK"],
  soc2: ["SOC 2", "ISAE 3402"],
  idw: ["IDW PS"],
  iia: ["IIA Standards"],
};

const cache = new Map<string, string | null>();

export async function resolveCatalogEntry(
  frameworkCode: string | null | undefined,
  entryCode: string | null | undefined,
): Promise<{ catalogEntryId: string; catalogId: string } | null> {
  if (!frameworkCode || !entryCode) return null;
  const cacheKey = `${frameworkCode.toLowerCase()}::${entryCode}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached === null) return null;
    // Cache stores `${catalogEntryId}|${catalogId}`
    const [eid, cid] = cached!.split("|");
    return { catalogEntryId: eid, catalogId: cid };
  }

  const tokens = FRAMEWORK_TOKENS[frameworkCode.toLowerCase()] ?? [
    frameworkCode,
  ];
  // Build an OR of ILIKE clauses on catalog.source/name
  const likeClauses = tokens
    .map(
      (t) =>
        `(c.source ILIKE '%' || ${`'${t.replace(/'/g, "''")}'`} || '%' OR c.name ILIKE '%' || ${`'${t.replace(/'/g, "''")}'`} || '%')`,
    )
    .join(" OR ");

  const result = await db.execute(
    sql.raw(`
    SELECT ce.id AS entry_id, ce.catalog_id
    FROM catalog_entry ce
    JOIN catalog c ON c.id = ce.catalog_id
    WHERE ce.code = '${String(entryCode).replace(/'/g, "''")}'
      AND (${likeClauses})
      AND c.is_active = true
    ORDER BY c.created_at DESC
    LIMIT 1
  `),
  );

  const row = (result as any[])[0];
  if (!row) {
    cache.set(cacheKey, null);
    return null;
  }
  cache.set(cacheKey, `${row.entry_id}|${row.catalog_id}`);
  return { catalogEntryId: row.entry_id, catalogId: row.catalog_id };
}
