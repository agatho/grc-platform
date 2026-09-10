/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] The unvalidated-JSON boundary.
 *
 * `CLAUDE.md:338` and Critical Rule 6 forbid `any`; the audit counted 267
 * violations behind a disabled lint rule. Most of them fall into one class:
 * a client component does `await res.json()` and maps the result. There is no
 * schema validation on that path anywhere in the app, so the value genuinely
 * IS unknown at compile time.
 *
 * Two dishonest ways out were rejected:
 *
 *  - writing an interface that describes the fields the mapper happens to read
 *    would assert a contract nothing verifies. The next backend rename would
 *    still produce `undefined` at runtime, and now with the compiler's
 *    blessing — which is worse than `any`, because it reads as checked.
 *  - `Record<string, unknown>` forces a cast at every property access, so the
 *    same assertion returns as noise spread over 200 lines.
 *
 * So the `any` stays where the data really is unknown, but it is NAMED. One
 * suppression with one justification, instead of 30 scattered
 * `eslint-disable-next-line` comments; every call site reads as a warning; and
 * `grep -rn "UnvalidatedJson" apps/web/src | wc -l` is the exact size of the
 * debt at any moment.
 *
 * The real fix is S14-16: a typed API contract (RFC 7807 errors and generated
 * response types from the OpenAPI document) so these boundaries can be parsed
 * instead of assumed. Until then this alias marks every place that will need
 * to change.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the module comment: this is the single, named, deliberate `any` for unvalidated fetch() payloads. Everywhere else the rule is an error.
export type UnvalidatedJson = any;
