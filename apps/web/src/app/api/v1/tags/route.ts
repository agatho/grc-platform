/**
 * GET  /api/v1/tags — List tag definitions for the current org
 * POST /api/v1/tags — Create a new tag definition
 */
import { withAuth } from "@/lib/api";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-wrapper";

/**
 * Strip HTML/script tags from user input.
 *
 * Replaces `.replace(/<[^>]*>/g, "")`, which was flagged by CodeQL as
 * js/incomplete-multi-character-sanitization. Two things came out of checking
 * that alert, and only the second one was real:
 *
 *  - The "one pass can reconstruct a tag out of the remains" case the rule is
 *    named for cannot happen here. With the `g` flag the scan only fails at a
 *    `<` when no `>` follows it anywhere, so a surviving `<` provably has no
 *    `>` behind it either: one pass is already a fixpoint. Verified by
 *    exhaustive search over `{<,>,!,-,/,a}` up to length 8 — no input differs
 *    between one pass and two.
 *  - The regex backtracks, and that IS a defect: `[^>]*` walks to the end of
 *    the string at every `<`, so `"<".repeat(n)` costs O(n²) — 200k took 18.5s
 *    on the reference machine. Harmless here (`.max(max)` runs BEFORE this
 *    transform), but the same helper shape is used on uncapped input in
 *    lib/documents/extract-text.ts and the worker's threat-feed-sync, where it
 *    was a denial of service on attacker-supplied bytes.
 *
 * So: a single linear scan, no regex and no repeat loop. `indexOf` never
 * revisits a character, making this O(n), and the pass loop that used to guard
 * the quadratic case is gone with it — it could never have run twice.
 *
 * Semantics kept identical to `/<[^>]*>/g`: the content may be EMPTY, so `<>`
 * is a match and is removed. (The `[^>]+` call sites spell the opposite rule.)
 */
function stripTags(value: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const lt = value.indexOf("<", i);
    if (lt === -1) break;
    const gt = value.indexOf(">", lt + 1);
    // No `>` left anywhere: this `<` cannot match, and neither can any later
    // one — the regex would give up here too.
    if (gt === -1) break;
    out += value.slice(i, lt);
    i = gt + 1;
  }
  return out + value.slice(i);
}

const safeString = (max: number) => z.string().max(max).transform(stripTags);

const createTagSchema = z.object({
  name: safeString(200).pipe(z.string().min(1)),
  color: z
    .string()
    .max(20)
    .regex(/^#[0-9a-fA-F]{3,8}$/)
    .default("#6B7280"),
  category: safeString(100).optional(),
  description: safeString(1000).optional(),
});

async function GET__ctx(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  let query = sql`SELECT id, name, color, category, description, usage_count, created_at FROM tag_definition WHERE org_id = ${ctx.orgId}`;
  if (category) query = sql`${query} AND category = ${category}`;
  if (search) query = sql`${query} AND name ILIKE ${"%" + search + "%"}`;
  query = sql`${query} ORDER BY usage_count DESC, name ASC LIMIT ${limit}`;

  const result = await db.execute(query);

  const catResult = await db.execute(
    sql`SELECT DISTINCT category FROM tag_definition WHERE org_id = ${ctx.orgId} AND category IS NOT NULL ORDER BY category`,
  );

  return Response.json({
    data: result,
    categories: (catResult as unknown as Record<string, string>[]).map(
      (r) => r.category,
    ),
  });
}

async function POST__ctx(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "auditor",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const parsed = createTagSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { name, color, category, description } = parsed.data;

  const result = await db.execute(sql`
    INSERT INTO tag_definition (org_id, name, color, category, description, created_by)
    VALUES (${ctx.orgId}, ${name.trim()}, ${color}, ${category ?? null}, ${description ?? null}, ${ctx.userId})
    ON CONFLICT (org_id, name) DO UPDATE SET
      color = EXCLUDED.color,
      category = COALESCE(EXCLUDED.category, tag_definition.category),
      description = COALESCE(EXCLUDED.description, tag_definition.description)
    RETURNING id, name, color, category, description, usage_count
  `);

  return Response.json(
    { data: (result as unknown as Record<string, unknown>[])[0] },
    { status: 201 },
  );
}

// #SEC-F01b-RUN: wrap handlers so the request-scoped RLS context frame
// (opened by withErrorHandler, mutated by withAuth) is present around the bare
// db.* reads above — otherwise they run context-less under grc_app and RLS
// filters/faults. Also converts prior empty-body 500s to structured problem+json.
export const GET = withErrorHandler(GET__ctx);
export const POST = withErrorHandler(POST__ctx);
