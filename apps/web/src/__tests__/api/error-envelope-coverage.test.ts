// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079 / OP-084]
//
// Strukturprüfung über den gesamten Routenbaum: JEDER exportierte
// HTTP-Handler unter `app/api/**` läuft entweder durch `withErrorHandler`
// (RFC-7807-Problemdetails), durch `withScimErrorHandler`
// (`application/scim+json`, RFC 7644 §3.12) — oder er steht namentlich in der
// Ausnahmeliste unten, mit Begründung.
//
// Warum eine Strukturprüfung und kein Zählwert: das Register führte für
// OP-079 die Zahl „107 von 1.362" aus WP12. Nachgemessen am 2026-09-04 waren
// es **94 ungewickelte Handler in 49 Dateien** von 2.039 Handlern in 1.372
// Dateien. Eine Zahl in einem Dokument altert; diese Prüfung nicht. Sie fällt
// in dem Moment, in dem eine neue Route ohne Fehlerhülle dazukommt — und sie
// fällt auch, wenn eine Ausnahme unnötig geworden ist und niemand sie
// austrägt (`stale`-Prüfung am Ende).
//
// Die Ausnahmen sind KEINE Sammelposition. Jede ist eine der drei Formen:
//
//   * `constant` — der Handler baut eine konstante Antwort (308-Alias,
//     Discovery-Nutzlast, 405 mit `Allow`). Kein `await`, keine Datenbank,
//     kein Wurfpfad. Ein Wickel hätte hier nichts zu fangen.
//   * `probe` — die beiden Health-Sonden. Ihr Vertrag IST der Rumpf
//     (`status: healthy|degraded`); eine Normalisierung auf problem+json
//     würde jeden Monitor brechen, der sie liest.
//
// Wird eine dieser Dateien eines Tages um einen echten Handler erweitert,
// fällt die Prüfung — der Eintrag beschreibt die DATEI, nicht die Methode.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "src/app/api");
const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

/** Datei → Grund, warum sie ohne Fehlerhülle auskommt. */
const JUSTIFIED: Record<string, string> = {
  // ── konstante 308-Aliasse (`alias308` / lokales `redirect308`) ──────
  "v1/admin/api-keys/route.ts": "constant: 308 → /admin/scim/tokens",
  "v1/admin/organizations/route.ts": "constant: 308 → /organizations",
  "v1/admin/sso-providers/route.ts": "constant: 308 → /admin/sso",
  "v1/admin/users/route.ts": "constant: 308 → /users",
  "v1/dpms/transfer-impact-assessments/route.ts": "constant: 308 → /dpms/tia",
  "v1/identity/api-keys/route.ts": "constant: 308 → /admin/scim/tokens",
  "v1/identity/scim-configs/route.ts": "constant: 308 → /admin/scim",
  "v1/identity/sso-providers/route.ts": "constant: 308 → /admin/sso",
  "v1/isms/management-reviews/route.ts": "constant: 308 → /isms/reviews",

  // ── konstante Discovery-Nutzlasten und 405 mit Allow-Kopf ──────────
  "v1/bcms/crisis/dashboard/route.ts": "constant: 404 mit Hinweis",
  "v1/compliance/route.ts": "constant: Discovery-Nutzlast",
  "v1/eam/applications/route.ts": "constant: 405 (GET ist gewickelt)",
  "v1/esg/erm-sync/route.ts": "constant: 405 (POST ist gewickelt)",
  "v1/identity/route.ts": "constant: Discovery-Nutzlast",
  "v1/isms/nis2/route.ts": "constant: Discovery-Nutzlast",
  "v1/marketplace/route.ts": "constant: Discovery-Nutzlast",
  "v1/meta/build/route.ts": "constant: Build-Kennwerte, null DB-Zugriffe",
  "v1/programmes/route.ts": "constant: Discovery + 405",
  "v1/rcsa/route.ts": "constant: Discovery-Nutzlast",
  "v1/reports/route.ts": "constant: Discovery-Nutzlast",
  "v1/risk-acceptances/route.ts": "constant: 405 (GET ist gewickelt)",
  "v1/whistleblowing/cases/route.ts": "constant: 405 (GET ist gewickelt)",
  "v1/whistleblowing/intake/route.ts": "constant: Discovery-Nutzlast",

  // ── Sonden mit eigenem Antwortvertrag ──────────────────────────────
  "health/route.ts": "probe: {status, checks} ist der Vertrag",
  "v1/health/route.ts": "probe: {status, dbLatencyMs} ist der Vertrag",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

interface Decl {
  kind: "const" | "function" | "reexport";
  rhs: string;
}

function declarationsOf(src: string): Map<string, Decl> {
  const decl = new Map<string, Decl>();
  for (const m of METHODS) {
    const c = new RegExp(
      `export\\s+const\\s+${m}\\s*(?::[^=\\n]+)?=\\s*([\\s\\S]{0,140})`,
    ).exec(src);
    if (c?.[1] !== undefined) {
      decl.set(m, { kind: "const", rhs: c[1] });
      continue;
    }
    if (
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\s*\\(`).test(src)
    ) {
      decl.set(m, { kind: "function", rhs: "" });
      continue;
    }
    const r = new RegExp(
      `export\\s*\\{[^}]*\\b([A-Za-z_$][\\w$]*)\\s+as\\s+${m}\\b[^}]*\\}`,
    ).exec(src);
    if (r?.[1]) decl.set(m, { kind: "reexport", rhs: r[1] });
  }
  return decl;
}

const WRAPPER = /^\s*with(?:Error|ScimError)Handler\s*[(<]/;

function isWrapped(
  method: string,
  decl: Map<string, Decl>,
  locals: Map<string, string>,
  seen = new Set<string>(),
): boolean {
  const d = decl.get(method);
  if (!d) return false;
  if (d.kind === "function") return false;
  if (d.kind === "const" && WRAPPER.test(d.rhs)) return true;
  // `export const DELETE = GET;` und `export { PUT as PATCH }` — dem Alias
  // folgen, sonst zählt eine gewickelte Route als ungewickelt.
  const id =
    d.kind === "reexport"
      ? d.rhs
      : (/^([A-Za-z_$][\w$]*)\s*[;\n]/.exec(d.rhs.trim())?.[1] ?? null);
  if (!id || seen.has(id)) return false;
  seen.add(id);
  if ((METHODS as readonly string[]).includes(id))
    return isWrapped(id, decl, locals, seen);
  const local = locals.get(id);
  return local !== undefined && WRAPPER.test(local);
}

function localConsts(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*([\s\S]{0,60})/g,
  )) {
    out.set(m[1]!, m[2]!);
  }
  return out;
}

/**
 * Der Quelltext EINES Handlers, ohne Kommentarzeilen — von seiner Deklaration
 * bis zu der Zeile, die ihn auf Spaltenebene schliesst (`}` oder `});`).
 * Eine Datei mit einem gewickelten GET und einem konstanten 405 daneben
 * darf sich die 422 des GET nicht anrechnen lassen.
 */
function handlerBody(
  src: string,
  method: string,
): Array<{ text: string; context: string }> {
  const lines = src.split("\n");
  const start = lines.findIndex((l) =>
    new RegExp(
      `^export\\s+(?:const\\s+${method}\\s*(?::[^=]+)?=|(?:async\\s+)?function\\s+${method}\\b)`,
    ).test(l),
  );
  if (start < 0) return [];
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === "}" || lines[i] === "});" || /^\}\);?$/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  const body = lines
    .slice(start, end + 1)
    .filter((l) => !l.trim().startsWith("//"));
  return body.map((text, i) => ({
    text,
    context: body.slice(Math.max(0, i - 12), i + 1).join("\n"),
  }));
}

describe("[OP-079/OP-084] jede Route hat eine Fehlerhülle", () => {
  const files = walk(API_ROOT);

  it("findet den erwarteten Routenbestand (Schutz gegen einen leeren Lauf)", () => {
    expect(files.length).toBeGreaterThan(1300);
  });

  it("kein exportierter Handler ohne Wickel ausserhalb der Ausnahmeliste", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = relative(API_ROOT, file).split("\\").join("/");
      if (JUSTIFIED[rel]) continue;
      const decl = declarationsOf(src);
      const locals = localConsts(src);
      for (const method of decl.keys()) {
        if (!isWrapped(method, decl, locals))
          offenders.push(`${method} ${rel}`);
      }
    }
    expect(offenders.sort()).toEqual([]);
  });

  // [Welle 4b-7 · OP-079] Die zweite Hälfte der Zusage. Ein Wickel deckt die
  // 1.977 gewickelten Handler ab; für die 62 begründeten Ausnahmen muss die
  // FORM von Hand stimmen, weil sie niemand normalisiert. Nachgemessen am
  // 2026-09-04 war genau eine Stelle übrig — der 405 von
  // `risk-acceptances`, der `{ error, detail }` in `application/json`
  // schickte, während die dreizehn anderen 405 des Repositories längst
  // `problem.methodNotAllowed` benutzten.
  it("die ungewickelten Ausnahmen bauen keine {error}-Rümpfe mit Status >= 400", () => {
    // Die beiden Sonden sind ausgenommen: ihr Rumpf IST ihr Vertrag.
    const PROBES = new Set(["health/route.ts", "v1/health/route.ts"]);
    const offenders: string[] = [];
    for (const rel of Object.keys(JUSTIFIED)) {
      if (PROBES.has(rel)) continue;
      const src = readFileSync(join(API_ROOT, rel), "utf8");
      const decl = declarationsOf(src);
      const locals = localConsts(src);
      for (const method of decl.keys()) {
        if (isWrapped(method, decl, locals)) continue;
        // Nur den Rumpf DIESES Handlers ansehen. Mehrere dieser Dateien
        // haben einen gewickelten GET und daneben einen konstanten 405 —
        // die 422 des GET werden normalisiert, die des 405 nicht.
        for (const line of handlerBody(src, method)) {
          const m = /status:\s*(\d{3})/.exec(line.text);
          if (!m || Number(m[1]) < 400) continue;
          if (/problem\s*\.|type:\s*["'`]https?:/.test(line.context)) continue;
          offenders.push(`${rel} ${method} — Status ${m[1]} ohne problem+json`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keine Ausnahme ist veraltet — jede gelistete Datei existiert und ist wirklich ungewickelt", () => {
    const stale: string[] = [];
    for (const [rel, reason] of Object.entries(JUSTIFIED)) {
      const file = join(API_ROOT, rel);
      let src: string;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        stale.push(`${rel} — Datei existiert nicht mehr (${reason})`);
        continue;
      }
      const decl = declarationsOf(src);
      const locals = localConsts(src);
      const anyUnwrapped = [...decl.keys()].some(
        (m) => !isWrapped(m, decl, locals),
      );
      if (!anyUnwrapped) {
        stale.push(
          `${rel} — inzwischen vollständig gewickelt, Eintrag streichen`,
        );
      }
    }
    expect(stale).toEqual([]);
  });
});
