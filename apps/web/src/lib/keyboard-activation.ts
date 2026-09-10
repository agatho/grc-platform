/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-09 / S14-13] Keyboard equivalent for
 * elements that are clickable but are not buttons.
 *
 * 20 list rows, heat-map cells and drop zones carried `onClick` on a plain
 * `<div>`: operable with a mouse, invisible and unreachable with a keyboard
 * (EN 301 549 §9.2.1.1 / WCAG 2.1.1, level A). `jsx-a11y`'s
 * `click-events-have-key-events` and `no-static-element-interactions` had no
 * lint instance to report it (S14-19 / G4).
 *
 * A real `<button>` is the better element wherever the layout allows it — see
 * `ModalBackdrop` in components/ui/modal-shell.tsx, which was converted rather
 * than annotated. For a table row or a grid cell, replacing the element would
 * break the surrounding `<table>`/grid semantics, so the ARIA pattern is the
 * correct choice there: `role="button"` + `tabIndex={0}` + this handler.
 */
import type { KeyboardEvent } from "react";

/**
 * Invokes `action` on Enter or Space, matching native button behaviour.
 *
 * Space is intercepted with `preventDefault()` because on a non-button element
 * it would otherwise scroll the page.
 */
export function activateOnKey(
  event: KeyboardEvent<Element>,
  action: () => void,
): void {
  if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar")
    return;
  // A keystroke that belongs to a control INSIDE the row (a nested button, a
  // text field) must not also trigger the row itself.
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  action();
}
