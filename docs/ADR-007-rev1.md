## ADR-007: Authentication & Authorization (Revision 1)

| **ADR-ID** | **007** |
| --- | --- |
| **Title** | **Auth.js (Self-Hosted) + Custom RBAC with Three Lines of Defense Model** |
| **Status** | **Accepted (Rev. 1 — replaces Clerk decision)** |
| **Date** | 2026-03-23 |
| **Revision** | Rev. 1 (Original: 2026-03-22 — Clerk + Custom RBAC) |
| **Context** | G-04: SSO, MFA, Session Management. Data sovereignty: No dependency on US cloud services for auth in a GRC platform. |

### Reason for Change (Rev. 1)

The original decision to use Clerk (hosted US auth service) contradicts the core principles of a GRC and security platform:

1. **Data Sovereignty:** Auth data (login events, sessions, MFA tokens) leaves the organization's own jurisdiction.
2. **Compliance Contradiction:** A platform enforcing ISO 27001, NIS2, and GDPR must not depend on a third-party cloud service for core functionality.
3. **Availability:** Clerk outage = complete platform outage. Unacceptable risk for a GRC platform.
4. **Auditability:** Auth logs must reside entirely within the organization's own infrastructure.

### Decision

**Auth.js (v5)** as self-hosted authentication framework, integrated directly into Next.js. Sessions and accounts stored in the platform's own PostgreSQL database (Drizzle adapter). Custom RBAC middleware in `packages/auth`, encapsulated behind a provider interface for future migration to Keycloak/Authentik.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  packages/auth                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AuthProvider Interface                          │   │
│  │  ├── getCurrentUser(req): User                   │   │
│  │  ├── validateSession(token): Session             │   │
│  │  ├── handleLogin(credentials): LoginResult       │   │
│  │  ├── handleLogout(session): void                 │   │
│  │  └── handleSSOCallback(provider, code): User     │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Auth.js     │  │  Keycloak    │  │  Authentik   │  │
│  │  Adapter     │  │  Adapter     │  │  Adapter     │  │
│  │  (active)    │  │  (future)    │  │  (future)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  RBAC Middleware                                 │   │
│  │  ├── requireRole('admin', 'risk_manager')        │   │
│  │  ├── requireLineOfDefense(2)                     │   │
│  │  └── setOrgContext(org_id) → RLS                 │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Auth.js Configuration

| Feature | Implementation |
| --- | --- |
| **Session Strategy** | Database sessions (JWT optional for API clients) |
| **Session Storage** | PostgreSQL via Drizzle adapter (`session`, `account`, `verification_token` tables) |
| **Credentials Login** | Email + password (bcrypt/argon2), with rate limiting |
| **SSO / Azure AD** | OIDC provider in Auth.js (`AzureADProvider`) |
| **MFA (TOTP)** | Custom implementation with `otpauth` library, secret in `user` table (encrypted) |
| **MFA (WebAuthn)** | `@simplewebauthn/server` for FIDO2/Passkey support |
| **User Sync** | Not needed — users are stored directly in own DB |
| **Invitations** | Custom: invitation table + signed link + email via Resend/Nodemailer |

### RBAC (unchanged from Rev. 0)

The role model remains identical to the original ADR:

**Predefined Roles:** `admin`, `risk_manager`, `control_owner`, `auditor`, `dpo`, `process_owner`, `viewer`

**Three Lines of Defense Model:**
- 1st Line: `process_owner`, `control_owner` — operational management
- 2nd Line: `risk_manager`, `dpo` — oversight functions
- 3rd Line: `auditor` — independent assurance

**Middleware:** `requireRole()` checks against `user_organization_role` table, org-specific. Roles are cached per session with invalidation on change.

### Evaluated Alternatives

| **Option** | **Advantages** | **Disadvantages** | **Choice** |
| --- | --- | --- | --- |
| **Auth.js (Self-Hosted)** | Runs in Next.js process, no external service, DB sessions in own PostgreSQL, OIDC/OAuth for SSO, MIT license, large community | MFA must be custom-built, no admin dashboard out-of-the-box | **✅** |
| **Keycloak (Self-Hosted)** | Enterprise IAM, SAML+OIDC, admin UI, MFA built-in, identity brokering | Java stack, requires own container, overhead for Phase 1, higher ops complexity | Future |
| **Authentik (Self-Hosted)** | More modern than Keycloak, Python, easier to set up | Fewer enterprise references, smaller community | Future |
| ~~**Clerk (Cloud)**~~ | ~~Fastest integration, SSO/MFA/webhooks out-of-the-box~~ | ~~US cloud dependency, contradicts data sovereignty, vendor lock-in, availability risk~~ | ~~Rev. 0~~ |
| **Auth0 (Cloud)** | Enterprise features, Universal Login | US cloud (Okta), expensive, same sovereignty issues as Clerk | — |
| **Supabase Auth (Self-Hosted)** | GoTrue server, can be self-hosted | Separate infrastructure, GoLang dependency, tightly coupled to Supabase ecosystem | — |

### Migration Path to Keycloak/Authentik

Estimated effort: **~3 days**, assuming the provider interface is cleanly implemented.

| Task | Effort |
| --- | --- |
| Set up Keycloak/Authentik container | 0.5 days |
| Implement new adapter in `packages/auth` | 0.5 days |
| User migration (DB script or password reset flow) | 0.5 days |
| Adapt login/logout pages (redirect instead of own forms) | 0.5 days |
| Transfer SSO configuration | 0.5 days |
| Testing | 0.5 days |

**Migration Trigger:** When SAML federation, identity brokering across multiple IdPs, or fine-grained token policies are needed (expected from Sprint 5+).

### Consequences

1. `packages/auth` contains the `AuthProvider` interface and the Auth.js adapter as default implementation.
2. Auth.js Drizzle adapter creates additional tables: `session`, `account`, `verification_token` in the `grc_platform` DB.
3. MFA (TOTP + WebAuthn) is custom-implemented — increases Sprint 1 effort by ~3 SP compared to Clerk.
4. Invitation system is custom-built instead of using Clerk invitations.
5. No external service required — everything runs in own infrastructure.
6. Auth events (login, logout, mfa_challenge etc.) write directly to `access_log` — no webhook detour.
7. Session-based auth for web UI, optional JWT tokens for API clients (integrations).

### Dependencies

- ADR-005 (PostgreSQL): Sessions and accounts in own DB
- ADR-006 (Drizzle): Auth.js Drizzle adapter for schema migration
- ADR-011 (Audit Trail): Auth events → access_log (direct DB insert instead of webhook)
- ADR-001 (RLS): `setOrgContext()` in RBAC middleware sets `app.current_org_id` per request
