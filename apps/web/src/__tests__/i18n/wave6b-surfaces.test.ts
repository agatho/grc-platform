/**
 * [ARCTOS-FULL-2026-08-31 / Welle 6b · OP-070]
 *
 * Welle 5a hat die Reihenfolge fuer den Rest von OP-070 festgelegt:
 * `ai-act` → `settings` → `admin` → `admin/rls-audit`. Diese Datei prueft die
 * vier Bereiche nach denselben Massstaeben wie `wave5a-surfaces.test.ts` —
 * also EIGENSCHAFTEN und nicht Importe, weil ein `useTranslations`, das
 * niemand benutzt, die Ratsche senkt und am Bildschirm nichts aendert:
 *
 *   §1 Die 36 umgestellten Seiten binden next-intl UND tragen keinen
 *      satzfoermigen Text mehr.
 *   §2 KEIN Pfad im Bildschirmbereich formatiert mehr mit einem fest
 *      verdrahteten Gebietsschema — ohne Ausnahme. Welle 5a musste
 *      `admin/rls-audit` namentlich ausnehmen; diese Welle hat die Datei
 *      umgestellt, und mit ihr faellt die Ausnahme.
 *   §3 Jeder Schluessel der bespielten Namensraeume liegt in BEIDEN Katalogen
 *      (OP-072), und der neue Namensraum `admin` ist registriert.
 *   §4 Der Befund aus Welle 5a wiederholt sich: `admin/connectors` baute
 *      „vor 3 Std." von Hand nach, obwohl `common.dashboard.timeAgo.*` seit
 *      jeher in beiden Sprachen im Katalog steht. Die Seite benutzt jetzt den
 *      Katalog.
 *   §5 Keine Seite der vier Bereiche fuehrt mehr eine EIGENE Zweitmechanik
 *      (`titleDe`/`titleEn`, `const t = (de, en) => …`). Fuer den Nutzer war
 *      das zweisprachig, fuer jedes Werkzeug unsichtbar.
 *   §6 Die Jahreszahl des Jahresberichts geht als ZEICHENKETTE in ICU — als
 *      Zahl uebergeben stuende dort im deutschen Gebietsschema „2.026".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const WEB = path.join(__dirname, "../../..");
const SRC = path.join(WEB, "src");
const MESSAGES = path.join(WEB, "messages");

/** Die Oberflaechen, die Welle 6b umgestellt hat. */
const CONVERTED = [
  // 1. `ai-act` — groesster Einzelblock, regulatorisch exponiert.
  //
  // Die ersten neun standen auf der Ratschenliste. Die sieben danach NICHT:
  // sie banden `useTranslations("aiAct")` an `_t` und benutzten die Bindung
  // nie — fuer den Zaehler galten sie als uebersetzt, auf dem Bildschirm
  // stand fest verdrahtetes Deutsch. Die letzten vier benutzen `t`, trugen
  // daneben aber englische Restbeschriftungen.
  "app/(dashboard)/ai-act/annual-report/[year]/page.tsx",
  "app/(dashboard)/ai-act/corrective-actions/[id]/page.tsx",
  "app/(dashboard)/ai-act/frias/[id]/page.tsx",
  "app/(dashboard)/ai-act/gpai/[id]/page.tsx",
  "app/(dashboard)/ai-act/gpai/[id]/compliance-wizard/page.tsx",
  "app/(dashboard)/ai-act/incidents/[id]/page.tsx",
  "app/(dashboard)/ai-act/incidents/monitor/page.tsx",
  "app/(dashboard)/ai-act/systems/[id]/page.tsx",
  "app/(dashboard)/ai-act/systems/[id]/compliance-wizard/page.tsx",
  "app/(dashboard)/ai-act/authority/page.tsx",
  "app/(dashboard)/ai-act/corrective-actions/page.tsx",
  "app/(dashboard)/ai-act/gpai/page.tsx",
  "app/(dashboard)/ai-act/incidents/page.tsx",
  "app/(dashboard)/ai-act/penalties/page.tsx",
  "app/(dashboard)/ai-act/prohibited/page.tsx",
  "app/(dashboard)/ai-act/qms/page.tsx",
  "app/(dashboard)/ai-act/conformity-assessments/page.tsx",
  "app/(dashboard)/ai-act/framework-mappings/page.tsx",
  "app/(dashboard)/ai-act/frias/page.tsx",
  "app/(dashboard)/ai-act/oversight-logs/page.tsx",
  // 2. `settings` — war ueber `titleDe`/`titleEn` bereits zweisprachig
  "app/(dashboard)/settings/page.tsx",
  "app/(dashboard)/settings/modules/[moduleKey]/page.tsx",
  "app/(dashboard)/settings/ai-providers/page.tsx",
  // 3. `admin`
  "app/(dashboard)/admin/approvals/page.tsx",
  "app/(dashboard)/admin/approvals/requests/page.tsx",
  "app/(dashboard)/admin/connectors/page.tsx",
  "app/(dashboard)/admin/connectors/sync-log/page.tsx",
  "app/(dashboard)/admin/content-requests/page.tsx",
  "app/(dashboard)/admin/data-links/page.tsx",
  "app/(dashboard)/admin/data-quality/page.tsx",
  "app/(dashboard)/admin/messaging/page.tsx",
  "app/(dashboard)/admin/reminders/page.tsx",
  "app/(dashboard)/admin/review-cycles/page.tsx",
  "app/(dashboard)/admin/roles/page.tsx",
  // 4. der letzte Fall mit festem Gebietsschema
  "app/(dashboard)/admin/rls-audit/page.tsx",
];

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

function code(rel: string): string {
  const p = path.join(SRC, rel);
  if (!existsSync(p)) throw new Error(`Datei fehlt: ${rel}`);
  return readFileSync(p, "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "$1");
}

/**
 * Satzfoermiger Text — dieselbe Definition wie in Welle 5a: ein JSX-Textknoten
 * oder ein Literal mit mindestens zwei Woertern, das mit einem Grossbuchstaben
 * beginnt und keine Tailwind-Klassenkette ist. `CODEISH` haelt
 * TypeScript-Generika (`useState<Foo>(null)`) heraus; ohne diesen Filter
 * meldete der Test in jeder Datei mit generischem Zustand einen Fund.
 */
const TAILWINDISH = /^[a-z0-9:/[\]\-.%()#&_,'"+*<>=@!~ ]+$/;
const CODEISH = /[=;(){}[\]]|^[,).]|\.\w+\(|=>/;

/**
 * Namentliche Ausnahmen, jede mit ihrem Grund — absichtlich HIER und nicht im
 * Quelltext: eine Ausnahme, die im Test steht, muss beim Lesen des Tests
 * begruendet werden.
 */
const ALLOWED: Record<string, string[]> = {
  // KEIN Anzeigetext: `throw new Error("Failed to load")` markiert im
  // `try` den Nicht-200-Fall; der `catch` daneben verwirft die Nachricht und
  // setzt einen Katalogtext (`…loadError`) bzw. eine leere Liste. Uebersetzt
  // gehoert, was der Nutzer sieht — und das ist der Katalogtext.
  //
  // Die Gegenprobe: in den SECHS Dateien, deren `catch` `e.message` wirklich
  // auf den Bildschirm bringt (`annual-report`, `frias`, `incidents/monitor`,
  // `settings/modules`, `settings/ai-providers`, `admin/rls-audit`), steht
  // diese Zeichenkette NICHT in dieser Liste — dort wurde sie auf
  // `common.httpError` umgestellt.
  "app/(dashboard)/admin/approvals/page.tsx": ["Failed to load"],
  "app/(dashboard)/admin/approvals/requests/page.tsx": ["Failed to load"],
  "app/(dashboard)/admin/messaging/page.tsx": ["Failed to load"],
  "app/(dashboard)/admin/reminders/page.tsx": ["Failed to load"],
  "app/(dashboard)/admin/review-cycles/page.tsx": ["Failed to load"],
  "app/(dashboard)/admin/content-requests/page.tsx": [
    "Failed to load requests",
  ],
  // KEIN Anzeigetext: "Cloud Security" ist der Bezeichner, unter dem die
  // Schnittstelle die Kategorie liefert (`ct.category`), und zugleich der
  // Schluessel dreier Tabellen im Quelltext. Angezeigt wird er nicht mehr —
  // `CATEGORY_SLUG` bildet ihn auf `connectors.category.cloud_security` ab.
  "app/(dashboard)/admin/connectors/page.tsx": ["Cloud Security"],
};

function literalText(rel: string, src: string): string[] {
  const allowed = ALLOWED[rel] ?? [];
  const found: string[] = [];
  for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]*)</g)) {
    const t = m[1].trim();
    if (CODEISH.test(t)) continue;
    if (/\p{Lu}/u.test(t) && /\s/.test(t)) found.push(t);
  }
  for (const m of src.matchAll(
    /["'`]([^"'`\n]*\p{L}[^"'`\n]* [^"'`\n]*\p{L}[^"'`\n]*)["'`]/gu,
  )) {
    const t = m[1].trim();
    if (!TAILWINDISH.test(t) && /^\p{Lu}/u.test(t)) found.push(t);
  }
  return found.filter((t) => !allowed.includes(t));
}

// ── Katalog ────────────────────────────────────────────────────────────────

function leaves(obj: unknown, prefix: string, out: Set<string>): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, key, out);
    else out.add(key);
  }
}

function readNs(locale: string, file: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(MESSAGES, locale, `${file}.json`), "utf8"),
  ) as Record<string, unknown>;
}

/**
 * Der Nachrichtenbaum, wie ihn `src/i18n/request.ts` baut: `common.json`
 * einmal in die WURZEL gespreizt und einmal als `common` gefuehrt. Genau diese
 * Doppelung ist der Sachverhalt aus dem OP-073-Nachtrag; wer hier abkuerzt,
 * prueft einen Baum, den die Anwendung nie sieht.
 */
function catalogue(locale: string): Set<string> {
  const out = new Set<string>();
  const common = readNs(locale, "common");
  leaves(common, "", out);
  leaves(common, "common", out);
  leaves(readNs(locale, "admin"), "admin", out);
  leaves(readNs(locale, "ai-act"), "aiAct", out);
  return out;
}

describe("[OP-070] Welle 6b — ai-act, settings, admin, rls-audit", () => {
  // ── §1 ───────────────────────────────────────────────────────────────────
  it.each(CONVERTED)("%s bindet next-intl", (rel) => {
    expect(code(rel)).toMatch(/\b(useTranslations|getTranslations)\s*\(/);
  });

  it.each(CONVERTED)("%s traegt keinen satzfoermigen Text mehr", (rel) => {
    expect(literalText(rel, code(rel))).toEqual([]);
  });

  // ── §2 ───────────────────────────────────────────────────────────────────
  //
  // Die zweite, unsichtbarere Haelfte von OP-070. Welle 5a hat sie von 70 auf
  // 2 Fundstellen gebracht und musste die letzten beiden namentlich ausnehmen:
  // `admin/rls-audit` waehlte in JEDEM Zweig seiner eigenen Zweisprachigkeit
  // das passende Tag, und eine Teilaenderung haette die Datei inkonsistent
  // gemacht. Diese Welle hat sie ganz umgestellt — die Ausnahme ist weg, und
  // der Wachposten steht ohne sie.
  it("KEIN Pfad unter app/(dashboard), app/(portal) und components formatiert mit festem Gebietsschema", () => {
    const roots = [
      path.join(SRC, "app/(dashboard)"),
      path.join(SRC, "app/(portal)"),
      path.join(SRC, "components"),
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p) && !p.endsWith(".test.tsx")) {
          const src = readFileSync(p, "utf8")
            .replace(BLOCK_COMMENT, "")
            .replace(LINE_COMMENT, "$1");
          for (const m of src.matchAll(
            /toLocale[A-Za-z]*\(\s*["'][a-z]{2}-[A-Z]{2}["']/g,
          )) {
            offenders.push(`${path.relative(SRC, p)}: ${m[0]}`);
          }
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });

  // ── §3 ───────────────────────────────────────────────────────────────────
  //
  // OP-072: ein Schluessel, der nur in einer Sprache existiert, rendert in der
  // anderen seinen eigenen Pfad als sichtbaren Text. Geprueft gegen die
  // Namensraum-DATEIEN, nicht gegen das gebaute Buendel — ein veraltetes
  // Buendel darf diesen Test nicht gruen faerben.
  const TOUCHED_NAMESPACES = [
    "admin",
    "aiAct",
    "settings.hub",
    "settings.aiProviders",
    "modules.detail",
  ];

  it("jeder Schluessel der bespielten Namensraeume liegt in DE und EN", () => {
    const de = catalogue("de");
    const en = catalogue("en");
    const inScope = (k: string) =>
      TOUCHED_NAMESPACES.some((ns) => k === ns || k.startsWith(`${ns}.`));

    const onlyDe = [...de].filter((k) => inScope(k) && !en.has(k));
    const onlyEn = [...en].filter((k) => inScope(k) && !de.has(k));

    expect({ onlyDe, onlyEn }).toEqual({ onlyDe: [], onlyEn: [] });
  });

  it("der neue Namensraum `admin` ist in request.ts registriert und liegt in beiden Sprachen", () => {
    const request = readFileSync(path.join(SRC, "i18n/request.ts"), "utf8");
    expect(request).toContain('["admin", "admin"]');
    for (const locale of ["de", "en"]) {
      const out = new Set<string>();
      leaves(readNs(locale, "admin"), "", out);
      expect(out.size, `${locale}/admin.json ist leer`).toBeGreaterThan(100);
    }
  });

  it("die DE- und EN-Fassung der neuen Namensraeume sind nicht wortgleich", () => {
    // Ein Katalog, in dem EN die deutsche Zeichenkette wiederholt, waere
    // OP-070 mit zusaetzlichen Schritten. Geprueft an Saetzen (mindestens
    // zwei Woerter) — Eigennamen und Abkuerzungen sind zu Recht gleich.
    // Nur die Knoten, die DIESE Welle geschrieben hat. `aiAct.title` ist
    // „EU AI Act Governance" — der Eigenname des Moduls, in beiden Sprachen
    // gleich und aelter als diese Welle. Ihn hier mitzupruefen hiesse, einen
    // Eigennamen zu uebersetzen, um einen Test gruen zu bekommen.
    const WAVE_NODES: Record<string, string[]> = {
      admin: [""],
      "ai-act": [
        "shared",
        "systemDetail",
        "incidentDetail",
        "correctiveAction",
        "fria",
        "gpai",
        "gpaiWizard",
        "systemWizard",
        "monitor",
        "annualReport",
      ],
    };
    for (const ns of ["admin", "ai-act"]) {
      const de = readNs("de", ns);
      const en = readNs("en", ns);
      const prefixes = WAVE_NODES[ns];
      const written = (k: string) =>
        prefixes.some((p) => p === "" || k === p || k.startsWith(`${p}.`));
      const dl = new Set<string>();
      leaves(de, "", dl);
      let sentences = 0;
      let identical = 0;
      for (const key of dl) {
        const pick = (o: Record<string, unknown>) =>
          key
            .split(".")
            .reduce<unknown>(
              (acc, part) => (acc as Record<string, unknown>)?.[part],
              o,
            );
        const d = pick(de);
        const e = pick(en);
        if (typeof d !== "string" || typeof e !== "string") continue;
        if (!written(key)) continue;
        if (d.split(/\s+/).length < 3) continue;
        sentences++;
        if (d === e) identical++;
      }
      expect(sentences, `${ns}: keine Saetze gefunden`).toBeGreaterThan(20);
      expect(identical, `${ns}: ${identical} Saetze wortgleich`).toBe(0);
    }
  });

  // ── §4 ───────────────────────────────────────────────────────────────────
  //
  // Der Befund aus Welle 5a, hier zum zweiten Mal: die Uebersetzung war da.
  // `admin/connectors` baute „vor 3 Std." und „vor 2 Tagen" von Hand nach —
  // samt selbstgebauter Mehrzahl (`Tag${days > 1 ? "en" : ""}`) — obwohl
  // `common.dashboard.timeAgo.*` seit jeher in BEIDEN Sprachen im Katalog
  // steht, mit korrekten ICU-Mehrzahlformen. Auch „Nie" gab es schon als
  // `common.users.never`.
  it("admin/connectors benutzt die vorhandenen timeAgo-Nachrichten statt einer Zweitfassung", () => {
    const src = code("app/(dashboard)/admin/connectors/page.tsx");
    for (const key of [
      "dashboard.timeAgo.justNow",
      "dashboard.timeAgo.minutesAgo",
      "dashboard.timeAgo.hoursAgo",
      "dashboard.timeAgo.daysAgo",
      "users.never",
    ]) {
      expect(src, `${key} wird nicht benutzt`).toContain(`"${key}"`);
    }
    // Und die deutsche Zweitfassung ist wirklich weg.
    expect(src).not.toMatch(/vor \$\{/);
    expect(src).not.toContain('"Nie"');

    const de = readNs("de", "common");
    const en = readNs("en", "common");
    const timeAgoDe = (de.dashboard as Record<string, unknown>)
      .timeAgo as Record<string, string>;
    const timeAgoEn = (en.dashboard as Record<string, unknown>)
      .timeAgo as Record<string, string>;
    for (const k of ["justNow", "minutesAgo", "hoursAgo", "daysAgo"]) {
      expect(timeAgoDe[k]).toBeTruthy();
      expect(timeAgoEn[k]).toBeTruthy();
      expect(timeAgoEn[k]).not.toBe(timeAgoDe[k]);
    }
  });

  // ── §5 ───────────────────────────────────────────────────────────────────
  //
  // Die Zweitmechanik. Diese Seiten WAREN zweisprachig — ueber
  // `titleDe`/`titleEn`-Paare und eine seitenlokale Hilfsfunktion
  // `const t = (de, en) => locale === "de" ? de : en`. Fuer den Nutzer wirkte
  // das; fuer die Ratsche, jedes Werkzeug und jede Uebersetzungsschleife war
  // es unsichtbar, und ein dritter Sprachwunsch haette jede Seite einzeln
  // getroffen.
  it("keine Seite der vier Bereiche fuehrt noch eine eigene Zweitmechanik", () => {
    const offenders: string[] = [];
    for (const rel of CONVERTED) {
      const src = code(rel);
      // Absichtlich auf die EIGENSCHAFTSDEFINITION verengt (`titleDe:`), nicht
      // auf jedes Vorkommen: `config.descriptionDe` in
      // `settings/modules/[moduleKey]` ist ein Feld der DATENBANK
      // (`module_config`), also mandantenspezifischer Inhalt und kein
      // Katalogtext. Das ist kein Restbestand der Zweitmechanik.
      if (
        /(?<![.\w])(titleDe|titleEn|labelDe|labelEn|descriptionDe|descriptionEn)\s*:/.test(
          src,
        )
      )
        offenders.push(`${rel}: De/En-Paare`);
      if (/const t = \(\s*de\s*:/.test(src))
        offenders.push(`${rel}: const t = (de, en) => …`);
    }
    expect(offenders).toEqual([]);
  });

  it("settings/page.tsx traegt am Abzeichen einen Schluessel, keinen deutschen Text", () => {
    // Vorher: `badge: "neu"` — der fertige TEXT stand in der Tabelle, und ein
    // englischsprachiger Nutzer las auf der englischen Seite „NEU".
    const src = code("app/(dashboard)/settings/page.tsx");
    expect(src).not.toMatch(/badge\??:\s*"neu"/);
    expect(src).toContain("settings.hub.badge.");
    const de = readNs("de", "common");
    const en = readNs("en", "common");
    const badgeDe = (
      (de.settings as Record<string, unknown>).hub as Record<string, unknown>
    ).badge as Record<string, string>;
    const badgeEn = (
      (en.settings as Record<string, unknown>).hub as Record<string, unknown>
    ).badge as Record<string, string>;
    expect(badgeDe.new).toBe("neu");
    expect(badgeEn.new).toBe("new");
  });

  // ── §6 ───────────────────────────────────────────────────────────────────
  //
  // Der Fallstrick aus Welle 5a, Schnitt 1: ICU schickt ein blosses `{year}`
  // durch `Intl.NumberFormat`. Als Zahl uebergeben stuende im Jahresbericht
  // „2.026" — im Titel des Dokuments, das die Organisation nach aussen gibt.
  it("der Jahresbericht uebergibt das Jahr als Zeichenkette an ICU", () => {
    const src = code("app/(dashboard)/ai-act/annual-report/[year]/page.tsx");
    expect(src).toContain("year: String(year)");
    expect(src).not.toMatch(/annualReport\.title",\s*\{\s*year\s*\}/);
  });

  // ── §7 ───────────────────────────────────────────────────────────────────
  //
  // Der schwerste Befund dieser Welle. Die i18n-Ratsche zaehlt Dateien, die
  // `useTranslations` NICHT importieren. Sieben Seiten des ai-act-Moduls
  // schrieben `const _t = useTranslations("aiAct");` und benutzten die
  // Bindung nie — der Unterstrich sorgte zugleich dafuer, dass
  // `no-unused-vars` schwieg. Fuer den Zaehler waren sie uebersetzt, auf dem
  // Bildschirm stand fest verdrahtetes Deutsch.
  //
  // Das ist genau die Fehlerform, vor der Welle 5a gewarnt hat („ein
  // `useTranslations`, das niemand benutzt, senkt die Ratsche und aendert am
  // Bildschirm nichts") — sie war da schon real, nur ungezaehlt.
  it("keine der umgestellten Seiten bindet next-intl, ohne die Bindung zu benutzen", () => {
    const offenders: string[] = [];
    for (const rel of CONVERTED) {
      const src = code(rel);
      for (const m of src.matchAll(
        /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(/g,
      )) {
        const name = m[1];
        const uses = [
          ...src.matchAll(
            new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`, "g"),
          ),
        ].length;
        if (uses === 0) offenders.push(`${rel}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("das gesamte ai-act-Modul traegt keinen fest verdrahteten Text mehr", () => {
    // Nicht nur die gelisteten Seiten: der ganze Ordner. `ai-act` ist der
    // regulatorisch exponierteste Teil des Produkts, und die Ratsche hat dort
    // sieben Seiten nicht gesehen (§7) und vier weitere mit englischen
    // Restbeschriftungen durchgelassen.
    const dir = path.join(SRC, "app/(dashboard)/ai-act");
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) {
          const rel = path.relative(SRC, p);
          const found = literalText(rel, code(rel));
          if (found.length) offenders.push(`${rel}: ${found.join(" | ")}`);
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });

  // ── §8 ───────────────────────────────────────────────────────────────────
  //
  // Das feste Gebietsschema hat eine ZWEITE Schreibweise, die weder der
  // Detektor in `scripts/audit-i18n-usage.mjs` noch der Wachposten aus Welle
  // 5a kennt: `new Intl.NumberFormat("de-DE", { style: "currency" })`. Beide
  // suchen nur nach `toLocale*("xx-XX")`. Welle 5a hat den Bildschirmbereich
  // deshalb als „70 → 2" gemeldet; die 20 Geldformatierer waren nie gezaehlt.
  //
  // Behoben ist bisher nur die eine Fundstelle in dieser Welles Gebiet
  // (`ai-act/penalties`). Die uebrigen stehen hier NAMENTLICH — beziffert
  // statt behauptet, und die Liste ist zugleich die Bremse gegen Zuwachs.
  const FIXED_CURRENCY_LOCALE = [
    "app/(dashboard)/bcms/bia/[id]/page.tsx",
    "app/(dashboard)/bcms/strategies/page.tsx",
    "app/(dashboard)/billing/page.tsx",
    "app/(dashboard)/billing/plans/page.tsx",
    "app/(dashboard)/contracts/[id]/page.tsx",
    "app/(dashboard)/contracts/list/page.tsx",
    "app/(dashboard)/contracts/page.tsx",
    "app/(dashboard)/eam/dashboards/cost-management/page.tsx",
    "app/(dashboard)/erm/fair/compare/page.tsx",
    "app/(dashboard)/erm/fair/portfolio/page.tsx",
    "app/(dashboard)/erm/fair/top-risks/page.tsx",
    "app/(dashboard)/erm/risks/[id]/fair/page.tsx",
    "app/(dashboard)/erm/risks/[id]/fair/results/page.tsx",
    "app/(dashboard)/esg/climate-scenarios/page.tsx",
    "app/(dashboard)/esg/taxonomy/page.tsx",
    "app/(dashboard)/risks/[id]/page.tsx",
    "app/(dashboard)/tax-cms/audit-preps/page.tsx",
    "app/(dashboard)/tax-cms/page.tsx",
  ];

  it("die Geldformatierer mit festem Gebietsschema sind genau die bezifferten", () => {
    const roots = [
      path.join(SRC, "app/(dashboard)"),
      path.join(SRC, "app/(portal)"),
      path.join(SRC, "components"),
    ];
    const offenders = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p) && !p.endsWith(".test.tsx")) {
          const src = readFileSync(p, "utf8")
            .replace(BLOCK_COMMENT, "")
            .replace(LINE_COMMENT, "$1");
          if (/Intl\.[A-Za-z]*Format\(\s*["'][a-z]{2}-[A-Z]{2}["']/.test(src))
            offenders.add(path.relative(SRC, p));
        }
      }
    };
    roots.forEach(walk);
    // Genau — nicht „hoechstens". Waechst die Liste, faellt der Test; wird
    // eine Datei umgestellt, faellt er auch, und der Eintrag gehoert
    // gestrichen. Eine Ausnahmeliste, die nur nach oben nachgibt, ist keine.
    expect([...offenders].sort()).toEqual([...FIXED_CURRENCY_LOCALE].sort());
  });

  it("das Mittel gegen das feste Gebietsschema bei Geld existiert und wird benutzt", () => {
    // Welle 5a hat zweimal denselben Befund gemacht: das Mittel war da und
    // nicht angeschlossen. Ein Mittel, das NIRGENDS benutzt wird, ist die
    // Vorstufe davon — deshalb prueft dieser Test beides.
    const lib = readFileSync(path.join(SRC, "lib/format-date.ts"), "utf8");
    expect(lib).toMatch(/export function formatCurrency\(/);
    expect(lib).toMatch(/formatCurrency: \(/);
    expect(code("app/(dashboard)/ai-act/penalties/page.tsx")).toContain(
      "formatCurrency",
    );
  });
});
