-- 0478_op089_matviews_to_invoker_views.sql
--
-- Migration: 0478_op089_matviews_to_invoker_views
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-089] Die zwei Materialized Views verlieren
-- ihre mandantenübergreifende Materialisierung.
--
-- ── Befund ──────────────────────────────────────────────────────────
-- Migration 0393 hat für `copilot_usage_stats` und `evidence_review_summary`
-- das Leserecht von `grc_app` und PUBLIC entzogen, mit der Begründung: eine
-- Materialized View kennt kein `security_invoker` und kann keine RLS tragen,
-- ihr Inhalt entsteht beim REFRESH unter dem Eigentümer. Das schliesst den
-- Lesepfad — es ändert aber nichts daran, DASS die Zahlen aller Mandanten in
-- einer gemeinsamen Relation liegen. Genau das ist OP-089: der Zugriff wurde
-- entzogen, die Daten blieben.
--
-- Beim Nachmessen kam ein zweiter, davon unabhängiger Befund dazu:
--
--     $ grep -rn "REFRESH MATERIALIZED" --include=*.sql --include=*.ts \
--           --include=*.mjs . --exclude-dir=node_modules
--     (keine Treffer)
--
-- Es gibt im gesamten Repository KEINEN einzigen REFRESH. Beide Views werden
-- beim `CREATE MATERIALIZED VIEW` einmal gefüllt — in einem Migrationslauf
-- gegen eine leere Datenbank also mit null Zeilen — und danach nie wieder.
-- Sie sind damit nicht nur ein Risiko, sondern auch dauerhaft falsch: wer sie
-- öffnete, bekäme nicht veraltete Zahlen, sondern gar keine. Eine
-- Materialisierung, die nie aufgefrischt wird, ist kein Cache; sie ist ein
-- Schnappschuss des Tages, an dem die Migration lief.
--
-- ── Die drei geprüften Varianten ────────────────────────────────────
--
--  (a) RLS auf der Materialized View oder auf ihrer zugrundeliegenden Sicht.
--      Trägt nicht. PostgreSQL kennt kein `ALTER MATERIALIZED VIEW … ENABLE
--      ROW LEVEL SECURITY` (bis einschliesslich 17 nicht), und die RLS der
--      Basistabellen wirkt beim REFRESH nach dem Kontext des REFRESHENDEN —
--      dort ist `app.current_org_id` nicht gesetzt, und der Eigentümer `grc`
--      ist SUPERUSER. Es gibt hier keine „zugrundeliegende Sicht", auf die
--      man RLS legen könnte: das SELECT steht direkt in der MV.
--
--  (b) Materialisierung je Mandant (eine MV pro Organisation, oder eine
--      Tabelle, die ein Job je Organisation befüllt). Trägt fachlich, kostet
--      aber genau das, was hier keinen Nutzen hat: einen Refresh-Job, eine
--      Invalidierungsregel und n Relationen für eine Aggregation über die
--      Zeilen EINES Mandanten. Beide Abfragen gruppieren mit `GROUP BY
--      org_id` über org-eigene Zeilen; unter RLS ist die Ergebnismenge eine
--      einzige Zeile. Für ein Ergebnis dieser Grösse ist Vorberechnung
--      Aufwand ohne Gegenwert.
--
--  (c) Normale View mit `security_invoker = true`. Trägt, und zwar aus dem
--      Grund, aus dem 0393 alle gewöhnlichen Views darauf gestellt hat: die
--      Basistabellen werden mit den Rechten UND dem RLS-Kontext des Aufrufers
--      gelesen. Alle fünf Basistabellen führen RLS, `FORCE` und eine
--      org-skalierte Policy — gemessen gegen die von Null migrierte
--      Datenbank:
--
--        copilot_conversation | t | t | copilot_conversation_org_isolation …
--        copilot_message      | t | t | copilot_message_org_isolation …
--        copilot_feedback     | t | t | copilot_feedback_org_isolation …
--        evidence_review_job  | t | t | evidence_review_job_org_isolation …
--        evidence_review_gap  | t | t | evidence_review_gap_org_isolation …
--
--      Die von OP-089 verlangte „org-Filterung" muss deshalb nicht neu
--      erfunden werden: sie liegt bereits auf den Basistabellen und wirkt,
--      sobald nicht mehr an ihr vorbei materialisiert wird.
--
-- Entschieden ist (c). Damit verschwindet die gemeinsame Materialisierung
-- ersatzlos — es gibt keine Relation mehr, in der die Zahlen zweier Mandanten
-- nebeneinander liegen — und die Sichten werden dabei zum ersten Mal
-- benutzbar statt nur verschlossen.
--
-- ── Rechte ──────────────────────────────────────────────────────────
-- `grc_app` bekommt SELECT. Das ist kein Rückschritt gegenüber dem REVOKE aus
-- 0393, sondern dessen Auflösung in die richtige Richtung: 0393 musste den
-- Pfad schliessen, weil die MV die Trennung nicht leisten KONNTE; die View
-- leistet sie.
--
-- `grc_worker` bekommt ausdrücklich NICHTS, und das musste ausdrücklich
-- hingeschrieben werden. Beim Nachmessen gegen die frisch migrierte Datenbank
-- trugen beide neu angelegten Views
--
--     {grc=arwdDxt/grc, grc_app=arwd/grc, grc_worker=arwd/grc}
--
-- obwohl diese Migration nur ein SELECT an `grc_app` vergeben hatte. Ursache
-- ist `ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public GRANT SELECT,
-- INSERT, UPDATE, DELETE ON TABLES` aus 0399 und 0437: Default-Privilegien
-- greifen bei jedem KÜNFTIG von `grc` angelegten Objekt, also auch bei jeder
-- View einer späteren Migration. Ein „wir vergeben es einfach nicht" ist
-- gegen diesen Mechanismus wirkungslos — nicht vergeben ist nicht dasselbe
-- wie nicht vorhanden.
--
-- Deshalb steht unten ein explizites `REVOKE ALL` vor dem `GRANT SELECT`. Die
-- Rechteliste sagt danach genau das, was gemeint ist: `grc_app` liest,
-- niemand sonst. `grc_worker` ist BYPASSRLS — für sie hebt jede
-- `security_invoker`-View die Trennung wieder auf, und kein Code liest diese
-- beiden Sichten.
--
-- Der Wächter aus 0397 setzt `security_invoker` bei `CREATE VIEW` selbst; die
-- Migration setzt es zusätzlich explizit, damit sie auch auf einer Datenbank
-- ohne den Event-Trigger vollständig ist.

DROP MATERIALIZED VIEW IF EXISTS public.copilot_usage_stats;

CREATE VIEW public.copilot_usage_stats AS
SELECT
  c.org_id,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT c.user_id) AS unique_users,
  COALESCE(SUM(c.message_count), 0) AS total_messages,
  COALESCE(SUM(c.total_tokens_used), 0) AS total_tokens,
  COUNT(DISTINCT c.id) FILTER (WHERE c.last_message_at > now() - INTERVAL '7 days') AS active_conversations_7d,
  COALESCE(AVG(f.rating) FILTER (WHERE f.rating IS NOT NULL), 0) AS avg_feedback_rating
FROM copilot_conversation c
LEFT JOIN copilot_message m ON m.conversation_id = c.id
LEFT JOIN copilot_feedback f ON f.message_id = m.id
GROUP BY c.org_id;

ALTER VIEW public.copilot_usage_stats SET (security_invoker = true);

DROP MATERIALIZED VIEW IF EXISTS public.evidence_review_summary;

CREATE VIEW public.evidence_review_summary AS
SELECT
  j.org_id,
  COUNT(DISTINCT j.id) AS total_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs,
  COALESCE(SUM(j.total_artifacts), 0) AS total_artifacts_reviewed,
  COALESCE(SUM(j.compliant_artifacts), 0) AS total_compliant,
  COALESCE(SUM(j.non_compliant_artifacts), 0) AS total_non_compliant,
  COALESCE(SUM(j.gaps_identified), 0) AS total_gaps,
  COALESCE(AVG(j.overall_confidence), 0) AS avg_confidence,
  COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'open') AS open_gaps,
  COUNT(DISTINCT g.id) FILTER (WHERE g.severity = 'critical') AS critical_gaps
FROM evidence_review_job j
LEFT JOIN evidence_review_gap g ON g.job_id = j.id
GROUP BY j.org_id;

ALTER VIEW public.evidence_review_summary SET (security_invoker = true);

DO $grants$
DECLARE
  v RECORD;
BEGIN
  FOR v IN SELECT unnest(ARRAY['copilot_usage_stats', 'evidence_review_summary']) AS n
  LOOP
    -- Zuerst leerräumen: ALTER DEFAULT PRIVILEGES (0399/0437) hat der neuen
    -- View bereits arwd für grc_app UND grc_worker mitgegeben. Ohne dieses
    -- REVOKE stünde in der Rechteliste etwas anderes als in diesem Kommentar.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v.n);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_worker') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM grc_worker', v.n);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', v.n);
      EXECUTE format('GRANT SELECT ON public.%I TO grc_app', v.n);
    END IF;
  END LOOP;
END
$grants$;

COMMENT ON VIEW public.copilot_usage_stats IS
  'ARCTOS/OP-089: war eine Materialized View und damit mandantenuebergreifend '
  'materialisiert (und ohne REFRESH dauerhaft leer). Jetzt security_invoker: '
  'die RLS von copilot_conversation/-message/-feedback wirkt beim Lesen.';

COMMENT ON VIEW public.evidence_review_summary IS
  'ARCTOS/OP-089: war eine Materialized View und damit mandantenuebergreifend '
  'materialisiert (und ohne REFRESH dauerhaft leer). Jetzt security_invoker: '
  'die RLS von evidence_review_job/-gap wirkt beim Lesen.';
