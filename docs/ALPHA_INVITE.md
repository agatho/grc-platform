# ARCTOS Alpha — Tester Onboarding

_Status: 0.1.0-alpha · Updated: 2026-05-21 (post-Wave-24 closure)_

Hi 👋 — and thanks for trying ARCTOS. This guide gets you from
"invite link arrived" to "I can poke around all the modules" in
about 10 minutes. It's deliberately short: this is an **alpha**,
not a polished demo, so we'd rather you spend your time clicking
through the product than reading docs.

If you hit something broken or confusing, that's exactly what we
want to hear — see [§Reporting issues](#reporting-issues) at the
bottom.

---

## What ARCTOS is, in one paragraph

ARCTOS is a self-hosted GRC (governance / risk / compliance) +
BPM platform for multi-entity corporations. Risk management,
ISMS, internal controls, BCM, data protection, audit, third-party
risk, ESG, and process modelling, all in one tool, with per-tenant
isolation, full audit trail, and 46 regulatory frameworks
catalogued (ISO 27001/27002, NIS2, DORA, EU AI Act, GDPR, BSI
Grundschutz, …).

The alpha runs on `https://arctos.charliehund.de`. Everything you
see is real code, real RBAC, real RLS — there is no demo "mode".

---

## Logging in

You log into a **demo tenant** called **Meridian Holdings GmbH**.
Twelve role-distinct accounts are pre-seeded so you can experience
the platform from any line-of-defence perspective.

**URL:** `https://arctos.charliehund.de/login`
**Password (all accounts):** `WaveQA-2026!`

| Email                          | Role                       | LoD | Best for trying                            |
| ------------------------------ | -------------------------- | --- | ------------------------------------------ |
| `ciso@meridian.test`           | CISO                       | 2nd | ISMS overview, hash-chain integrity, ERM   |
| `dpo@meridian.test`            | Data Protection Officer    | 2nd | DPMS, RoPA, DSR, DPIA, breach handling     |
| `compliance@meridian.test`     | Compliance Officer         | 2nd | Framework coverage, controls, audit prep   |
| `auditor@meridian.test`        | Internal Auditor           | 3rd | Audit universe, plans, working papers      |
| `process-owner@meridian.test`  | Process Owner              | 1st | BPMN editor, process controls, RACM        |
| `vendor-mgr@meridian.test`     | Vendor / Contract Mgr      | 1st | TPRM, vendor lifecycle, concentration risk |
| `esg@meridian.test`            | ESG Manager                | 2nd | ESRS materiality, datapoints, emissions    |
| `whistleblowing@meridian.test` | Whistleblowing Officer     | —   | Case management (legally isolated module)  |
| `viewer@meridian.test`         | Viewer                     | —   | Read-only across modules                   |
| `bcm@meridian.test`            | BCM Manager **(new)**      | 2nd | BIA, BCP, crisis scenarios, exercises      |
| `security@meridian.test`       | Security Analyst **(new)** | 1st | Incidents, vulnerabilities, NIST 7-state   |
| `ext-auditor@meridian.test`    | External Auditor **(new)** | 3rd | Read-only audit universe                   |

**(new)** = added in Wave 24 (this invite cycle). The other nine
have existed since Wave 12.

There's also a **cross-tenant test tenant** called Arctistx with three
accounts (`ciso@arctistx.test`, `process-owner@arctistx.test`,
`vendor-mgr@arctistx.test`, same password). It's useful for verifying
that Meridian users can't see Arctistx data and vice-versa — the
multi-entity RLS guarantee in action. Log in as `ciso@arctistx.test`
and try to query for any Meridian entity ID; you'll get a 404.

> If you log in as a 1st-line role (process_owner, control_owner)
> and feel locked out of something, that's intentional — the Three
> Lines of Defence model is enforced down to the API layer. Switch
> to the relevant 2nd-line role to see oversight features.

You can also create your **own** subscriber tenant from the
landing page if you want a clean slate, but Meridian is far more
populated and we recommend starting there.

---

## What to try (the 15-minute tour)

These flows are well-fleshed-out and should mostly work:

1. **Log in as `ciso@meridian.test`** → land on Dashboard → click
   through the **sidebar groups** (10 management-system buckets).
   The CISO sees most modules. You'll get a feel for the scope.
2. **ISMS → IS-Risiken** — Risk scenarios per ISO 27005, with
   inherent vs residual scoring and asset/threat/vulnerability
   composition.
3. **Controls & Audit → Controls** — 100+ controls across the
   Meridian org with framework links (ISO 27001 Annex A, NIS2,
   DORA, GDPR Art. 32). Click any to see its assertions, tests,
   and evidence.
4. **Controls & Audit → Findings** — open a finding, transition
   its status, attach a remediation plan. Findings are shared
   across ICS, Audit, and BCMS modules — same entity, three views.
5. **Note**: control testing happens under `compliance@meridian.test`
   (compliance officer role) — there's no dedicated `control-owner@`
   login yet. From the compliance role you can create control tests,
   record results, and raise findings.
6. **Switch to `dpo@meridian.test`** → **Data Protection → RoPA**
   → look at the processing activities. Then **DPIA** for the
   high-risk ones. Then **DSR** for inbound data-subject requests.
7. **Switch to `bcm@meridian.test`** → **Business Continuity →
   BIA** → see the impact assessments. Then **BCP** → see the
   continuity plans linked to the BIAs.
8. **Switch to `vendor-mgr@meridian.test`** → **Third Parties →
   Vendors** → open a vendor → notice the new
   `risk-profile` aggregator (returns inherent/residual, DORA
   critical flag, LkSG tier, contract spend) and the
   `/tprm/concentration` HHI tile.
9. **Switch to `auditor@meridian.test`** → **Controls & Audit →
   Audit Universe / Plans / Audits** → walk through a planned
   audit's lifecycle, log activities, generate a sample finding.

If you want to stress-test the RBAC: every role should see exactly
what their job title allows — no more, no less. If you see a 403
that feels wrong, please tell us (often it's a deliberate Three
Lines split, but sometimes we tighten too far).

---

## Known limitations & gotchas (alpha)

We're tracking these openly; please ignore the rough edges or
report new ones.

### Working, but with caveats

- **Email delivery** — Notifications and DPIA/DSR/audit-related
  emails compile and queue, but the production tenant's outbound
  SMTP is sandboxed. You won't actually receive emails. The
  in-app **Notifications** bell at the top-right shows everything
  that would have been sent.
- **AI features** — Risk suggestion, control test plan generation,
  audit-finding suggestion etc. are wired to Claude/Ollama. They
  work, but cost money per call, so we've turned them off in the
  default alpha config. To trial AI features, ping us.
- **Compliance Coverage tile** — Now reads three data sources in
  order (snapshot → live mapping → catalog-link heuristic). On
  Meridian you'll see realistic numbers immediately. On a fresh
  tenant you'll see the heuristic until you run a gap analysis.

### Not yet finished

- **Finding cross-module FK persistence** — There's a known issue
  where `controlId` / `auditId` / `riskId` posted to `POST /findings`
  occasionally persist as `null`. We're root-causing it via a
  diagnostic endpoint deployed but currently disabled
  (`ARCTOS_DEBUG_TRACE_ENABLED`). Report if you can reproduce it
  via the UI and we'll prioritise.
- **Some report PDFs** — Risk Quarterly Summary, BCM Annual
  Review, ESG ESRS Disclosure render via Puppeteer; performance
  on long reports (50+ pages) is variable.
- **Marketplace + GRC Academy** — sidebar items exist, base
  content is light. Browse, but don't expect 1.0 polish.

### Hard limits

- Bulk operations are capped at 100 rows per request (server-side
  Zod). Bigger imports go through the import wizards.
- Frontend translations are DE + EN only. Mixed-locale view falls
  back to DE.
- Browser support: Chrome / Edge / Safari latest. Firefox should
  work; we mostly test on Chromium.

---

## Reporting issues

The lowest-friction path is best:

1. **Slack / email** — drop a one-line description of what you
   did and what went wrong. Include the **Request ID** if you see
   a red error toast (it's in the toast and in the bottom of any
   error response).
2. **Screen recording / screenshot** — if a layout is weird,
   pictures save a lot of back-and-forth.
3. **The five "must-fix" questions** we want answered:
   1. Did the demo data feel realistic for your industry?
   2. Was any role's view confusing (too crowded, too sparse,
      missing something obvious)?
   3. Which workflow took more clicks than you expected?
   4. Did any RBAC denial feel wrong (you should've been able to
      see/do something but got 403)?
   5. What's the **one feature** that, if it existed, would make
      this tool replace something you currently use?

Don't bother polishing the report. A one-liner saying "ESG
emissions tile shows zero but my expectation was X" is more useful
than a structured bug report we receive a week later.

---

## What's next for the platform

Roadmap is loose, but in priority order:

1. **A1 fix** — settling the finding-FK regression so the cross-
   module audit trail is bulletproof.
2. **Email delivery** — moving from sandboxed SMTP to a real
   Resend/Postmark setup before we open up beyond this invite
   cycle.
3. **AI cost guardrails** — per-org daily budget + UI surface for
   admins to enable/disable AI features themselves.
4. **Mobile** — Sprint-60 mobile shell exists but is incomplete.
5. **Beta** — once those four land, we open up self-serve
   onboarding for organisations that aren't on the invite list.

Thanks again for being here. The reason this thing is opinionated
enough to be useful is feedback from people like you in this exact
phase.

— The ARCTOS team
