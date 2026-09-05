-- 0453_control_key_and_owner_role.sql
--
-- Migration: 0453_control_key_and_owner_role
-- Breaking: no
-- Estimated-Duration: 15
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.2]
--
-- Schliesst zwei der drei Felder, die STUFE2-D §1.5 innerhalb sonst
-- gefuellter Layer als geraten und deshalb weggelassen ausweist:
-- `controls[].isKey` und `controls[].ownerRole`.
--
-- ── `is_key`: warum das ueberhaupt eine eigene Spalte braucht ────────
-- Der Plan nimmt in §3.4/A2 an, dass Schluesselkontrollen im Text der
-- Kontrollbeschreibung stehen. Sie dort herauszulesen waere eine Erfindung
-- mit dem denkbar schlechtesten Fehlerprofil: eine Kontrolle faelschlich als
-- Schluesselkontrolle zu markieren erzeugt Aufwand, eine echte
-- Schluesselkontrolle zu uebersehen erzeugt ein Testloch, das erst in der
-- Jahresabschlusspruefung auffaellt. `boolean NOT NULL DEFAULT false` — die
-- Vorgabe ist "keine Schluesselkontrolle", weil das die Aussage ist, die
-- niemanden in falsche Sicherheit wiegt.
--
-- ── `owner_role_id`: warum eine Rolle und nicht der vorhandene Benutzer ─
-- `control.owner_id` zeigt auf einen BENUTZER. Die Selbstkontroll-Pruefung
-- (§3.4/A4, `computeSelfControls`) fragt aber: "verantwortet DIESELBE ROLLE
-- die Aktivitaet und ihre einzige Kontrolle?" — ein Benutzervergleich
-- beantwortet das nicht, weil die Aktivitaet ueber `custom_role` zugeordnet
-- ist. Ohne diese Spalte ist die Pruefung nicht rechenbar, und der Layer
-- `sod` verliert seine zweite Haelfte (die Selbstkontrolle neben dem
-- Regelkonflikt).
--
-- ON DELETE SET NULL, nicht RESTRICT: die Eigentuemerrolle ist weder Nachweis
-- noch Freigabe (S09-10 zielt auf beides). Faellt sie weg, ist die
-- Selbstkontroll-Pruefung fuer diese Kontrolle schlicht NICHT DURCHFUEHRBAR —
-- und die Diagrammschicht meldet dann nichts, statt etwas zu behaupten. Das
-- ist der ehrliche Zustand. RESTRICT haette statt dessen jede Rollenbereinigung
-- an einer beliebig alten Kontrolle scheitern lassen.
--
-- ── Die beiden Spalten, die NICHT kommen — und warum ─────────────────
-- §5.2 nennt in derselben Zeile `last_test_result` und `last_evidence_at`
-- (mit dem "bzw. `control_test_execution`", das die Unsicherheit der Vorlage
-- schon anzeigt). Sie werden hier bewusst NICHT angelegt.
--
-- Beide sind heute bereits ableitbar und werden abgeleitet: der
-- Overlay-Endpunkt liest den letzten Test aus `control_test` (juengstes
-- `test_date`, `toe_result`) und den juengsten Nachweis aus
-- `evidence(entity_type='control')` — als korrelierte Unterabfragen, mit
-- Index bedient und getestet. Eine gespeicherte Kopie daneben waere eine
-- ZWEITE WAHRHEIT, die nichts pflegt: kein Trigger, kein Dienst, kein
-- Anwendungspfad schriebe sie fort. Der erste Kontrolltest nach dieser
-- Migration liesse `control.last_test_result` auf dem Stand von heute stehen,
-- und ein Pruefungswerkzeug zeigte "zuletzt geprueft: bestanden" fuer eine
-- Kontrolle, die gestern durchgefallen ist. Genau diese Fehlerklasse — eine
-- Anzeige, die eine Aussage macht, die die Daten nicht tragen — ist der Grund
-- fuer die ganze Arbeit an diesem Endpunkt.
--
-- `evidence_due_at` kommt dagegen sehr wohl: die naechste FAELLIGKEIT eines
-- Nachweises ist aus dem Bestand NICHT ableitbar (aus `control.frequency`
-- liesse sie sich hochrechnen, aber eine hochgerechnete Faelligkeit ist
-- wieder eine Behauptung). Ohne sie faellt F4 auf die Altersregel der
-- GRC-Schicht zurueck — was funktioniert, aber "seit 40 Tagen kein Nachweis"
-- statt "seit 10 Tagen ueberfaellig" sagt.
--
-- ── Audit-Trigger ───────────────────────────────────────────────────
-- `control` traegt seit 0011 einen. Die drei Spalten kommen damit ohne
-- weiteres Zutun in die Nachweiskette — und `is_key` gehoert dort hinein: das
-- Herabstufen einer Schluesselkontrolle ist der wirksamste Weg, einen
-- Testumfang zu verkleinern.

ALTER TABLE control
  ADD COLUMN IF NOT EXISTS is_key boolean NOT NULL DEFAULT false;

ALTER TABLE control
  ADD COLUMN IF NOT EXISTS owner_role_id uuid;

ALTER TABLE control
  ADD COLUMN IF NOT EXISTS evidence_due_at timestamptz;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_owner_role_fk') THEN
    ALTER TABLE control
      ADD CONSTRAINT control_owner_role_fk
      FOREIGN KEY (owner_role_id) REFERENCES custom_role(id) ON DELETE SET NULL;
  END IF;
END
$fk$;

-- S09-13: Index auf dem neuen Fremdschluessel.
CREATE INDEX IF NOT EXISTS control_owner_role_idx ON control (owner_role_id);
-- Die Faelligkeitsampel F4 fragt "welche Kontrollen dieses Mandanten sind
-- ueberfaellig" — org_id fuehrend (S09-14), Faelligkeit danach.
CREATE INDEX IF NOT EXISTS control_evidence_due_idx ON control (org_id, evidence_due_at);
CREATE INDEX IF NOT EXISTS control_is_key_idx ON control (org_id, is_key);

COMMENT ON COLUMN control.is_key IS
  'STUFE2-E: Schluesselkontrolle (GrcControl.isKey). Ausdruecklich gesetzt, nicht aus der Beschreibung erraten.';
COMMENT ON COLUMN control.owner_role_id IS
  'STUFE2-E: verantwortliche ROLLE der Kontrolle — Grundlage der Selbstkontroll-Pruefung (§3.4/A4). control.owner_id zeigt auf einen Benutzer und beantwortet diese Frage nicht.';
COMMENT ON COLUMN control.evidence_due_at IS
  'STUFE2-E: naechste Faelligkeit des Nachweises (F4). Bewusst gepflegt statt aus control.frequency hochgerechnet. last_test_result/last_evidence_at kommen absichtlich NICHT als Spalten — siehe Kopfkommentar von 0453.';
