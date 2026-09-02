-- 0442_management_review_action_element_id.sql
-- [E2E-TRIAGE-3 · 2026-09-02]
--
-- Befund: `POST /api/v1/isms/reviews/:id/items` mit einer Massnahme liefert
-- `actionWorkItemId` gesetzt, aber `actionElementId: null` — gemessen an der
-- laufenden Instanz:
--
--   {"actionWorkItemId":"0c117077-…","actionElementId":null}
--
-- Das ist KEINE veraltete Testerwartung. Der Routenhandler ist korrekt: er
-- liest `element_id` aus dem `RETURNING` des INSERTs, und der Trigger
-- `generate_work_item_element_id` ist ein BEFORE-INSERT-Trigger, dessen
-- Ergebnis im RETURNING enthalten waere. Der Trigger steigt jedoch als
-- Erstes wieder aus:
--
--   SELECT element_id_prefix INTO v_prefix FROM work_item_type WHERE …;
--   IF v_prefix IS NULL THEN RETURN NEW; END IF;   -- <- hier
--
-- `0369_management_review_cockpit.sql` registriert den Typ
-- `management_review_action`, listet `element_id_prefix` in seiner
-- Spaltenliste aber gar nicht auf; die Spalte bleibt NULL — der Typ faellt
-- damit als einziger auf diesem Schreibpfad aus der Element-ID-Vergabe heraus.
-- Selbstpruefung 3 protokolliert am Ende, welche aktiven Typen ohne Praefix
-- bleiben, damit der naechste Fall nicht wieder unbemerkt entsteht.
--
-- Fachliche Wirkung, nicht nur ein fehlendes Feld: die Element-ID ist die
-- menschenlesbare Referenz einer Massnahme. Ohne sie zeigt
--   apps/web/.../isms/reviews/[id]/page.tsx:1435   eine leere Zelle,
--   .../isms/reviews/[id]/export/pdf/route.ts:180  eine Zeile, die mit einem
--                                                  Leerzeichen beginnt,
-- und das Protokoll des Management-Reviews nach ISO 27001 9.3.3 nennt seine
-- Beschluss-Massnahmen ohne Aktenzeichen. Genau dieselbe Teilursache und
-- dieselbe Loesung hatten 0301, 0310 und 0439 fuer den FK auf
-- `work_item_type` — dies ist derselbe Katalogmangel eine Spalte weiter.
--
-- `MRA` ist frei (vergeben sind AUA, AUD, AUF, BCP, BIA, CTL, DFA, DOK, DPA,
-- DSR, ESG, EXC, FND, HWG, INC, POL, PRZ, RCS, ROP, RSK, SOA, TIA, TRT, VND,
-- VTR, VVT — gegen die Datenbank geprueft, nicht angenommen).
--
-- Idempotent: das UPDATE ist auf `element_id_prefix IS NULL` eingeschraenkt,
-- der Backfill auf `element_id IS NULL`.

UPDATE work_item_type
   SET element_id_prefix = 'MRA'
 WHERE type_key = 'management_review_action'
   AND element_id_prefix IS NULL;

-- Bestandszeilen nachziehen. Die Nummerierung folgt exakt der des Triggers
-- (`COUNT(*) + 1` je org_id + type_key, LPAD auf 3 Stellen): fuer jeden
-- Mandanten in Anlagereihenfolge durchnummeriert, damit eine spaeter
-- angelegte Massnahme luecken- und kollisionsfrei anschliesst.
WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY org_id
                            ORDER BY created_at, id) AS seq
    FROM work_item
   WHERE type_key = 'management_review_action'
     AND element_id IS NULL
)
UPDATE work_item w
   SET element_id = 'MRA-' || LPAD(numbered.seq::text, 3, '0')
  FROM numbered
 WHERE w.id = numbered.id;

-- Selbstpruefung 1: der Praefix steht.
DO $$
DECLARE
  v_prefix text;
BEGIN
  SELECT element_id_prefix INTO v_prefix
    FROM work_item_type WHERE type_key = 'management_review_action';
  IF v_prefix IS DISTINCT FROM 'MRA' THEN
    RAISE EXCEPTION
      '0442: element_id_prefix fuer management_review_action ist %, erwartet MRA',
      coalesce(v_prefix, 'NULL');
  END IF;
END $$;

-- Selbstpruefung 2: keine Massnahme ohne Element-ID mehr.
DO $$
DECLARE
  v_missing bigint;
BEGIN
  SELECT count(*) INTO v_missing
    FROM work_item
   WHERE type_key = 'management_review_action' AND element_id IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION '0442: % work_item-Zeilen ohne element_id verblieben',
      v_missing;
  END IF;
  RAISE NOTICE '0442: management_review_action hat Praefix MRA, Bestand nachgezogen.';
END $$;

-- Selbstpruefung 3: Zustandsbericht ueber alle aktiven Typen ohne Praefix.
-- Bewusst nur ein NOTICE — welche Typen eine Element-ID fuehren sollen, ist
-- eine fachliche Entscheidung je Typ und nicht Sache dieser Migration.
-- (Anmerkung: 0439 verweist auf ein
-- `packages/db/tests/unit/work-item-type-registry.test.ts`, das im Repository
-- nicht existiert; die dauerhafte Gegenprobe fuer DIESEN Fall ist
-- `apps/web/e2e/management-review.spec.ts`, das `actionElementId` prueft.)
DO $$
DECLARE
  v_without text[];
BEGIN
  SELECT array_agg(type_key ORDER BY type_key) INTO v_without
    FROM work_item_type
   WHERE element_id_prefix IS NULL AND is_active_in_platform;
  IF v_without IS NOT NULL THEN
    RAISE NOTICE '0442: aktive work_item_type ohne element_id_prefix: %',
      v_without;
  ELSE
    RAISE NOTICE '0442: jeder aktive work_item_type hat einen element_id_prefix.';
  END IF;
END $$;
