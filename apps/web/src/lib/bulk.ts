// Bulk-operations helper — Critical Implementation Rule #11.
//
// #WAVE21-B4: Wave-21 QA found that bulk-create endpoints didn't
// exist for risks/controls/findings/treatments — only the academy
// `bulkEnrollSchema` and the ESG `bulkMeasurementImportSchema` had
// `.max(100)` Zod validation, and even those weren't exposed via a
// `/{entity}/bulk` route. This helper standardises the contract:
//
//   - Request body: `{ items: [...] }` where `.length` <= 100
//   - 422 when over the cap, with `{maxBulkSize:100, providedSize:N}`
//   - 207 Multi-Status when mixed success (some items 422, some 201)
//   - 201 + `{created:[...], errors:[]}` on full success
//   - Each successful item produces its own audit-log entry (the
//     route's per-item `withAuditContext` does this — the helper
//     just walks the array and short-circuits on cap violations).

import { z } from "zod";

export const BULK_MAX_ITEMS = 100;

export interface BulkResult<T> {
  status: 201 | 207 | 422;
  body: {
    created?: T[];
    errors?: Array<{ index: number; error: string; details?: unknown }>;
    maxBulkSize?: number;
    providedSize?: number;
  };
}

export interface BulkRequest {
  items: unknown[];
}

export const bulkRequestSchema = z.object({
  items: z.array(z.unknown()).min(1),
});

/**
 * Validates that the bulk request is within the cap. Returns null
 * when OK, or a 422 BulkResult when the cap is exceeded.
 */
export function checkBulkCap(items: unknown[]): BulkResult<never> | null {
  if (items.length > BULK_MAX_ITEMS) {
    return {
      status: 422,
      body: {
        maxBulkSize: BULK_MAX_ITEMS,
        providedSize: items.length,
        errors: [
          {
            index: -1,
            error: `Bulk operation exceeds maximum size of ${BULK_MAX_ITEMS} items (got ${items.length}). Split your request into multiple bulk calls.`,
          },
        ],
      },
    };
  }
  return null;
}

/**
 * Walks the items array, validates each against the per-item schema,
 * and calls `executor` for each valid item. Returns a structured
 * BulkResult — 201 for all-success, 207 Multi-Status for mixed.
 */
export async function bulkExecute<TItem, TCreated>(
  items: unknown[],
  itemSchema: z.ZodType<TItem>,
  executor: (item: TItem, index: number) => Promise<TCreated>,
): Promise<BulkResult<TCreated>> {
  const cap = checkBulkCap(items);
  if (cap) return cap as unknown as BulkResult<TCreated>;

  const created: TCreated[] = [];
  const errors: Array<{ index: number; error: string; details?: unknown }> = [];

  for (let i = 0; i < items.length; i++) {
    const parsed = itemSchema.safeParse(items[i]);
    if (!parsed.success) {
      errors.push({
        index: i,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
      continue;
    }
    try {
      const result = await executor(parsed.data, i);
      created.push(result);
    } catch (err) {
      errors.push({
        index: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (errors.length === 0) {
    return { status: 201, body: { created, errors: [] } };
  }
  // Multi-Status — some succeeded, some failed.
  return { status: 207, body: { created, errors } };
}
