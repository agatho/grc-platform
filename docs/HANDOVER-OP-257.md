# Handover — OP-257: the CodeQL check is red

**To:** the local Claude Code session
**From:** the cloud session (audit ARCTOS-FULL-2026-08-31)
**Date:** 2026-09-10
**Branch:** `audit/full-2026-08-31`, measured against `refs/pull/431/merge`
**Run this in:** `C:\Users\daimon\Downloads\grcfiles\arctos-audit-build`

---

## 1. Read this part first — it is the actual finding

Your report said the pipeline was green apart from the Pilot Readiness Gate. It
wasn't, and the reason it looked that way is worth more than the alerts
themselves.

`gh pr checks 431` lists **two** entries with almost the same name:

```
CodeQL Analysis (javascript-typescript)   pass   4m36s   ← the scan JOB
CodeQL                                    fail      7s   ← the RESULT
```

The green one says _the scan ran_. The red one says _what it found_:
**"28 new alerts including 17 high severity security vulnerabilities."**

Counting workflows finds the first and misses the second. That is the same
shape this audit has recorded eighteen times — a green name that is not the
assertion — and this time it nearly carried a sign-off. Neither of us caught
it by reading the check list; it took querying the API.

**Practical consequence for you:** `gh pr checks` is not sufficient evidence of
a green PR. Add this, which returns the failures with their reasons:

```powershell
gh api "repos/agatho/grc-platform/commits/<sha>/check-runs" `
  --jq '.check_runs[] | select(.conclusion==\"failure\") | .name + \" | \" + (.output.title // \"\")'
```

---

## 2. What is actually open

**59 alerts on `refs/pull/431/merge`, 37 of them `high`.** By location:

| Where        | high alerts |
| ------------ | ----------- |
| product code | **19**      |
| `scripts/**` | 12          |
| tests        | 6           |

**None were created today.** By creation date: 9 from March, one each in April,
May and July, **20 between 2026-09-01 and 2026-09-04** — this audit's own
working window — and one on 2026-09-09. So this is neither a regression from
today nor someone else's legacy.

Full list of the 37, grouped, with creation date and alert number:

```
js/polynomial-redos (14)
  PRODUCT  packages/ai/src/output-schemas.ts:390                  [09-01] #1629
  PRODUCT  packages/ai/src/prompts/bpm.ts:196                     [05-17] #1436
  PRODUCT  packages/ai/src/prompts/isms-intelligence.ts:149       [03-28] #452
  PRODUCT  packages/ai/src/prompts/isms-intelligence.ts:187       [03-28] #453
  PRODUCT  packages/ai/src/prompts/translate.ts:137               [09-04] #1809
  PRODUCT  packages/auth/src/oidc/discovery.ts:16                 [03-28] #356
  PRODUCT  packages/auth/src/saml/response-validator.ts:674       [09-04] #1810
  PRODUCT  packages/auth/src/saml/response-validator.ts:682       [09-04] #1811
  PRODUCT  packages/auth/src/saml/response-validator.ts:688       [09-01] #1631
  PRODUCT  packages/shared/src/lib/file-storage.ts:179            [09-01] #1632
  PRODUCT  packages/shared/src/lib/freetsa.ts:760                 [09-01] #1633
  PRODUCT  packages/shared/src/utils/xliff.ts:115                 [09-04] #1812
  PRODUCT  packages/shared/src/utils/xliff.ts:129                 [03-28] #382
  PRODUCT  packages/shared/src/utils/xliff.ts:130                 [03-28] #383

js/file-system-race (8)   — all in scripts/**, one in a test
  script   scripts/audit-dead-exports.mjs:436                     [09-03] #1808
  script   scripts/audit-secrets.mjs:456                          [04-18] #1081
  script   scripts/check-route-rls-context.mjs:139                [09-02] #1801
  script   scripts/coverage-gate.mjs:152                          [09-02] #1799
  script   scripts/lib/dep-tree.mjs:101                           [09-01] #1636
  script   scripts/license-gate.mjs:172                           [09-01] #1637
  script   scripts/verify-db-integrity.mjs:228                    [09-04] #1813
  test     .../__tests__/components/bpmn-moddle-declaration.test.ts:133  [09-03] #1804

js/incomplete-sanitization (7)   — scripts and tests only
  script   scripts/audit-i18n-usage.mjs:378                       [09-07] #1816
  script   scripts/audit-n-plus-one.mjs:158                       [04-18] #1080
  script   scripts/generate-api-reference.mjs:142                 [09-01] #1635
  test     .../__tests__/i18n/wave6b-surfaces.test.ts:447         [09-07] #1815
  test     .../__tests__/i18n/wave8b-surfaces.test.ts:159         [09-09] #1823
  test     packages/bpmn/test/model/measure-roundtrip.ts:32       [09-02] #1713
  test     packages/shared/tests/dashboard-cache.test.ts:24       [03-28] #460

js/incomplete-multi-character-sanitization (3)
  PRODUCT  apps/web/src/app/api/v1/tags/route.ts:16               [04-20] #1119
  PRODUCT  apps/web/src/lib/documents/extract-text.ts:54          [07-10] #1587
  PRODUCT  apps/worker/src/crons/threat-feed-sync.ts:43           [03-28] #488

js/redos (2)              — both in test files
  test     .../__tests__/lint/api-v1-lint-gate.test.ts:65         [09-03] #1807
  test     apps/worker/tests/lib/no-console-gate.test.ts:49       [09-03] #1806

js/regex/missing-regexp-anchor (1)
  script   scripts/audit-secrets.mjs:166                          [09-01] #1638

js/insecure-temporary-file (1)
  PRODUCT  packages/reporting/src/generator.ts:165                [03-28] #489

js/double-escaping (1)
  PRODUCT  packages/shared/src/utils/xliff.ts:238                 [03-28] #379
```

Plus 2 × `js/stack-trace-exposure` (medium):
`apps/web/src/app/api/v1/ai/_shared/ai-route.ts:40` and
`apps/web/src/lib/pdf.ts:89`.

---

## 3. The SAML three — I checked, and they are less urgent than they look

I flagged these to the owner as the ones I would not ship without a decision.
Then I traced them, and the picture improved. **Do not start here, and do not
repeat the trace — this is the result.**

`extractSAMLAttributes` (`response-validator.ts:664`) parses the assertion with
regexes at lines 674, 682 and 688. The question that decides the severity is
whether that runs _before_ or _after_ signature verification.

**After.** There is exactly one production call site:

```
apps/web/src/app/api/v1/auth/sso/saml/callback/route.ts:147
  const attrs = extractSAMLAttributes(verified.assertionXml, attrMapping);
```

`verified` comes from `verifySamlResponse()`, which does real XML-DSig
validation through `xml-crypto` (`sig.checkSignature(responseXml) !== true` →
reject, line 463), and the callback additionally consumes the assertion ID
against replay (line 130) _before_ reaching line 147. `rejectXXE()` runs inside
`extractSAMLAttributes` as well. The function's own doc comment says it:
"only ever call this with the assertion XML returned by `verifySamlResponse()`".

So the input is a **signature-verified assertion from the tenant's configured
IdP**, not raw attacker XML. Exploiting the ReDoS requires a malicious or
compromised IdP attacking its own tenant. That is real, and worth fixing — it
is not the unauthenticated remote DoS the severity label suggests.

Same correction for `oidc/discovery.ts:16`: the input is
`discoveryUrl.replace(/\/+$/, "")`, and the discovery URL is **operator
configuration**, not request data.

I am telling you this so you do not spend the session on the four alerts that
look scariest and are not the most productive place to start.

---

## 4. How to triage — three piles, counts before fixes

Sort all 37 (plus the 2 medium) and report the counts **before** changing code.
The axis that matters is **where the input comes from**, not the severity label:

1. **Attacker-reachable input** — data from an HTTP request, an uploaded file,
   or a third-party feed, reaching the pattern before authentication or before
   a signature check. These get fixed first, and each gets its own commit.
   Candidates worth checking properly:
   - `apps/web/src/app/api/v1/tags/route.ts:16` — a request parameter?
   - `apps/web/src/lib/documents/extract-text.ts:54` — uploaded document text.
   - `apps/worker/src/crons/threat-feed-sync.ts:43` — a remote threat feed.
   - `packages/shared/src/lib/file-storage.ts:179`, `freetsa.ts:760`.
   - The two `stack-trace-exposure`: does a 500 response body carry a stack to
     the client? If yes, that is a straightforward information leak and
     probably the cheapest real win in this list.
2. **Trusted or configured input** — signature-verified, operator-set, or
   build-time. The SAML three, the OIDC one, the `packages/ai/src/prompts/*`
   patterns (prompt templates), `xliff.ts`. Fix on merit, not urgency.
3. **Scripts and tests** — all 12 script findings and all 6 test findings. A
   `file-system-race` in `coverage-gate.mjs` runs on our own CI runner against
   our own files. Record the reasoning once for the group; do not write twelve
   separate justifications.

**Do not dismiss an alert in the GitHub UI to make the check green.** If a
finding is genuinely not applicable, the reason belongs in the register where
it can be read later. A dismissed alert looks identical to a fixed one.

---

## 5. What the owner decided

- **Deploy to test now.** The build is exercised (201 Playwright tests, k6 at
  0.00 % failed requests, p95 143 ms against a 2000 ms budget). OP-257 does not
  block a **test** deployment; it blocks production until pile 1 is assessed.
- **One caveat to raise if it applies:** if the test instance will be
  internet-reachable _and_ SAML login is enabled on it, pile-1 exposure exists
  there too. Internal-only, and it does not.
- The Pilot Readiness Gate stays red and stays out of the required list until
  `STAGING_URL` exists. Branch protection comes after the merge, never before.
- **OP-224** (per-recipient notification language) is deferred until the new
  test deployment. Do not open that front.

---

## 6. Division of labour, unchanged

- Application code, packages, tests, anything needing a real build or the
  Windows/WSL machines — **yours**.
- `.github/workflows/**`, `.github/actions/**`, `scripts/**` — **mine**. The 12
  script findings in pile 3 are therefore mine; send me the triage verdict, not
  a patch.
- `docs/OFFENE-PUNKTE-REGISTER.md` and `-INDEX.md` — **mine**, so numbering
  stays collision-free. Send entries without a number.

Two things happened on my side since your last handover, both worth knowing:

- **OP-258** — the `Generated API docs are reproducible` check could not pass on
  any day after the file was committed: the generator writes the wall-clock date
  into `docs/API_REFERENCE.md`, and the step regenerated then ran `git diff`.
  The whole diff was `2026-09-09` → `2026-09-10`. It now uses
  `generate-api-reference.mjs --check`, which strips that line — and runs
  _before_ the regeneration, otherwise it would compare the freshly written file
  with itself. Mirror image of OP-092: there a gate that could not fail, here
  one that could not pass.
- **OP-255** — `Build` was listed in ADR-016 as a required check, but it carries
  `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` and never
  runs on a PR. Required, it would have deadlocked the merge we are working
  toward. The list is corrected.
