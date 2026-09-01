"use client";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-13] Dialog semantics and focus
 * management for the overlays that are built by hand instead of with Radix.
 *
 * Nine files render a `fixed inset-0` overlay. Four of them use Radix
 * (`Dialog`/`Sheet`/`AlertDialog`) and get a focus trap, `role="dialog"`,
 * `aria-modal`, Escape handling and focus restoration for free. The other five
 * built the overlay themselves and got none of it:
 *
 *     apps/web/src/app/(dashboard)/risks/kris/page.tsx:175
 *     apps/web/src/app/(dashboard)/catalogs/objects/page.tsx
 *     apps/web/src/app/(dashboard)/settings/catalogs/page.tsx
 *     apps/web/src/components/layout/mobile-sidebar.tsx:86
 *     apps/web/src/components/layout/modern-sidebar.tsx
 *
 * Concretely, in each of those: no `role="dialog"`, no `aria-modal="true"`, no
 * `aria-labelledby`, no Escape key, no focus return to the element that opened
 * the panel, and the content behind the overlay stayed in the tab order — so a
 * keyboard user tabbing "inside" the dialog silently walked out of it into the
 * page underneath (WCAG 2.4.3 Focus Order). The backdrop itself was a plain
 * `onClick` div: a mouse could dismiss the dialog, a keyboard could not.
 *
 * Rather than migrate five bespoke layouts to Radix — which would rewrite
 * their markup and their animations — this module supplies exactly the
 * behaviour Radix would have provided, as a hook plus a backdrop component.
 *
 * `useModalDialog` deliberately does NOT render anything: the five call sites
 * have very different shells (right drawer, left drawer, centred card), and a
 * component that owned the markup would have forced all three into one shape.
 */

import * as React from "react";

/** Elements that can hold focus, in DOM order, excluding disabled/hidden ones. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("inert") &&
      el.getAttribute("aria-hidden") !== "true" &&
      // offsetParent is null for display:none; a fixed-position element has
      // none either, hence the second test.
      (el.offsetParent !== null || getComputedStyle(el).position === "fixed"),
  );
}

export interface UseModalDialogResult {
  /** Spread on the dialog panel: `role`, `aria-modal`, `aria-labelledby`, ref. */
  dialogProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    role: "dialog";
    "aria-modal": true;
    "aria-labelledby"?: string;
    "aria-label"?: string;
    tabIndex: -1;
  };
  /** Use as the `id` of the dialog's heading element. */
  titleId: string;
}

/**
 * Gives a hand-built overlay the behaviour of a modal dialog.
 *
 * @param open    whether the dialog is currently rendered
 * @param onClose called on Escape (and by the caller for the backdrop)
 * @param label   accessible name to use when the dialog has no visible heading
 */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  label?: string,
): UseModalDialogResult {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = `${React.useId()}-dialog-title`;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    // 1. Remember where focus came from so it can be given back on close —
    //    without this the user is dropped at the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 2. Move focus into the dialog. Prefer the first focusable control; fall
    //    back to the panel itself (tabIndex={-1}) so a dialog with no controls
    //    is still announced.
    const first = focusableWithin(panel)[0];
    (first ?? panel).focus({ preventScroll: true });

    // 3. Escape closes, and Tab/Shift+Tab cycle inside the panel. The wrap has
    //    to be implemented explicitly: the browser's own Tab order walks
    //    straight out of a `position: fixed` overlay into the page behind it.
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (ev.key !== "Tab") return;
      const items = focusableWithin(panel);
      if (items.length === 0) {
        ev.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (!ev.shiftKey && active === lastItem) {
        ev.preventDefault();
        firstItem.focus();
      } else if (ev.shiftKey && (active === firstItem || active === panel)) {
        ev.preventDefault();
        lastItem.focus();
      } else if (active instanceof Node && !panel.contains(active)) {
        // Focus escaped (browser chrome, programmatic focus) — pull it back.
        ev.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    // 4. Hide the rest of the page from assistive technology, which is what
    //    `aria-modal` alone does NOT reliably do in every screen reader.
    const siblings: Array<{ el: Element; prev: string | null }> = [];
    for (const el of Array.from(document.body.children)) {
      if (el.contains(panel)) continue;
      siblings.push({ el, prev: el.getAttribute("aria-hidden") });
      el.setAttribute("aria-hidden", "true");
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      for (const { el, prev } of siblings) {
        if (prev === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", prev);
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return {
    dialogProps: {
      ref: panelRef,
      role: "dialog",
      "aria-modal": true,
      ...(label ? { "aria-label": label } : { "aria-labelledby": titleId }),
      tabIndex: -1,
    },
    titleId,
  };
}

export interface ModalBackdropProps {
  onClose: () => void;
  className?: string;
  /** Accessible name of the close affordance, e.g. t("common.close"). */
  closeLabel: string;
}

/**
 * The dimmed backdrop.
 *
 * It was a bare `<div className="fixed inset-0 bg-black/50" onClick={onClose}/>`
 * — an interactive element with no role, no name and no keyboard path, which
 * is what `jsx-a11y/click-events-have-key-events` and
 * `no-static-element-interactions` were reporting. Rendered as a real
 * `<button>` it is dismissible by mouse, by Enter/Space and (through the hook
 * above) by Escape, and it announces what it does.
 */
export function ModalBackdrop({
  onClose,
  className,
  closeLabel,
}: ModalBackdropProps) {
  return (
    <button
      type="button"
      aria-label={closeLabel}
      onClick={onClose}
      className={className ?? "fixed inset-0 z-40 cursor-default bg-black/50"}
    />
  );
}
