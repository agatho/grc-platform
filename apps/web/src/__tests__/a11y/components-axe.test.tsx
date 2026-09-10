// @vitest-environment jsdom
//
// [ARCTOS-FULL-2026-08-31 / WP12 · S14-09, S14-10, S14-12, S14-13]
//
// The automated accessibility gate the repository did not have.
//
// The audit ran axe-core 4.12.1 from a scratch project OUTSIDE the repo,
// because inside it there was nothing to run it with: `all-components-smoke`
// rendered nothing (S14-12, G3), there was no `eslint-plugin-jsx-a11y`
// configuration (S14-19/G4) and no axe pass anywhere in CI. It found 12
// violations in 11 components — 9 of them critical or serious.
//
// This suite is the in-repo replacement. It renders the design-system
// primitives and every component the audit named, and fails on any axe
// violation of impact `critical` or `serious`. That threshold is the
// acceptance criterion for WP12; `moderate`/`minor` findings are printed but
// do not fail, so the gate cannot be quietly weakened by lowering it.
//
// `color-contrast` is disabled here for the reason the audit gives: jsdom does
// not compute layout or resolve CSS custom properties, so axe cannot evaluate
// it. Contrast is covered instead by `theme-contrast.test.ts`, which computes
// the ratios from the design tokens directly.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as React from "react";
import axe from "axe-core";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    t.raw = (key: string) => key;
    return t;
  },
  useLocale: () => "de",
}));

// jsdom implements neither ResizeObserver nor PointerEvent capture, both of
// which Radix uses for measurement. Stubbing them is an environment gap, not a
// relaxation of the audit: nothing about the accessibility tree depends on
// them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;
if (!Element.prototype.hasPointerCapture)
  Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture)
  Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture)
  Element.prototype.releasePointerCapture = () => {};

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ProgrammeProgressBar } from "@/components/programme/programme-progress-bar";

const IMPACT_FAIL = new Set(["critical", "serious"]);

/**
 * Runs axe over a mounted container and returns only the violations that must
 * fail the build. The full list is logged so a moderate/minor regression is
 * still visible in CI output.
 */
async function auditContainer(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // jsdom computes no colours — see the file header. Covered by
      // theme-contrast.test.ts instead.
      "color-contrast": { enabled: false },
      // A test fragment is not a document: these are page-level rules that
      // cannot pass for an isolated component and would be pure noise.
      region: { enabled: false },
      "page-has-heading-one": { enabled: false },
      "landmark-one-main": { enabled: false },
      bypass: { enabled: false },
      "html-has-lang": { enabled: false },
      "document-title": { enabled: false },
    },
  });
  const blocking = results.violations.filter((v) =>
    IMPACT_FAIL.has(v.impact ?? ""),
  );
  const advisory = results.violations.filter(
    (v) => !IMPACT_FAIL.has(v.impact ?? ""),
  );
  if (advisory.length) {
    console.warn(
      "[a11y] non-blocking findings:",
      advisory.map((v) => `${v.id} (${v.impact})`).join(", "),
    );
  }
  return blocking.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.html).slice(0, 3),
  }));
}

afterEach(cleanup);

describe("axe: design-system form primitives (S14-09)", () => {
  it("an Input inside a <Field> is named by its <Label>, with no id restated at the call site", async () => {
    const { container } = render(
      <Field>
        <Label>Risikotitel</Label>
        <Input value="" onChange={() => {}} />
        <FieldDescription>Kurz und eindeutig</FieldDescription>
      </Field>,
    );
    const input = container.querySelector("input")!;
    const label = container.querySelector("label")!;
    // The association is the point of the fix — assert it directly rather than
    // trusting axe alone.
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).toBeTruthy();
    expect(input.getAttribute("aria-describedby")).toContain("description");
    expect(await auditContainer(container)).toEqual([]);
  });

  it("two <Field>s on the same page get distinct ids", () => {
    const { container } = render(
      <>
        <Field>
          <Label>Eins</Label>
          <Input value="" onChange={() => {}} />
        </Field>
        <Field>
          <Label>Zwei</Label>
          <Input value="" onChange={() => {}} />
        </Field>
      </>,
    );
    const ids = Array.from(container.querySelectorAll("input")).map(
      (i) => i.id,
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("<FieldError> marks the control invalid and is announced", () => {
    const { container } = render(
      <Field>
        <Label>Pflichtfeld</Label>
        <Input value="" onChange={() => {}} />
        <FieldError>Bitte ausfüllen</FieldError>
      </Field>,
    );
    const input = container.querySelector("input")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("error");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("a bare Input with only a placeholder still ends up with an accessible name", async () => {
    // This is the S14-09 safety net: 578 of 663 fields looked like this.
    // The name is not ideal (a placeholder disappears once the user types),
    // but "combo box, no label" is a WCAG 4.1.2 failure and this is not.
    const { container } = render(
      <Input
        placeholder="Kontrollen durchsuchen…"
        value=""
        onChange={() => {}}
      />,
    );
    const input = container.querySelector("input")!;
    expect(input.getAttribute("aria-label")).toBe("Kontrollen durchsuchen…");
    expect(await auditContainer(container)).toEqual([]);
  });

  it("a real label wins over the placeholder fallback (WCAG 2.5.3, Label in Name)", () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/label-has-associated-control -- the wrapping-label pattern IS the subject of this test; the rule cannot see the <input> through the <Input> indirection
      <label>
        Sichtbarer Name
        <Input placeholder="Platzhalter" value="" onChange={() => {}} />
      </label>,
    );
    const input = container.querySelector("input")!;
    // The fallback must never overwrite a name the author supplied — otherwise
    // the spoken name and the visible name diverge.
    expect(input.getAttribute("aria-label")).toBeNull();
  });

  it("a bare Textarea gets a name from its placeholder", async () => {
    const { container } = render(
      <Textarea placeholder="Begründung" value="" onChange={() => {}} />,
    );
    expect(
      container.querySelector("textarea")!.getAttribute("aria-label"),
    ).toBe("Begründung");
    expect(await auditContainer(container)).toEqual([]);
  });

  it("a SelectTrigger inside a <Field> references the label (S14-12: button-name, critical)", async () => {
    const { container } = render(
      <Field>
        <Label>Compliance-Profil</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Auswählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );
    const trigger = container.querySelector('[role="combobox"]')!;
    const labelledBy = trigger.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    // `<label for>` cannot name a <button>, so the trigger must point back at
    // the label instead — assert the reference actually resolves.
    expect(
      labelledBy!
        .split(/\s+/)
        .some((id) => container.ownerDocument.getElementById(id)?.textContent),
    ).toBe(true);
    expect(await auditContainer(container)).toEqual([]);
  });

  it("a Slider has an accessible name (S14-12: aria-input-field-name, serious)", async () => {
    const { container } = render(
      <Field>
        <Label>Eintrittswahrscheinlichkeit</Label>
        <Slider defaultValue={[3]} min={1} max={5} step={1} />
      </Field>,
    );
    expect(await auditContainer(container)).toEqual([]);
  });
});

describe("axe: components the audit named (S14-12)", () => {
  it("ProgrammeProgressBar is named and never reports aria-valuenow=NaN", async () => {
    const { container } = render(<ProgrammeProgressBar percent={42} />);
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(await auditContainer(container)).toEqual([]);
  });

  it("ProgrammeProgressBar with an undefined percentage degrades to indeterminate, not to NaN", async () => {
    // `Math.max(0, Math.min(100, percent))` produced `aria-valuenow="NaN"`,
    // which axe reported as `aria-valid-attr-value` (critical). An unknown
    // value must be expressed as *absent*, which is the ARIA meaning of an
    // indeterminate progress bar.
    const { container } = render(
      <ProgrammeProgressBar percent={undefined as unknown as number} />,
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(await auditContainer(container)).toEqual([]);
  });
});
