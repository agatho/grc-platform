-- 0443_process_framework_mapping_step.sql
-- [STUFE2-D · Overlay-Endpunkt der BPMN-Engine, docs/bpmn-engine/STUFE2-D-OFFENE-PUNKTE.md]
--
-- ── Warum genau diese eine Spalte ───────────────────────────────────
-- Die GRC-Diagrammschicht (`packages/bpmn/src/grc/**`) bringt 23 Layer mit.
-- Zwölf davon bekommen über den neuen Endpunkt
-- `GET /api/v1/processes/:id/diagram-overlay` echte Daten; elf bleiben leer,
-- weil ihnen im Schema die Heimat fehlt (Bedarfsliste: STUFE2-A2-GRC.md §5,
-- zehn neue Tabellen und dreizehn Erweiterungen).
--
-- Von diesen elf ist **einer** mit einer einzigen nullable Spalte erreichbar:
-- die Framework-Abdeckungssicht F8 (`framework`-Layer, Chips im Slot TL,
-- Kopfzeile mit Abdeckungsgrad, Legende — gebaut und getestet). Sie beantwortet
-- „zeig mir ISO 27001 A.5 über diesen Prozess" **je Anforderung und je
-- Schritt**. `process_framework_mapping` trägt die Zuordnung heute nur am
-- Prozess; die Abdeckung ist damit eine Prozessaussage, und sie an jedes
-- Element zu hängen wäre eine Erfindung — genau die Sorte, die der Endpunkt
-- ausdrücklich nicht macht.
--
-- Alle anderen offenen Layer brauchen neue Tabellen (process_lane, sod_rule,
-- process_step_ropa, process_step_bia, process_event_activity_map …) und
-- gehören damit in die Arbeitspakete, die diese Objekte einführen — nicht in
-- eine Migration am Rande einer Engine-Umstellung.
--
-- ── Semantik ────────────────────────────────────────────────────────
-- `process_step_id IS NULL`  → die Zuordnung gilt für den **ganzen** Prozess.
--                              Das ist der heutige Bestand, und er bleibt
--                              unverändert gültig.
-- `process_step_id` gesetzt  → die Zuordnung gilt für **diesen Schritt**.
--
-- `ON DELETE SET NULL` und nicht CASCADE: Wird der Schritt gelöscht, ist die
-- Anforderung deshalb nicht unzugeordnet — sie fällt auf die Prozessebene
-- zurück, wo sie vorher stand. Eine CASCADE würde beim Umbau eines Diagramms
-- Compliance-Zuordnungen still entfernen, und das ist in einem
-- Prüfungswerkzeug die teuerste denkbare Nebenwirkung.
--
-- Die funktionale Eindeutigkeit `pfm_process_resolved_uniq` (0335) ordnet je
-- Prozess und Katalogeintrag genau eine Zuordnung zu. Eine zusätzliche Zeile
-- für einen *Schritt* desselben Eintrags würde sie verletzen — deshalb wird sie
-- hier durch eine Variante ersetzt, die den Schritt mitführt. `COALESCE(process_step_id::text, '')` hält den
-- bisherigen Fall (NULL) weiterhin eindeutig; die Ausdrücke sind wörtlich die
-- aus 0335, nur um den Schritt erweitert.
--
-- Additiv, ohne Datenverlustrisiko: eine nullable Spalte, ein Index, ein
-- ersetzter Eindeutigkeitsindex.

ALTER TABLE process_framework_mapping
  ADD COLUMN IF NOT EXISTS process_step_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'pfm_process_step_fk'
  ) THEN
    ALTER TABLE process_framework_mapping
      ADD CONSTRAINT pfm_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfm_process_step_idx
  ON process_framework_mapping (process_step_id);

-- Der Eindeutigkeitsindex aus 0335 kennt den Schritt nicht. Ohne diese
-- Ersetzung liesse sich zu einem Katalogeintrag, der bereits am Prozess hängt,
-- keine Schrittzuordnung anlegen — die Spalte wäre da und unbenutzbar.
DROP INDEX IF EXISTS pfm_process_resolved_uniq;

-- Und die **Tabellenbedingung** aus der ursprünglichen Definition, die 0335
-- übersehen hat: `UNIQUE(process_id, catalog_entry_id)`. Sie ist strenger als
-- der funktionale Index, den 0335 an ihre Stelle setzen wollte, und sie hätte
-- die neue Spalte in genau dem Fall unbrauchbar gemacht, für den sie da ist —
-- derselbe Katalogeintrag einmal am Prozess und einmal an einem Schritt.
-- Gefunden, indem die Migration gegen eine leere Datenbank gefahren und der
-- Indexbestand danach angesehen wurde; `\d process_framework_mapping` führt
-- sie als `process_framework_mapping_process_id_catalog_entry_id_key`.
ALTER TABLE process_framework_mapping
  DROP CONSTRAINT IF EXISTS process_framework_mapping_process_id_catalog_entry_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pfm_process_step_resolved_uniq
  ON process_framework_mapping (
    process_id,
    COALESCE(process_step_id::text, ''),
    COALESCE(catalog_entry_id::text, ''),
    COALESCE(framework_code, ''),
    COALESCE(entry_code, '')
  );

COMMENT ON COLUMN process_framework_mapping.process_step_id IS
  'Optionaler Schrittbezug (STUFE2-D). NULL = Zuordnung gilt fuer den ganzen Prozess.';
