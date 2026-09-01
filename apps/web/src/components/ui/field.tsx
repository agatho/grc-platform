"use client";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-09] Accessible-name plumbing for form
 * controls — EN 301 549 §9.1.3.1 / §9.3.3.2 / §9.4.1.2, WCAG 4.1.2.
 *
 * The audit found 578 of 663 input/textarea elements, 305 of 315 selects and
 * 639 of 753 labels with no association between them. The defect was not 578
 * independent mistakes: the base primitives (`Input`, `Textarea`,
 * `SelectTrigger`, `Label`) never carried a name, so every call site had to
 * remember to build one by hand and almost none did.
 *
 * This module closes the hole at the root in two layers:
 *
 *  1. `<Field>` — the structural fix. It mints one stable id via `useId()` and
 *     hands it to both the `<Label>` (as `htmlFor`) and the control (as `id`)
 *     through context. Nothing at the call site has to be kept in sync, so the
 *     association cannot drift. `<FieldDescription>` and `<FieldError>` wire
 *     themselves into `aria-describedby` the same way, and `FieldError` marks
 *     the control `aria-invalid`.
 *
 *  2. `useAccessibleNameFallback` — the safety net for the ~600 existing call
 *     sites that do not (yet) use `<Field>`. It runs AFTER mount and inspects
 *     the real DOM: only when `element.labels` is empty AND no
 *     `aria-label`/`aria-labelledby`/`title` is present does it derive a name
 *     from the placeholder (then `name`, then the control type). Because the
 *     check is against the live accessibility tree rather than against props,
 *     it can never overwrite a name the author already provided — including
 *     the 36 places that use the wrapping-`<label>` pattern, which no
 *     prop-level heuristic could detect.
 *
 * A placeholder-derived name is a fallback, not the target state: it satisfies
 * 4.1.2 (the control is announced) but not 3.3.2 (the name vanishes once the
 * user types). New code uses `<Field>`; `jsx-a11y` in `eslint.config.mjs`
 * keeps raw elements from regressing.
 */

import * as React from "react";

import { cn } from "@grc/ui";

export interface FieldContextValue {
  /** id of the control — `<Label htmlFor>` and the control's `id` share it. */
  controlId: string;
  /**
   * id of the `<Label>`. Needed for controls that `htmlFor` cannot name:
   * a Radix `SelectTrigger` renders a `<button role="combobox">`, and HTML
   * `<label for>` only names *labelable* elements. Those point at the label
   * with `aria-labelledby` instead.
   */
  labelId: string;
  /** id of the description element, if a `<FieldDescription>` is mounted. */
  descriptionId?: string;
  /** id of the error element, if a `<FieldError>` is mounted. */
  errorId?: string;
  /** true while a `<FieldError>` is mounted — drives `aria-invalid`. */
  invalid: boolean;
  registerDescription: (present: boolean) => void;
  registerError: (present: boolean) => void;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

/**
 * Props a form control should spread to inherit its `<Field>` wiring.
 * Returns an empty object outside a `<Field>` so primitives stay usable
 * standalone.
 */
export function useFieldControlProps(explicitId?: string): {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
} {
  const ctx = useFieldContext();
  if (!ctx) return explicitId ? { id: explicitId } : {};
  const describedBy = [ctx.descriptionId, ctx.errorId]
    .filter(Boolean)
    .join(" ");
  return {
    id: explicitId ?? ctx.controlId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(ctx.invalid ? { "aria-invalid": true as const } : {}),
  };
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Override the generated control id (e.g. to match an external form lib). */
  id?: string;
}

/**
 * Groups a label, a control and its description/error, and guarantees the
 * label→control association without the call site restating an id.
 *
 * ```tsx
 * <Field>
 *   <Label>{t("riskTitle")}</Label>
 *   <Input value={title} onChange={…} />
 *   <FieldDescription>{t("riskTitleHint")}</FieldDescription>
 * </Field>
 * ```
 */
const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, id, children, ...props }, ref) => {
    const generated = React.useId();
    const controlId = id ?? `field-${generated}`;
    const [hasDescription, setHasDescription] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);

    const value = React.useMemo<FieldContextValue>(
      () => ({
        controlId,
        labelId: `${controlId}-label`,
        descriptionId: hasDescription ? `${controlId}-description` : undefined,
        errorId: hasError ? `${controlId}-error` : undefined,
        invalid: hasError,
        registerDescription: setHasDescription,
        registerError: setHasError,
      }),
      [controlId, hasDescription, hasError],
    );

    return (
      <FieldContext.Provider value={value}>
        <div ref={ref} className={cn("space-y-1.5", className)} {...props}>
          {children}
        </div>
      </FieldContext.Provider>
    );
  },
);
Field.displayName = "Field";

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const ctx = useFieldContext();
  const register = ctx?.registerDescription;
  React.useEffect(() => {
    register?.(true);
    return () => register?.(false);
  }, [register]);
  return (
    <p
      ref={ref}
      id={ctx ? `${ctx.controlId}-description` : undefined}
      className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
      {...props}
    />
  );
});
FieldDescription.displayName = "FieldDescription";

const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const ctx = useFieldContext();
  const register = ctx?.registerError;
  React.useEffect(() => {
    register?.(true);
    return () => register?.(false);
  }, [register]);
  return (
    <p
      ref={ref}
      id={ctx ? `${ctx.controlId}-error` : undefined}
      // `role="alert"` so a validation message that appears after submit is
      // announced without moving focus (WCAG 3.3.1).
      role="alert"
      className={cn("text-sm text-red-600 dark:text-red-400", className)}
      {...props}
    />
  );
});
FieldError.displayName = "FieldError";

/**
 * Props a non-labelable control (Radix `SelectTrigger`, a custom combobox
 * button) should spread: `htmlFor` cannot reach it, so it references the
 * label with `aria-labelledby` instead.
 */
export function useFieldTriggerProps(explicitId?: string): {
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
} {
  const ctx = useFieldContext();
  if (!ctx) return explicitId ? { id: explicitId } : {};
  const describedBy = [ctx.descriptionId, ctx.errorId]
    .filter(Boolean)
    .join(" ");
  return {
    id: explicitId ?? ctx.controlId,
    "aria-labelledby": ctx.labelId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(ctx.invalid ? { "aria-invalid": true as const } : {}),
  };
}

/** Elements that expose a `labels` NodeList in the DOM. */
type LabelableElement =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    // Only counts if at least one referenced element actually exists and has
    // text — a dangling reference produces no name (axe: aria-valid-attr-value).
    const named = labelledBy
      .split(/\s+/)
      .some((refId) =>
        el.ownerDocument.getElementById(refId)?.textContent?.trim(),
      );
    if (named) return true;
  }
  if (el.getAttribute("title")?.trim()) return true;
  const labels = (el as LabelableElement).labels;
  if (labels && labels.length > 0) {
    return Array.from(labels).some((l) => l.textContent?.trim());
  }
  return false;
}

/**
 * Applies a fallback `aria-label` to a control that ends up in the DOM with no
 * accessible name at all. Runs on every render so a name that only becomes
 * available later (a label rendered conditionally, a translated string that
 * resolves after hydration) is still honoured, and removes the fallback again
 * once a real name appears.
 *
 * Returns the ref callback to attach to the control.
 */
export function useAccessibleNameFallback<T extends HTMLElement>(
  forwardedRef: React.Ref<T> | undefined,
  fallback: () => string | undefined,
): React.RefCallback<T> {
  const elementRef = React.useRef<T | null>(null);
  const fallbackRef = React.useRef(fallback);
  fallbackRef.current = fallback;

  const apply = React.useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    const applied = el.dataset.arctosNameFallback === "1";
    // Ignore our own previous fallback when deciding whether a real name exists.
    if (applied) el.removeAttribute("aria-label");
    if (hasAccessibleName(el)) {
      delete el.dataset.arctosNameFallback;
      return;
    }
    const name = fallbackRef.current()?.trim();
    if (!name) {
      delete el.dataset.arctosNameFallback;
      return;
    }
    el.setAttribute("aria-label", name);
    el.dataset.arctosNameFallback = "1";
  }, []);

  React.useEffect(apply);

  return React.useCallback(
    (node: T | null) => {
      elementRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef)
        (forwardedRef as React.RefObject<T | null>).current = node;
      if (node) apply();
    },
    [forwardedRef, apply],
  );
}

/** Derives a human-usable fallback name from the props a control already has. */
export function deriveFallbackName(props: {
  placeholder?: string;
  name?: string;
  type?: string;
  "aria-label"?: string;
}): string | undefined {
  if (props["aria-label"]?.trim()) return props["aria-label"];
  if (props.placeholder?.trim()) return props.placeholder;
  if (props.name?.trim()) {
    // `contactEmail` / `contact_email` / `contact-email` → "contact email"
    return props.name
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim();
  }
  return undefined;
}

export { Field, FieldDescription, FieldError };
