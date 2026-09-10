import {
  ssoConfig,
  user,
  userOrganizationRole,
  withOrgReadContext,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  decodeSamlResponse,
  verifySamlResponse,
  validateSAMLAssertion,
  extractSAMLAttributes,
} from "@grc/auth/saml";
import { consumeSamlAssertionId } from "@grc/auth/anonymous-token";
import { resolveRole, groupRoleMappingToEntries } from "@grc/auth";
import { logAccessEvent } from "@grc/auth/providers";
import type { SamlAttributeMapping, GroupRoleMapping } from "@grc/shared";
import { getBaseUrl } from "@/lib/base-url";
import { isEnumValue } from "../../../../_lib/enum-filter";
import { log } from "@/lib/logger";
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/auth/sso/saml/callback — SAML ACS (Assertion Consumer Service)
export const POST = withErrorHandler(async function POST(req: Request) {
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] `req.formData()` stand hier
  // ungeschuetzt. Ein POST mit einem anderen Content-Type — und das ist der
  // Normalfall, wenn ein Bereitsteller falsch konfiguriert ist oder jemand die
  // ACS-URL von Hand ausprobiert — wirft in undici
  //
  //     TypeError: Content-Type was not one of "multipart/form-data" or
  //                "application/x-www-form-urlencoded".
  //
  // Ungewickelt war das ein 500er mit leerem Rumpf; `all-routes-auth-smoke`
  // hat den Wurf mit `allowThrow: true` durchgelassen, statt ihn als Befund zu
  // fuehren. Der SAML-ACS-Endpunkt beschreibt seinen Eingang selbst (SAML HTTP
  // POST Binding, §3.5 der SAML-2.0-Bindings): ein falsch kodierter Rumpf ist
  // eine Aussage ueber die ANFRAGE, also 400.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      {
        error:
          "Expected an application/x-www-form-urlencoded or multipart/form-data body (SAML HTTP POST Binding).",
      },
      { status: 400 },
    );
  }
  const samlResponse = formData.get("SAMLResponse") as string;
  const relayStateB64 = formData.get("RelayState") as string;

  if (!samlResponse) {
    return Response.json({ error: "Missing SAMLResponse" }, { status: 400 });
  }

  // Parse relay state
  let orgId: string;
  let callbackUrl = "/dashboard";
  try {
    const relayState = JSON.parse(
      Buffer.from(relayStateB64 ?? "", "base64").toString("utf-8"),
    );
    orgId = relayState.orgId;
    callbackUrl = relayState.callbackUrl ?? "/dashboard";
  } catch {
    return Response.json({ error: "Invalid RelayState" }, { status: 400 });
  }

  // #WP3-S02-05 — `sso_config` has FORCE RLS. This handler is anonymous by
  // design (the IdP POSTs without a session), so no request-scoped org context
  // exists and a plain read under `grc_app` returned 0 rows: SSO looked
  // "not configured" on every production instance. The org is known from the
  // RelayState, so pin it on a dedicated connection for exactly this read.
  const [config] = await withOrgReadContext(orgId, (sdb) =>
    sdb
      .select()
      .from(ssoConfig)
      .where(
        and(
          eq(ssoConfig.orgId, orgId),
          eq(ssoConfig.provider, "saml"),
          eq(ssoConfig.isActive, true),
          isNull(ssoConfig.deletedAt),
        ),
      ),
  );

  if (!config?.samlCertificate) {
    return Response.json(
      { error: "SAML configuration not found or incomplete" },
      { status: 404 },
    );
  }

  const baseUrl = getBaseUrl();

  try {
    // Decode the SAML response
    const responseXml = decodeSamlResponse(samlResponse);

    // #WP3-S02-23 — Signaturprüfung MIT Reference-Digest und Bindung.
    //
    // Vorher: `validateSAMLSignature(responseXml, cert)` verifizierte nur
    // `SignatureValue` über den per Regex gefundenen `SignedInfo`-Block und gab
    // einen booleschen Wert zurück; anschließend wurden die Attribute aus
    // DEMSELBEN, ungebundenen `responseXml` gezogen. Wer EINE gültige,
    // IdP-signierte Response besaß, konnte NameID und Gruppen frei ersetzen und
    // sich als beliebiger Nutzer der Organisation anmelden (XSW).
    //
    // Jetzt: `verifySamlResponse` prüft Reference-Digest UND Signatur gegen das
    // KONFIGURIERTE IdP-Zertifikat (das in `<KeyInfo>` mitgelieferte wird
    // ignoriert), lehnt SHA-1 ab, verlangt genau eine Assertion und gibt die
    // kanonisierte, nachweislich signierte Assertion zurück. Alles Weitere
    // arbeitet ausschließlich auf `verified.assertionXml`.
    const verified = verifySamlResponse(responseXml, config.samlCertificate);

    // Validate assertion (expiry, audience, replay) — on the SIGNED bytes.
    const spEntityId = `${baseUrl}/auth/sso/saml`;
    validateSAMLAssertion(verified.assertionXml, spEntityId);

    // #WP3-S02-23 — durable replay protection. The in-process Map above only
    // protects a single web instance ("In production, this should be backed by
    // Redis" — the code said so itself). This consumes the assertion ID in the
    // database, so a replay against a second pod is rejected too.
    const assertionIdMatch = verified.assertionXml.match(/\bID="([^"]+)"/);
    if (!assertionIdMatch) {
      throw new Error("Signed assertion carries no ID");
    }
    const fresh = await consumeSamlAssertionId(
      assertionIdMatch[1],
      orgId,
      new Date(Date.now() + 10 * 60_000),
    );
    if (!fresh) {
      throw new Error("Replay attack detected: assertion ID already consumed");
    }

    // Extract user attributes — from the signed assertion, never the raw XML.
    const attrMapping =
      (config.samlAttributeMapping as SamlAttributeMapping) ?? {
        email: "email",
        firstName: "givenName",
        lastName: "sn",
        groups: "memberOf",
      };
    const attrs = extractSAMLAttributes(verified.assertionXml, attrMapping);

    // #WP3-S02-05 — the JIT-provisioning block touches `user` and
    // `user_organization_role`, both FORCE-RLS. Without an org context under
    // `grc_app` the existence check returned 0 rows (so every SSO login tried
    // to CREATE the user and hit the unique constraint) and the role insert
    // was rejected by the policy. The org is known from the state/RelayState,
    // so the whole block runs on a connection pinned to it.
    const provisioned = await withOrgReadContext(orgId, async (sdb) => {
      // JIT Provisioning: create or update user
      const email = attrs.email.toLowerCase();
      const name =
        [attrs.firstName, attrs.lastName].filter(Boolean).join(" ") || email;

      const [existing] = await sdb
        .select()
        .from(user)
        .where(and(eq(user.email, email), isNull(user.deletedAt)));

      let userId: string;

      if (existing) {
        // Update existing user
        await sdb.execute(sql`
          UPDATE "user" SET
            name = ${name},
            last_login_at = now(),
            identity_provider = 'saml',
            last_synced_at = now(),
            is_active = true
          WHERE id = ${existing.id}
        `);
        userId = existing.id;
      } else {
        // Create new user via JIT
        if (!config.autoProvision) {
          return Response.json(
            { error: "Auto-provisioning is disabled for this organization" },
            { status: 403 },
          );
        }

        const [created] = await sdb
          .insert(user)
          .values({
            email,
            name,
            emailVerified: new Date(),
            isActive: true,
            language: "de",
            identityProvider: "saml",
            lastLoginAt: new Date(),
            lastSyncedAt: new Date(),
          })
          .returning();
        userId = created.id;

        // Assign default role
        const groupMapping =
          (config.groupRoleMapping as GroupRoleMapping) ?? {};
        const mappingEntries = groupRoleMappingToEntries(groupMapping);
        const role = resolveRole(
          attrs.groups ?? [],
          mappingEntries,
          config.defaultRole ?? "viewer",
        );

        // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] `resolveRole` gibt
        // `string` zurueck — die Zuordnung Gruppe→Rolle stammt aus der
        // IdP-Konfiguration der Organisation und ist damit frei getippter
        // Text. Mit `as any` ging ein Tippfehler in dieser Konfiguration
        // ungeprueft in eine Aufzaehlungsspalte: die Datenbank wies ihn ab
        // (`invalid input value for enum user_role`), und der SSO-Login
        // scheiterte mit einem 500er statt mit einer Rolle. Unbekannte
        // Werte fallen jetzt auf `viewer` zurueck — den Wert, den die
        // Konfiguration ohnehin als Vorgabe fuehrt — und werden protokolliert.
        const safeRole = isEnumValue(userOrganizationRole.role.enumValues, role)
          ? role
          : "viewer";
        if (safeRole !== role) {
          log.warn(
            "[saml/callback] unknown role in group mapping, falling back",
            {
              role,
              orgId,
            },
          );
        }

        await sdb.insert(userOrganizationRole).values({
          userId,
          orgId,
          role: safeRole,
        });
      }
      return { userId, email };
    });
    if (provisioned instanceof Response) return provisioned;
    const { userId, email } = provisioned;

    // Log successful SSO login
    await logAccessEvent({
      userId,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_oidc",
    });

    // Redirect to the app — the session will be created by Auth.js signIn
    // For SAML callback, we redirect to a special handler that creates the session
    const sessionUrl = new URL(`${baseUrl}/api/v1/auth/sso/session`);
    sessionUrl.searchParams.set("userId", userId);
    sessionUrl.searchParams.set("callbackUrl", callbackUrl);

    // Redirect to login with auto-sign-in token
    const redirectUrl = new URL(`${baseUrl}${callbackUrl}`);
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    // #SEC-LEAK-FIX: was returning err.message to the unauthenticated
    // caller. That message leaked SAML-library specifics (which step
    // of validation failed: signature, audience, expiry, replay) —
    // useful intel for an attacker probing the IDP integration. Now
    // the structured failureReason is logged server-side for audit;
    // the response carries only a stable opaque message.
    const message =
      err instanceof Error ? err.message : "SAML authentication failed";
    await logAccessEvent({
      emailAttempted: "unknown",
      eventType: "login_failed",
      authMethod: "sso_oidc",
      failureReason: message,
    });
    return Response.json(
      { error: "SAML authentication failed" },
      { status: 401 },
    );
  }
});
