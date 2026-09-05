// [ARCTOS-FULL-2026-08-31 · OP-058] Laufzeit-Smoke über die grossen
// Listenendpunkte — der fehlende Nachweis zur 1.170-Routen-Transformation.
//
// Was war. `E2E-TRIAGE.md` C-01: 1.170 der 1.362 Route-Dateien riefen
// `withAuth(` auf, ohne in `withErrorHandler` gewickelt zu sein. Nur der
// Wrapper öffnet den `requestDbStorage.run()`-Rahmen, an den `withAuth` die
// org-gepinnte Verbindung bindet (`lib/api.ts:184`); ohne ihn liest der
// Handler aus dem kontextlosen Pool, RLS filtert jede Zeile, und der Endpunkt
// antwortet **200 mit `{"data":[],"total":0}`**. Das ist die gefährlichste
// Fehlerform dieses Produkts: ein Fehler, der wie ein Datenbestand aussieht.
//
// 1.168 Dateien wurden daraufhin mechanisch gewickelt. §7.5 desselben Berichts
// hält fest, was danach fehlte: „Alle sind gewickelt, aber keine wurde zur
// Laufzeit überprüft. … Trotzdem gehört nach dem Build ein Smoke-Durchlauf über
// die grossen Listenendpunkte, bevor das Ergebnis als bestätigt gilt."
//
// Warum ein Unit-Test das nicht leisten kann. `all-routes-auth-smoke.test.ts`
// prüft alle 1.370 Routen — aber mit gemocktem `@/lib/api`, gemocktem `@grc/db`
// und ohne Session. Es beweist, dass ein unangemeldeter Aufruf 401 bekommt,
// und kann über den Erfolgspfad nichts sagen: der Defekt lag genau dort, wo
// alles „funktionierte" und trotzdem nichts zurückkam.
//
// Was diese Datei tut. Sie fährt dieselbe Kette wie ein Browser —
// `withErrorHandler → withAuth → establishRequestScopedContext → requireModule
// → die db-Reads der Route` — gegen eine echte Datenbank, als Rolle `grc_app`
// (nicht Superuser, RLS scharf), innerhalb eines äusseren
// `requestDbStorage.run()`-Rahmens, der die Async-Kontextbedingung des Next App
// Routers nachbildet (Begründung siehe `risks-route-rls.test.ts`).
//
// Die Zusicherung ist bewusst „mindestens eine Zeile", nicht „Status 200":
// **200 war der Defekt.** Ein Smoke, der nur den Statuscode prüft, wäre gegen
// C-01 vollständig blind gewesen.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  db,
  organization,
  user,
  userOrganizationRole,
  moduleConfig,
  moduleDefinition,
  requestClient,
  requestDbStorage,
  baseDb,
  schema,
  type RequestDbStore,
} from "@grc/db";

const h = vi.hoisted(() => ({
  sessionUserId: "",
  currentOrgId: "" as string | null,
  roles: [] as Array<{ orgId: string; role: string }>,
  afterCbs: [] as Array<() => unknown | Promise<unknown>>,
}));

vi.mock("@/auth", () => ({
  auth: async () =>
    h.sessionUserId
      ? {
          user: {
            id: h.sessionUserId,
            email: "op058@test.dev",
            name: "OP-058 Smoke",
            roles: h.roles,
          },
        }
      : null,
}));

vi.mock("@grc/auth/context", () => ({
  getCurrentOrgId: async () => h.currentOrgId || null,
}));

// `after()` existiert im Testrunner nicht; die Freigabe der reservierten
// Verbindung wird eingesammelt und nach jedem Test abgearbeitet.
vi.mock("next/server", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    after: (fn: () => unknown | Promise<unknown>) => {
      h.afterCbs.push(fn);
    },
  };
});

const SU_URL = process.env.DATABASE_URL!; // [OP-170] kein Rueckfallwert: setup-require-roles.ts erzwingt ihn
const suClient = postgres(SU_URL, { max: 1 });
const adminDb = drizzle(suClient, { schema });

const suffix = Date.now();
let orgAId = "";
let orgBId = "";
let userAId = "";

function makeBaseStore(): RequestDbStore {
  return { db: baseDb, reserved: null, orgId: "", userId: "", released: true };
}

/**
 * Ein Listenendpunkt, wie ihn diese Datei fährt.
 *
 * `orgField` ist optional, weil nicht jede Projektion `orgId` mitliefert
 * (`/users` gibt eine Picker-Projektion aus). Wo das Feld fehlt, bleibt die
 * Mandantenaussage der RLS-Suite überlassen und hier steht nur die
 * Laufzeitaussage — genau abgegrenzt statt stillschweigend weggelassen.
 */
interface ListEndpoint {
  readonly name: string;
  readonly load: () => Promise<{
    GET: (req: Request, ctx: never) => Promise<Response>;
  }>;
  readonly url: string;
  /** Modul, das `requireModule` verlangt. */
  readonly module?: string;
  /** Feld der Zeile, das die Organisation trägt. */
  readonly orgField?: string;
}

// Die Auswahl folgt der Formulierung des Berichts („die grossen
// Listenendpunkte"): je Modul die Liste, die die Startseite des Moduls füllt,
// plus die drei modul-losen Querlisten und der Audit-Trail. Elf Endpunkte über
// sieben Module und vier verschiedene Leseformen — ORM-Select mit `count()`
// (risks, controls, documents, processes, findings, vendors, assets,
// work-items, incidents), roher `db.execute`-SQL (users) und die
// Descendant-Scope-Abfrage auf `audit_log`, deren Tabelle als einzige
// abweichende GRANTs trägt (Migration 0407).
const ENDPOINTS: readonly ListEndpoint[] = [
  {
    name: "GET /api/v1/risks",
    load: () => import("@/app/api/v1/risks/route"),
    url: "http://localhost/api/v1/risks",
    module: "erm",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/controls",
    load: () => import("@/app/api/v1/controls/route"),
    url: "http://localhost/api/v1/controls",
    module: "ics",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/findings",
    load: () => import("@/app/api/v1/findings/route"),
    url: "http://localhost/api/v1/findings",
    module: "ics",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/documents",
    load: () => import("@/app/api/v1/documents/route"),
    url: "http://localhost/api/v1/documents",
    module: "dms",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/processes",
    load: () => import("@/app/api/v1/processes/route"),
    url: "http://localhost/api/v1/processes",
    module: "bpm",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/vendors",
    load: () => import("@/app/api/v1/vendors/route"),
    url: "http://localhost/api/v1/vendors",
    module: "tprm",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/isms/incidents",
    load: () => import("@/app/api/v1/isms/incidents/route"),
    url: "http://localhost/api/v1/isms/incidents",
    module: "isms",
  },
  {
    name: "GET /api/v1/assets",
    load: () => import("@/app/api/v1/assets/route"),
    url: "http://localhost/api/v1/assets",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/work-items",
    load: () => import("@/app/api/v1/work-items/route"),
    url: "http://localhost/api/v1/work-items",
    orgField: "orgId",
  },
  {
    name: "GET /api/v1/users",
    load: () => import("@/app/api/v1/users/route"),
    url: "http://localhost/api/v1/users",
  },
  {
    name: "GET /api/v1/audit-log",
    load: () => import("@/app/api/v1/audit-log/route"),
    url: "http://localhost/api/v1/audit-log",
  },
];

interface ListBody {
  data: Array<Record<string, unknown>>;
  pagination?: { total: number };
}

async function callList(endpoint: ListEndpoint): Promise<{
  status: number;
  body: ListBody;
}> {
  const mod = await endpoint.load();
  const req = new Request(endpoint.url, { method: "GET" });
  const res = (await requestDbStorage.run(makeBaseStore(), () =>
    mod.GET(req, undefined as never),
  )) as Response;
  const body =
    res.status === 200 ? ((await res.json()) as ListBody) : { data: [] };
  return { status: res.status, body };
}

/** Rohes INSERT als Superuser, ohne ORM-Schemabindung. */
async function insertRow(
  table: string,
  values: Record<string, string | number | boolean>,
): Promise<void> {
  const cols = Object.keys(values)
    .map((c) => `"${c}"`)
    .join(", ");
  const params = Object.values(values);
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  await suClient.unsafe(
    `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders})`,
    params,
  );
}

describe("OP-058 · Laufzeit-Smoke über die grossen Listenendpunkte", () => {
  beforeAll(async () => {
    await suClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      -- Gegenstueck zum pauschalen GRANT: die Auth.js-Tokentabellen sind seit
      -- 0392 deny-all und die Materialized Views seit 0393 fuer die
      -- Laufzeitrolle gesperrt. Ohne diesen REVOKE hebt dieser Test beide
      -- Kontrollen dauerhaft auf und der RLS-Systemtest wird danach rot —
      -- gemessen am 2026-09-01, siehe risks-route-rls.test.ts.
      REVOKE ALL ON public.session, public.account, public.verification_token
        FROM grc_app;
      REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM grc_app;
      DO $revoke_mv$ DECLARE r record; BEGIN
        FOR r IN SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind = 'm' LOOP
          EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', r.relname);
        END LOOP;
      END $revoke_mv$;
    `);

    for (const [key, name] of [
      ["erm", "Enterprise Risk Management"],
      ["ics", "Internal Control System"],
      ["dms", "Document Management"],
      ["bpm", "Business Process Management"],
      ["tprm", "Third Party Risk Management"],
      ["isms", "Information Security Management"],
    ] as const) {
      await adminDb
        .insert(moduleDefinition)
        .values({
          moduleKey: key,
          displayNameDe: name,
          displayNameEn: name,
          navOrder: 1,
        })
        .onConflictDoNothing();
    }

    const [orgA] = await adminDb
      .insert(organization)
      .values({
        name: `OP058 Org A ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    const [orgB] = await adminDb
      .insert(organization)
      .values({
        name: `OP058 Org B ${suffix}`,
        type: "subsidiary",
        country: "AUT",
      })
      .returning({ id: organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [uA] = await adminDb
      .insert(user)
      .values({
        email: `op058-${suffix}@test.dev`,
        name: "OP-058 Smoke",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    userAId = uA.id;
    await adminDb
      .insert(userOrganizationRole)
      .values({ userId: userAId, orgId: orgAId, role: "admin" });

    await adminDb.insert(moduleConfig).values(
      (["erm", "ics", "dms", "bpm", "tprm", "isms"] as const).flatMap((key) =>
        [orgAId, orgBId].map((org) => ({
          orgId: org,
          moduleKey: key,
          uiStatus: "enabled" as const,
          isDataActive: true,
        })),
      ),
    );

    // Je eine Zeile pro Mandant in jeder gelesenen Tabelle. Die Zeile von
    // Org B ist nicht Zierde: ohne sie wäre "nur eigene Zeilen" auch dann
    // erfüllt, wenn es gar keine fremden gäbe.
    for (const org of [orgAId, orgBId]) {
      const tag = org === orgAId ? "A" : "B";
      await insertRow("risk", {
        org_id: org,
        title: `OP058 Risk ${tag} ${suffix}`,
        risk_category: "operational",
        risk_source: "erm",
      });
      await insertRow("control", {
        org_id: org,
        title: `OP058 Control ${tag} ${suffix}`,
        control_type: "preventive",
      });
      await insertRow("finding", {
        org_id: org,
        title: `OP058 Finding ${tag} ${suffix}`,
        severity: "observation",
      });
      await insertRow("document", {
        org_id: org,
        title: `OP058 Document ${tag} ${suffix}`,
      });
      await insertRow("process", {
        org_id: org,
        name: `OP058 Process ${tag} ${suffix}`,
      });
      await insertRow("vendor", {
        org_id: org,
        name: `OP058 Vendor ${tag} ${suffix}`,
      });
      await insertRow("asset", {
        org_id: org,
        name: `OP058 Asset ${tag} ${suffix}`,
      });
      await insertRow("work_item", {
        org_id: org,
        type_key: "process",
        name: `OP058 WorkItem ${tag} ${suffix}`,
      });
      await insertRow("security_incident", {
        org_id: org,
        element_id: `OP058-${tag}-${suffix % 100000}`,
        title: `OP058 Incident ${tag} ${suffix}`,
      });
      // Der Audit-Trail wird über die SECURITY-DEFINER-Funktion beschrieben,
      // die Migration 0407 als einzigen Schreibweg vorsieht — nicht per
      // INSERT. Ein Testaufbau, der die Kette umgeht, prüft danach eine
      // Tabelle, die es so in Produktion nicht gibt.
      await suClient.unsafe(
        `SELECT set_config('app.current_org_id', $1, false),
                set_config('app.current_user_id', $2, false)`,
        [org, userAId],
      );
      await suClient.unsafe(
        `SELECT write_audit_entry($1::uuid, $2::uuid, NULL, NULL, 'process',
                                  NULL, $3::text, 'update', 'op058_smoke',
                                  NULL, NULL, NULL)`,
        [org, userAId, `OP058 Audit ${tag} ${suffix}`],
      );
    }
    await suClient.unsafe(
      `SELECT set_config('app.current_org_id', '', false),
              set_config('app.current_user_id', '', false)`,
    );

    h.sessionUserId = userAId;
    h.currentOrgId = orgAId;
    h.roles = [{ orgId: orgAId, role: "admin" }];
  }, 120_000);

  afterEach(async () => {
    const cbs = h.afterCbs.splice(0);
    for (const cb of cbs) {
      try {
        await cb();
      } catch {
        /* ignore */
      }
    }
  });

  afterAll(async () => {
    await suClient.unsafe(`SET session_replication_role = 'replica'`);
    for (const table of [
      "audit_log",
      "security_incident",
      "work_item",
      "asset",
      "vendor",
      "process",
      "document",
      "finding",
      "control",
      "risk",
      "module_config",
      "user_organization_role",
    ]) {
      try {
        await suClient.unsafe(
          `DELETE FROM public."${table}" WHERE org_id IN ($1, $2)`,
          [orgAId, orgBId],
        );
      } catch {
        /* append-only guard — die Zeile bleibt, sie stört niemanden */
      }
    }
    await suClient.unsafe(`DELETE FROM "user" WHERE id = $1`, [userAId]);
    await suClient.unsafe(`DELETE FROM organization WHERE id IN ($1, $2)`, [
      orgAId,
      orgBId,
    ]);
    await suClient.unsafe(`SET session_replication_role = 'origin'`);

    await suClient.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  }, 60_000);

  for (const endpoint of ENDPOINTS) {
    it(`${endpoint.name} liefert die Zeilen des Mandanten`, async () => {
      const { status, body } = await callList(endpoint);

      expect(status, `${endpoint.name} antwortete ${status}`).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);

      // Die eigentliche Aussage. C-01 antwortete hier mit 200 und `[]`; eine
      // leere Liste ist deshalb der Fehlerfall, nicht der Randfall.
      //
      // [gemessen 2026-09-03] Was diese Zusicherung tatsächlich hält, ist die
      // **Herstellung des mandantengebundenen Kontexts**, nicht die blosse
      // Anwesenheit von `withErrorHandler`: nimmt man einer Route hier den
      // Wrapper weg, bleibt der Test grün, weil der äussere
      // `requestDbStorage.run()`-Rahmen dieser Datei denselben Store liefert,
      // den der Wrapper öffnen würde. Rot wird er, sobald
      // `establishRequestScopedContext` den Store nicht mehr trifft — dann
      // liefern alle elf Endpunkte 200 mit 0 Zeilen. Genau das ist C-01.
      expect(
        body.data.length,
        `${endpoint.name} lieferte 0 Zeilen. Genau so sah C-01 aus: der ` +
          `Handler lief ohne request-scoped Kontext, RLS filterte alles, und ` +
          `der Endpunkt meldete einen leeren Datenbestand statt eines Fehlers. ` +
          `Prüfen: bindet establishRequestScopedContext (lib/api.ts) die ` +
          `reservierte Verbindung noch an den ALS-Rahmen, und öffnet ` +
          `withErrorHandler diesen Rahmen noch?`,
      ).toBeGreaterThan(0);

      if (body.pagination) {
        expect(body.pagination.total).toBeGreaterThan(0);
      }

      if (endpoint.orgField) {
        const foreign = body.data.filter(
          (row) => row[endpoint.orgField!] !== orgAId,
        );
        expect(
          foreign,
          `${endpoint.name} lieferte Zeilen fremder Mandanten`,
        ).toEqual([]);
      }
    }, 30_000);
  }

  // Die Gegenprobe zur Zusicherung oben: derselbe Aufruf ohne Session muss
  // 401 sein. Sonst könnte "mindestens eine Zeile" auch von einer Route
  // kommen, die gar nicht prüft, wer fragt.
  it("dieselben Endpunkte antworten ohne Session mit 401", async () => {
    const previousUser = h.sessionUserId;
    const previousOrg = h.currentOrgId;
    h.sessionUserId = "";
    h.currentOrgId = null;
    try {
      const statuses: Record<string, number> = {};
      for (const endpoint of ENDPOINTS) {
        const mod = await endpoint.load();
        const res = (await requestDbStorage.run(makeBaseStore(), () =>
          mod.GET(
            new Request(endpoint.url, { method: "GET" }),
            undefined as never,
          ),
        )) as Response;
        statuses[endpoint.name] = res.status;
      }
      const notRejected = Object.entries(statuses).filter(
        ([, code]) => code !== 401 && code !== 403,
      );
      expect(notRejected).toEqual([]);
    } finally {
      h.sessionUserId = previousUser;
      h.currentOrgId = previousOrg;
    }
  }, 60_000);
});
