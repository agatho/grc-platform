// BPM Overhaul Phase 4: ROPA profile validation + auto-DPIA logic test.

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-derive the schema shape from the route so we don't import the route
// directly (it pulls auth + db). The shape must stay in sync with
// apps/web/src/app/api/v1/processes/[id]/ropa-profile/route.ts.

const ropaProfileSchema = z.object({
  isProcessingActivity: z.boolean(),
  processingPurpose: z.string().optional().nullable(),
  legalBasis: z
    .enum([
      "consent",
      "contract",
      "legal_obligation",
      "vital_interest",
      "public_interest",
      "legitimate_interest",
    ])
    .optional()
    .nullable(),
  legalBasisDetail: z.string().optional().nullable(),
  dataSubjectCategories: z.array(z.string()).optional(),
  personalDataCategories: z.array(z.string()).optional(),
  specialCategories: z.array(z.string()).optional(),
  recipients: z.array(z.string()).optional(),
  thirdCountryTransfers: z.boolean().optional(),
  thirdCountrySafeguards: z.string().optional().nullable(),
  retentionPeriodDescription: z.string().optional().nullable(),
  retentionPeriodMonths: z.number().int().nullable().optional(),
  tomDescription: z.string().optional().nullable(),
  requiresDpia: z.boolean().optional(),
  dpiaTriggerReason: z.string().optional().nullable(),
  dpiaId: z.string().uuid().optional().nullable(),
  ropaEntryId: z.string().uuid().optional().nullable(),
  controllerOrgId: z.string().uuid().optional().nullable(),
  jointControllerOrgIds: z.array(z.string().uuid()).optional(),
  processorVendorIds: z.array(z.string().uuid()).optional(),
});

function autoDpiaFlag(input: z.infer<typeof ropaProfileSchema>): boolean {
  const highRisk =
    (input.specialCategories?.length ?? 0) > 0 ||
    input.thirdCountryTransfers === true;
  return input.requiresDpia ?? highRisk;
}

describe("ropa profile validation", () => {
  it("rejects missing isProcessingActivity", () => {
    const r = ropaProfileSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("accepts a minimal valid profile", () => {
    const r = ropaProfileSchema.safeParse({ isProcessingActivity: false });
    expect(r.success).toBe(true);
  });

  it("rejects invalid legal basis enum", () => {
    const r = ropaProfileSchema.safeParse({
      isProcessingActivity: true,
      legalBasis: "marketing_consent",
    });
    expect(r.success).toBe(false);
  });

  it("accepts the six Art. 6 legal bases", () => {
    for (const basis of [
      "consent",
      "contract",
      "legal_obligation",
      "vital_interest",
      "public_interest",
      "legitimate_interest",
    ]) {
      const r = ropaProfileSchema.safeParse({
        isProcessingActivity: true,
        legalBasis: basis,
      });
      expect(r.success, `legalBasis ${basis}`).toBe(true);
    }
  });

  it("rejects malformed dpiaId UUID", () => {
    const r = ropaProfileSchema.safeParse({
      isProcessingActivity: true,
      dpiaId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});

describe("auto-DPIA trigger logic", () => {
  it("flags when special categories present", () => {
    expect(
      autoDpiaFlag({
        isProcessingActivity: true,
        specialCategories: ["health", "genetic"],
      }),
    ).toBe(true);
  });

  it("flags when third-country transfers enabled", () => {
    expect(
      autoDpiaFlag({ isProcessingActivity: true, thirdCountryTransfers: true }),
    ).toBe(true);
  });

  it("does not flag for a standard processing activity", () => {
    expect(
      autoDpiaFlag({
        isProcessingActivity: true,
        legalBasis: "contract",
        personalDataCategories: ["name", "email"],
      }),
    ).toBe(false);
  });

  it("respects explicit requiresDpia=true override", () => {
    expect(
      autoDpiaFlag({
        isProcessingActivity: true,
        requiresDpia: true,
      }),
    ).toBe(true);
  });

  it("respects explicit requiresDpia=false override even for high-risk", () => {
    expect(
      autoDpiaFlag({
        isProcessingActivity: true,
        specialCategories: ["health"],
        requiresDpia: false,
      }),
    ).toBe(false);
  });
});
