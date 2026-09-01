-- 0405_audit_trigger_coverage.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-13
--
-- 508 of 527 base tables carried `audit_trigger`. Among the 19 without it
-- were the tables that record the decisions a GRC product exists to
-- evidence:
--
--   approval_decision    — formal release decisions
--   review_decision      — review / four-eyes decisions
--   attestation_response — attestation evidence
--   account              — OAuth identity linkage (account-takeover path)
--   module_definition    — drives requireModule authorisation
--   module_nav_item
--
-- Granting, withdrawing or altering a release left no trace at all.
--
-- Second half of the finding: `audit_sign_off`, `process_sign_off` and
-- `vendor_sign_off` fire the trigger on INSERT only. Their own chain
-- verification runs on the GET of the parent entity and walks the
-- remaining links — so deleting the last sign-off leaves a chain that is
-- still internally consistent and an audit log that never mentions the
-- deletion. UPDATE and DELETE are now audited, and the tables get the
-- same append-only treatment as the other evidence tables.

DO $cover$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'approval_decision', 'review_decision', 'attestation_response',
    'account', 'module_definition', 'module_nav_item'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE WARNING '0405: table % does not exist — audit trigger not created', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
      t || '_audit_trigger', t);
  END LOOP;
END
$cover$;

-- Sign-off tables: INSERT-only → full I/U/D, plus append-only guards.
DO $signoff$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_sign_off', 'process_sign_off', 'vendor_sign_off'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit_trigger', t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
      t || '_audit_trigger', t);

    -- A sign-off is a signature. It is not edited and not withdrawn by
    -- deletion; a withdrawal is a new, separately signed record.
    EXECUTE format('DROP RULE IF EXISTS %I ON public.%I', t || '_no_delete', t);
    EXECUTE format(
      'CREATE RULE %I AS ON DELETE TO public.%I DO INSTEAD NOTHING',
      t || '_no_delete', t);
  END LOOP;
END
$signoff$;

COMMENT ON FUNCTION public.audit_trigger() IS
  'ADR-011 rev.4 generic audit trigger. Builds the payload; the chain (scope, previous_hash, content commitment, entry_hash) is assigned by audit_log_chain_assign() so no write path can bypass it. Whistleblowing tables get an identity-free entry here — the confidential record lives in whistleblowing_audit_log (S03-14 / HinSchG §8).';
