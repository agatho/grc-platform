-- 0475_diagram_preference_framework.sql
--
-- Migration: 0475_diagram_preference_framework
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-016] Die Heimat des Sichtwahlparameters
-- `diagram.framework`.
--
-- `GrcDiagramData.framework` (packages/bpmn/src/grc/contract.ts) ist die
-- Auswahl der Sicht F8: WELCHES Rahmenwerk der Abdeckungsgrad in der Kopfzeile
-- meint. `MISSING_TODAY` fuehrte das Feld bis Welle 3b mit der richtigen
-- Begruendung — „Auswahlparameter, keine hinterlegte Tatsache" — und zog daraus
-- die falsche Folge: ein Auswahlparameter ohne Bedienelement ist keine Auswahl,
-- sondern eine Festverdrahtung auf „gar keins". Die Sicht „Compliance &
-- Nachweis" zeigte deshalb nie einen Abdeckungsgrad, obwohl die Zuordnungen
-- (`process_framework_mapping`) vorhanden sind.
--
-- ── Warum diese Tabelle und nicht eine neue ──────────────────────────
-- `user_diagram_preference` (0452) ist bereits das Gedaechtnis der Sichtwahl:
-- Nutzer, Mandant, Bezugsraum, aktive Sicht, abgewaehlte Layergruppen. Die
-- Rahmenwerkauswahl gehoert zu genau derselben Entscheidung („so will ich
-- dieses Diagramm sehen") und hat denselben Lebenszyklus. Eine zweite Tabelle
-- daneben haette eine zweite Loeschregel, eine zweite Policy und zwei
-- Zeitpunkte, an denen eine der beiden fehlen kann.
--
-- ── Warum `varchar(40)` und kein Fremdschluessel auf `catalog` ───────
-- Der Vergleich, den die Diagrammschicht anstellt, ist
-- `GrcFrameworkSelection.frameworkId === GrcFrameworkMapping.frameworkId`
-- (packages/bpmn/src/grc/analysis.ts, `computeFrameworkElement`), und
-- `GrcFrameworkMapping.frameworkId` ist `process_framework_mapping.framework_code`
-- — eine freie Zeichenkette, kein Schluessel. Eine `catalog`-Referenz hier
-- waere eine ANDERE Groesse unter demselben Namen: sie liesse sich speichern
-- und traefe beim Vergleich nie eine Zuordnung. Deshalb dieselbe Form und
-- dieselbe Laenge wie die Spalte, gegen die verglichen wird (varchar(40)).
--
-- Kein Fremdschluessel heisst auch: ein Code, den keine Zuordnung mehr fuehrt,
-- bleibt stehen und die Sicht zeigt dann eine Abdeckung ueber null
-- Anforderungen. Das ist gewollt sichtbar — `summarizeFramework` liefert dafuer
-- `requirements: 0`, und die Kopfzeile nennt die Zahl. Eine Auswahl still
-- zurueckzusetzen waere die schlechtere Eigenschaft: der Nutzer saehe eine
-- Abdeckung und wuesste nicht, worueber.
--
-- ── Audit-Trigger: NEIN, wie bei 0452 ────────────────────────────────
-- Eine Anzeigevoreinstellung ist kein Nachweis; die Begruendung steht
-- vollstaendig im Kopf von 0452 und gilt unveraendert.

ALTER TABLE user_diagram_preference
  ADD COLUMN IF NOT EXISTS framework_code varchar(40);

COMMENT ON COLUMN user_diagram_preference.framework_code IS
  'OP-016: gewaehltes Rahmenwerk der Sicht F8. Vergleichsgroesse ist process_framework_mapping.framework_code (freie Zeichenkette), deshalb varchar und kein FK auf catalog.';
