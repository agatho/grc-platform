-- 0436_webhook_secret_column_comment.sql
-- [ARCTOS-FULL-2026-08-31 / WP9 · S10-26 (Info)]
--
-- `webhook_registration.secret_hash` does NOT hold a hash. The value is used
-- directly as the HMAC-SHA256 key (packages/events/src/webhook-signer.ts:32,
-- apps/worker/src/webhooks/webhook-delivery.ts) and the receiving system must
-- know the identical value in order to verify — a shared secret, in clear
-- text, in a column whose name says otherwise.
--
-- The name is the defect: it invites a reviewer to treat the column as
-- non-sensitive (a hash needs no encryption, no rotation, no redaction in
-- exports and backups). Until the rename lands, the database itself states
-- what the column really is; `\d+ webhook_registration` and every schema
-- dump now carry the warning.
--
-- The rename to `signing_secret` touches packages/db schema, packages/events
-- and apps/web/api/v1/webhooks — none of which belong to WP9 — and is handed
-- to WP10 together with the rest of S08 (see /work/audit/remediation/WP9.md,
-- "Bedarf an andere Pakete").

DO $$ BEGIN
  IF to_regclass('public.webhook_registration') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'webhook_registration'
                    AND column_name = 'secret_hash')
  THEN
    EXECUTE $c$
      COMMENT ON COLUMN webhook_registration.secret_hash IS
        'ACHTUNG (WP9/S10-26): trotz des Namens KEIN Hash. Der Wert ist der '
        'HMAC-SHA256-Schluessel der Webhook-Signatur und muss dem Empfaenger '
        'im Klartext bekannt sein — also ein geteiltes Geheimnis. Behandeln '
        'wie ein Secret: nicht in Exporte, nicht in Logs, Rotation vorsehen. '
        'Umbenennung nach signing_secret ist an WP10 uebergeben.'
    $c$;
  END IF;
END $$;
