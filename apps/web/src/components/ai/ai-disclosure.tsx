"use client";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S05-12, handed over by WP6]
 *
 * Renders the AI Act Art. 50 transparency notice that every AI route now
 * returns as `data.aiDisclosure`.
 *
 * WP6 fixed the API side: `aiCompleteGoverned()` attaches a complete
 * disclosure — provider, model, whether processing stayed local or went to a
 * third country, which country, which controller, the egress mode, and a
 * ready-made German notice — to EVERY AI response. Before that, three React
 * components displayed a hardcoded `common.aiDisclaimer` string that named
 * neither the recipient of the data nor the fact that data left the
 * installation at all, and the other 20 AI features displayed nothing.
 *
 * The remaining half of the finding is this component: the disclosure has to
 * be rendered, or the notice stays at 3 of 23 features in the *user interface*
 * even though it is present in every response.
 *
 * Two design points that matter for the legal function rather than the visual:
 *
 *  - **The text comes from the server, not from the catalogue.** `notice` is
 *    composed from the org's actual policy and the provider actually used, so
 *    it cannot drift away from what happened. A translated UI string would be
 *    a second, independent claim about the same fact — which is how the
 *    hardcoded disclaimer came to be wrong.
 *  - **A third-country transfer is visually distinct.** "Processed locally"
 *    and "sent to a provider in the US" are different statements under Art. 50
 *    and under GDPR Chapter V, and a single grey line of small print does not
 *    convey the difference.
 */

import { useTranslations } from "next-intl";
import { Sparkles, Globe, ShieldCheck } from "lucide-react";

import { cn } from "@grc/ui";

/**
 * Mirrors `AiDisclosure` in `packages/ai/src/governed.ts`. Declared locally
 * rather than imported because `@grc/ai` is a server-side package: importing
 * its types would pull the provider clients into the client bundle.
 */
export interface AiDisclosureData {
  feature: string;
  aiGenerated: true;
  provider: string;
  model: string;
  processing: "local" | "third_country";
  processingCountry: string;
  processingController: string;
  thirdCountryTransfer: boolean;
  egressMode: string;
  policySource: string;
  /** Server-composed notice text. Authoritative. */
  notice: string;
  humanReviewRequired: boolean;
}

export function AiDisclosureNotice({
  disclosure,
  className,
}: {
  disclosure: AiDisclosureData | null | undefined;
  className?: string;
}) {
  const t = useTranslations("common");
  // No disclosure means the response did not come from a governed AI path.
  // Rendering a generic "this may be AI-generated" line here would be a claim
  // about something we did not observe — the S14-02 pattern.
  if (!disclosure) return null;

  const thirdCountry = disclosure.thirdCountryTransfer;

  return (
    <div
      // `role="note"` rather than `role="alert"`: the notice is part of the
      // result, not an interruption. It is inside the dialog's content, so a
      // screen reader reaches it while reading the result.
      role="note"
      aria-label={t("ai.disclosureLabel")}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        thirdCountry
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-600",
        className,
      )}
    >
      {thirdCountry ? (
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <div className="space-y-1">
        {/* The server-composed sentence. Authoritative — see the header. */}
        <p>{disclosure.notice}</p>
        <p className="text-[11px] opacity-80">
          {t("ai.providerLine", {
            provider: disclosure.provider,
            model: disclosure.model,
            country: disclosure.processingCountry,
          })}
        </p>
        {disclosure.humanReviewRequired && (
          <p className="flex items-center gap-1 text-[11px] font-medium">
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
            {t("ai.humanReviewRequired")}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Narrows an arbitrary API payload to a disclosure, so a call site can do
 * `setDisclosure(readAiDisclosure(json.data))` without asserting a type it has
 * not checked.
 */
export function readAiDisclosure(payload: unknown): AiDisclosureData | null {
  if (!payload || typeof payload !== "object") return null;
  const d = (payload as { aiDisclosure?: unknown }).aiDisclosure;
  if (!d || typeof d !== "object") return null;
  const candidate = d as Partial<AiDisclosureData>;
  if (
    typeof candidate.notice !== "string" ||
    typeof candidate.provider !== "string"
  )
    return null;
  return candidate as AiDisclosureData;
}
