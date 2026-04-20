// Sprint 20: SSO + SCIM Identity types

export type SsoProviderType = "saml" | "oidc";
export type IdentityProvider = "local" | "saml" | "oidc" | "scim";
export type ScimSyncAction =
  | "create"
  | "update"
  | "deactivate"
  | "reactivate"
  | "group_assign"
  | "group_remove";
export type ScimSyncStatus = "success" | "error" | "skipped";

// ─── SSO Configuration ──────────────────────────────────────

export interface SamlAttributeMapping {
  email: string;
  firstName: string;
  lastName: string;
  groups: string;
}

export interface OidcClaimMapping {
  email: string;
  firstName: string;
  lastName: string;
  groups: string;
}

export interface GroupRoleMapping {
  [idpGroup: string]: string; // IdP group name -> ARCTOS role
}

export interface SsoConfig {
  id: string;
  orgId: string;
  provider: SsoProviderType;
  displayName: string | null;
  // SAML
  samlMetadataUrl: string | null;
  samlEntityId: string | null;
  samlSsoUrl: string | null;
  samlCertificate: string | null;
  samlAttributeMapping: SamlAttributeMapping | null;
  // OIDC
  oidcDiscoveryUrl: string | null;
  oidcClientId: string | null;
  oidcClientSecret: string | null;
  oidcScopes: string | null;
  oidcClaimMapping: OidcClaimMapping | null;
  // General
  isActive: boolean;
  enforceSSO: boolean;
  defaultRole: string;
  groupRoleMapping: GroupRoleMapping;
  autoProvision: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── SCIM Token ─────────────────────────────────────────────

export interface ScimToken {
  id: string;
  orgId: string;
  description: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** Returned only on creation — token is shown once then never again */
export interface ScimTokenCreated {
  id: string;
  token: string;
  description: string | null;
  createdAt: string;
}

// ─── SCIM Sync Log ──────────────────────────────────────────

export interface ScimSyncLogEntry {
  id: string;
  orgId: string;
  action: ScimSyncAction;
  status: ScimSyncStatus;
  scimResourceId: string | null;
  userId: string | null;
  userEmail: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ─── SCIM Protocol Types (RFC 7644) ────────────────────────

export interface ScimUser {
  schemas: string[];
  id?: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{
    value: string;
    type: string;
    primary: boolean;
  }>;
  active: boolean;
  groups?: Array<{
    value: string;
    display: string;
  }>;
  meta?: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface ScimPatchOp {
  schemas: string[];
  Operations: Array<{
    op: "add" | "remove" | "replace";
    path?: string;
    value?: unknown;
  }>;
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUser[];
}

export interface ScimError {
  schemas: string[];
  detail: string;
  status: string;
}

// ─── SAML Parsed Metadata ───────────────────────────────────

export interface SamlMetadataResult {
  entityId: string;
  ssoUrl: string;
  certificate: string;
}

export interface SamlAttributes {
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
}

// ─── OIDC Discovery ─────────────────────────────────────────

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

export interface OidcTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface PkceChallenge {
  verifier: string;
  challenge: string;
}

// ─── Role Resolution ────────────────────────────────────────

export interface GroupRoleMappingEntry {
  idpGroup: string;
  role: string;
}

// ─── SSO Dashboard Stats ────────────────────────────────────

export interface ScimDashboardStats {
  lastSync: string | null;
  syncedUsers: number;
  errorCount: number;
  activeTokens: number;
}
