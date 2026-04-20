// Sprint 20: SCIM User Mapper
// Maps between SCIM 2.0 schema and ARCTOS user model

import type { ScimUser } from "@grc/shared";

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";

export interface ArctosUserData {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  externalId?: string;
  isActive: boolean;
}

/**
 * Map a SCIM User resource to ARCTOS user data.
 */
export function scimToArctosUser(scimUser: ScimUser): ArctosUserData {
  const email =
    scimUser.userName ??
    scimUser.emails?.find((e) => e.primary)?.value ??
    scimUser.emails?.[0]?.value;

  if (!email) {
    throw new Error("SCIM user has no email address");
  }

  return {
    email: email.toLowerCase(),
    name: `${scimUser.name.givenName} ${scimUser.name.familyName}`.trim(),
    firstName: scimUser.name.givenName,
    lastName: scimUser.name.familyName,
    externalId: scimUser.externalId,
    isActive: scimUser.active !== false,
  };
}

/**
 * Map an ARCTOS user record to a SCIM User resource.
 */
export function arctosToScimUser(
  user: {
    id: string;
    email: string;
    name: string;
    externalId?: string | null;
    isActive: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
  },
  baseUrl: string,
): ScimUser {
  // Split name into given/family
  const nameParts = (user.name ?? "").split(" ");
  const givenName = nameParts[0] ?? "";
  const familyName = nameParts.slice(1).join(" ") || givenName;

  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    externalId: user.externalId ?? undefined,
    userName: user.email,
    name: {
      givenName,
      familyName,
    },
    emails: [
      {
        value: user.email,
        type: "work",
        primary: true,
      },
    ],
    active: user.isActive,
    meta: {
      resourceType: "User",
      created:
        typeof user.createdAt === "string"
          ? user.createdAt
          : user.createdAt.toISOString(),
      lastModified:
        typeof user.updatedAt === "string"
          ? user.updatedAt
          : user.updatedAt.toISOString(),
      location: `${baseUrl}/scim/v2/Users/${user.id}`,
    },
  };
}

/**
 * Build a SCIM list response.
 */
export function buildScimListResponse(
  resources: ScimUser[],
  totalResults: number,
  startIndex: number,
  count: number,
): {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUser[];
} {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults,
    startIndex,
    itemsPerPage: count,
    Resources: resources,
  };
}

/**
 * Build a SCIM error response (RFC 7644 compliant).
 */
export function buildScimError(
  detail: string,
  status: number,
): {
  schemas: string[];
  detail: string;
  status: string;
} {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail,
    status: String(status),
  };
}
