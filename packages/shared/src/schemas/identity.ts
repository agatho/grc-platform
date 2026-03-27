import { z } from "zod";

// Sprint 20: SSO + SCIM Zod validation schemas

const ssoProviderTypeValues = ["saml", "oidc"] as const;

const validRoles = [
  "admin",
  "risk_manager",
  "control_owner",
  "auditor",
  "dpo",
  "process_owner",
  "viewer",
] as const;

// ─── SAML Attribute Mapping ─────────────────────────────────

export const samlAttributeMappingSchema = z.object({
  email: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  groups: z.string().min(1),
});

// ─── OIDC Claim Mapping ─────────────────────────────────────

export const oidcClaimMappingSchema = z.object({
  email: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  groups: z.string().min(1),
});

// ─── Group-to-Role Mapping ──────────────────────────────────

export const groupRoleMappingSchema = z.record(
  z.string().min(1),
  z.enum(validRoles),
);

// ─── SSO Config Create/Update ───────────────────────────────

export const createSsoConfigSchema = z.object({
  provider: z.enum(ssoProviderTypeValues),
  displayName: z.string().max(200).optional(),
  // SAML
  samlMetadataUrl: z.string().url().max(2000).optional(),
  samlEntityId: z.string().max(500).optional(),
  samlSsoUrl: z.string().url().max(2000).optional(),
  samlCertificate: z.string().optional(),
  samlAttributeMapping: samlAttributeMappingSchema.optional(),
  // OIDC
  oidcDiscoveryUrl: z.string().url().max(2000).optional(),
  oidcClientId: z.string().max(500).optional(),
  oidcClientSecret: z.string().optional(),
  oidcScopes: z.string().max(500).optional(),
  oidcClaimMapping: oidcClaimMappingSchema.optional(),
  // General
  isActive: z.boolean().optional(),
  enforceSSO: z.boolean().optional(),
  defaultRole: z.enum(validRoles).optional(),
  groupRoleMapping: groupRoleMappingSchema.optional(),
  autoProvision: z.boolean().optional(),
});

export const updateSsoConfigSchema = createSsoConfigSchema.partial();

// ─── SAML Metadata Parse (URL input) ────────────────────────

export const parseSamlMetadataSchema = z.object({
  metadataUrl: z.string().url().max(2000),
});

// ─── OIDC Discovery Input ───────────────────────────────────

export const discoverOidcSchema = z.object({
  discoveryUrl: z.string().url().max(2000),
});

// ─── SSO Test Login ─────────────────────────────────────────

export const testSsoLoginSchema = z.object({
  provider: z.enum(ssoProviderTypeValues),
});

// ─── SCIM Token Create ──────────────────────────────────────

export const createScimTokenSchema = z.object({
  description: z.string().max(200).optional(),
});

// ─── SCIM Sync Log Filter ───────────────────────────────────

export const scimSyncLogFilterSchema = z.object({
  action: z.enum(["create", "update", "deactivate", "reactivate", "group_assign", "group_remove"]).optional(),
  status: z.enum(["success", "error", "skipped"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── SCIM Protocol Schemas (RFC 7644) ───────────────────────

const scimSchemaUri = "urn:ietf:params:scim:schemas:core:2.0:User" as const;
const scimGroupSchemaUri = "urn:ietf:params:scim:schemas:core:2.0:Group" as const;
const scimPatchSchemaUri = "urn:ietf:params:scim:api:messages:2.0:PatchOp" as const;

export const scimCreateUserSchema = z.object({
  schemas: z.array(z.string()).min(1),
  externalId: z.string().max(200).optional(),
  userName: z.string().email().max(255),
  name: z.object({
    givenName: z.string().max(255),
    familyName: z.string().max(255),
  }),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.string().optional(),
    primary: z.boolean().optional(),
  })).optional(),
  active: z.boolean().optional().default(true),
  groups: z.array(z.object({
    value: z.string(),
    display: z.string().optional(),
  })).optional(),
});

export const scimPatchOpSchema = z.object({
  schemas: z.array(z.string()).min(1),
  Operations: z.array(z.object({
    op: z.enum(["add", "remove", "replace"]),
    path: z.string().optional(),
    value: z.unknown().optional(),
  })).min(1).max(100),
});

export const scimReplaceUserSchema = z.object({
  schemas: z.array(z.string()).min(1),
  externalId: z.string().max(200).optional(),
  userName: z.string().email().max(255),
  name: z.object({
    givenName: z.string().max(255),
    familyName: z.string().max(255),
  }),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.string().optional(),
    primary: z.boolean().optional(),
  })).optional(),
  active: z.boolean().optional().default(true),
});

export const scimCreateGroupSchema = z.object({
  schemas: z.array(z.string()).min(1),
  displayName: z.string().max(255),
  members: z.array(z.object({
    value: z.string().uuid(),
    display: z.string().optional(),
  })).optional(),
});

// ─── SSO Enforcement Toggle ─────────────────────────────────

export const toggleSsoEnforcementSchema = z.object({
  enforceSSO: z.boolean(),
});

// ─── Break-Glass Admin Login ────────────────────────────────

export const breakGlassLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
