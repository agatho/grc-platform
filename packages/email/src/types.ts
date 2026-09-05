// [ARCTOS-FULL-2026-08-31 / WP9 · S10-03]
//
// `EmailTemplateKey` used to be a hand-maintained union of 27 literals while
// the platform wrote 70 distinct keys into `notification.template_key` — the
// intersection was 2. The union is now DERIVED from `template-registry.ts`,
// which is the single source of truth for both the key set and the renderer
// selection, so the two can no longer drift apart: adding a key to the
// registry is the only way to make it valid, and `renderTemplate` is
// exhaustive over the same type.
export type {
  EmailTemplateKey,
  DedicatedTemplateKey,
  GenericTemplateKey,
  EmailSeverity,
} from "./template-registry";

import type { EmailTemplateKey } from "./template-registry";

export interface EmailParams {
  to: string;
  templateKey: EmailTemplateKey;
  data: Record<string, unknown>;
  lang: "de" | "en";
}

export interface EmailResult {
  messageId: string;
}

/**
 * Raised when the provider did not accept the message.
 *
 * [S10-04, part A] The Resend SDK never throws: `Client.fetchRequest`
 * catches everything and returns `{ data: null, error }` for HTTP errors
 * AND for network failures. The old `try/catch` around it was therefore
 * dead code — the three retries never ran, `throw lastError` was
 * unreachable, and a 429 / unverified domain / wrong API key was reported
 * to the caller as a successful send with an empty message id.
 * `EmailService` now inspects the returned value and raises this.
 */
export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly providerErrorName?: string,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
