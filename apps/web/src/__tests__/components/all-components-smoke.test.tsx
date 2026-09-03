// @vitest-environment jsdom
//
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-03, S14-12]
//
// WHAT THIS FILE USED TO BE. It auto-discovered every component under
// apps/web/src/components/ and emitted two `it()` blocks per file:
// "loads without errors" (`await expect(importer()).resolves.toBeDefined()`)
// and "exports a component" (`typeof v === "function" || "$$typeof" in v`).
// Nothing was ever rendered — S14-12 recorded that verbatim. The file was one
// of the three generators that produced 82.9 % of all @grc/web tests, and its
// share of that number was pure inflation: 254 green assertions that could
// only fail if a module literally failed to parse.
//
// WHAT IT IS NOW. The import check keeps its (real, if modest) value — a
// component that throws at module scope breaks every page that imports it —
// but it is ONE test that reports every offender at once instead of one test
// per file. On top of that sit real render tests: components are mounted into
// jsdom and asserted on their accessible output (role, accessible name, state
// attributes, disabled semantics). Those can actually fail when a component
// regresses.
//
// Deliberately NOT a per-component render matrix: most components need
// props, data and context; auto-rendering them would either need a mock for
// every one of them (mocks against mocks again) or would degrade into
// try/catch-and-pass. A curated set of primitives that carries the
// accessibility contract of the whole design system is the honest trade.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as React from "react";

// Stub heavy/incompatible runtime modules that components may import.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
  useLocale: () => "de",
  useFormatter: () => ({
    dateTime: (d: Date) => d.toString(),
    number: (n: number) => String(n),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    `<a href="${href}">${String(children)}</a>`,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
  Toaster: () => null,
}));

vi.mock("recharts", () => {
  const stub = () => null;
  return {
    ResponsiveContainer: stub,
    BarChart: stub,
    Bar: stub,
    LineChart: stub,
    Line: stub,
    PieChart: stub,
    Pie: stub,
    Cell: stub,
    AreaChart: stub,
    Area: stub,
    RadarChart: stub,
    Radar: stub,
    PolarGrid: stub,
    PolarAngleAxis: stub,
    PolarRadiusAxis: stub,
    XAxis: stub,
    YAxis: stub,
    ZAxis: stub,
    CartesianGrid: stub,
    Tooltip: stub,
    Legend: stub,
    Label: stub,
    LabelList: stub,
    ScatterChart: stub,
    Scatter: stub,
    ComposedChart: stub,
    Brush: stub,
    ReferenceLine: stub,
    ReferenceArea: stub,
    Sector: stub,
    Treemap: stub,
    Funnel: stub,
    FunnelChart: stub,
    RadialBar: stub,
    RadialBarChart: stub,
  };
});

vi.mock("bpmn-js", () => ({
  default: class {
    importXML = vi.fn().mockResolvedValue({ warnings: [] });
    saveXML = vi.fn().mockResolvedValue({ xml: "<bpmn />" });
    destroy = vi.fn();
    on = vi.fn();
    off = vi.fn();
    get = vi.fn(() => ({ get: vi.fn() }));
  },
}));

vi.mock("bpmn-js/lib/Modeler", () => ({
  default: class {
    importXML = vi.fn().mockResolvedValue({ warnings: [] });
    saveXML = vi.fn().mockResolvedValue({ xml: "<bpmn />" });
    destroy = vi.fn();
    on = vi.fn();
    off = vi.fn();
    get = vi.fn(() => ({ get: vi.fn() }));
  },
}));

// [ARCTOS-FULL-2026-08-31 · OP-167] Kein Typargument an `import.meta.glob`.
//
// Next 16.3 bringt eine eigene Deklaration von `import.meta.glob` mit, die
// KEIN Typargument nimmt; Vites Deklaration nimmt eines. Wer eines übergibt,
// bekommt unter 16.3 `TS2558: Expected 0 type arguments, but got 1` und
// darunter eine Kaskade von `unknown`. Die Form unten ist unter beiden
// Deklarationen gültig und sagt dasselbe: ein Verzeichnis von Pfaden auf
// Lader, die ein Modulobjekt liefern.
const componentModules = import.meta.glob(
  "../../components/**/*.tsx",
) as Record<string, () => Promise<Record<string, unknown>>>;

function isComponentLike(v: unknown): boolean {
  if (typeof v === "function") return true;
  if (v && typeof v === "object") {
    return "$$typeof" in v || "render" in v || "type" in v;
  }
  return false;
}

describe("Frontend components — module integrity (auto-discovered)", () => {
  it("discovers every component file under src/components", () => {
    // 127 .tsx files at the time of writing. A glob that silently stops
    // matching must fail loudly instead of shrinking the suite to nothing.
    expect(Object.keys(componentModules).length).toBeGreaterThanOrEqual(100);
  });

  it("imports every component module without throwing", async () => {
    const broken: string[] = [];
    for (const [path, importer] of Object.entries(componentModules)) {
      try {
        await importer();
      } catch (err) {
        broken.push(
          `${path.replace("../../components/", "")}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    expect(
      broken,
      `component modules that fail to import:\n${broken.join("\n")}`,
    ).toEqual([]);
  });

  it("exports at least one component from every component module", async () => {
    const empty: string[] = [];
    for (const [path, importer] of Object.entries(componentModules)) {
      let mod: Record<string, unknown>;
      try {
        mod = await importer();
      } catch {
        continue; // already reported by the import test above
      }
      const exports = Object.entries(mod).filter(([k]) => !k.startsWith("__"));
      if (!exports.some(([, v]) => isComponentLike(v))) {
        empty.push(path.replace("../../components/", ""));
      }
    }
    expect(
      empty,
      `component files without a component export (dead files?):\n${empty.join("\n")}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Real render tests. These mount components and assert on the accessibility
// tree, not on the fact that an import resolved.
// ---------------------------------------------------------------------------

describe("Design-system primitives render with their accessibility contract", () => {
  afterEach(() => cleanup());

  it("Button renders a native button with its label as accessible name", async () => {
    const { Button } = await import("../../components/ui/button");
    render(<Button>Risiko anlegen</Button>);
    const btn = screen.getByRole("button", { name: "Risiko anlegen" });
    expect(btn.tagName).toBe("BUTTON");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("Button forwards disabled to the DOM instead of only styling it", async () => {
    const { Button } = await import("../../components/ui/button");
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Freigeben
      </Button>,
    );
    const btn = screen.getByRole("button", {
      name: "Freigeben",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Button variant=link still exposes the button role", async () => {
    const { Button } = await import("../../components/ui/button");
    render(<Button variant="link">Details</Button>);
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
  });

  it("Input is reachable by its associated Label (WCAG 3.3.2 / S14-09)", async () => {
    const { Input } = await import("../../components/ui/input");
    const { Label } = await import("../../components/ui/label");
    render(
      <>
        <Label htmlFor="risk-title">Titel des Risikos</Label>
        <Input id="risk-title" defaultValue="Ausfall Rechenzentrum" />
      </>,
    );
    const field = screen.getByLabelText(
      "Titel des Risikos",
    ) as HTMLInputElement;
    expect(field.value).toBe("Ausfall Rechenzentrum");
  });

  it("Input propagates typed values to its onChange handler", async () => {
    const { Input } = await import("../../components/ui/input");
    const onChange = vi.fn();
    render(<Input aria-label="Suche" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "NIS2" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      (onChange.mock.calls[0]![0] as { target: HTMLInputElement }).target.value,
    ).toBe("NIS2");
  });

  it("Textarea keeps its accessible name and value", async () => {
    const { Textarea } = await import("../../components/ui/textarea");
    render(<Textarea aria-label="Beschreibung" defaultValue="Sachverhalt" />);
    const box = screen.getByLabelText("Beschreibung") as HTMLTextAreaElement;
    expect(box.tagName).toBe("TEXTAREA");
    expect(box.value).toBe("Sachverhalt");
  });

  it("Badge renders its text content", async () => {
    const { Badge } = await import("../../components/ui/badge");
    render(<Badge>kritisch</Badge>);
    expect(screen.getByText("kritisch")).toBeTruthy();
  });

  it("Card renders title and body as readable text", async () => {
    const card = await import("../../components/ui/card");
    render(
      <card.Card>
        <card.CardHeader>
          <card.CardTitle>Offene Massnahmen</card.CardTitle>
        </card.CardHeader>
        <card.CardContent>12 faellig</card.CardContent>
      </card.Card>,
    );
    expect(screen.getByText("Offene Massnahmen")).toBeTruthy();
    expect(screen.getByText("12 faellig")).toBeTruthy();
  });

  it("Table renders a real table structure with header and row cells", async () => {
    const t = await import("../../components/ui/table");
    render(
      <t.Table>
        <t.TableHeader>
          <t.TableRow>
            <t.TableHead>Titel</t.TableHead>
            <t.TableHead>Status</t.TableHead>
          </t.TableRow>
        </t.TableHeader>
        <t.TableBody>
          <t.TableRow>
            <t.TableCell>Ausfall RZ</t.TableCell>
            <t.TableCell>offen</t.TableCell>
          </t.TableRow>
        </t.TableBody>
      </t.Table>,
    );
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "Ausfall RZ" })).toBeTruthy();
  });

  it("Checkbox exposes checked state through the accessibility tree", async () => {
    const { Checkbox } = await import("../../components/ui/checkbox");
    render(<Checkbox aria-label="Massnahme erledigt" />);
    const box = screen.getByRole("checkbox", { name: "Massnahme erledigt" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("Switch is fully controlled: click reports the new value, state comes from props", async () => {
    const { Switch } = await import("../../components/ui/switch");
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch aria-label="Modul aktiv" onCheckedChange={onCheckedChange} />,
    );
    const sw = screen.getByRole("switch", { name: "Modul aktiv" });
    expect(sw.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(sw);
    // The component holds no internal state — it reports the intent and the
    // caller re-renders with the new value. aria-checked must therefore still
    // read "false" here; a Switch that flipped on its own would diverge from
    // the value the form actually submits.
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw.getAttribute("aria-checked")).toBe("false");

    rerender(
      <Switch
        aria-label="Modul aktiv"
        checked
        onCheckedChange={onCheckedChange}
      />,
    );
    expect(
      screen
        .getByRole("switch", { name: "Modul aktiv" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("Switch does not report a change while disabled", async () => {
    const { Switch } = await import("../../components/ui/switch");
    const onCheckedChange = vi.fn();
    render(
      <Switch
        aria-label="Modul gesperrt"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Modul gesperrt" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("Progress reports its value to assistive technology", async () => {
    const { Progress } = await import("../../components/ui/progress");
    render(<Progress value={42} aria-label="Umsetzungsgrad" />);
    const bar = screen.getByRole("progressbar", { name: "Umsetzungsgrad" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  // [ARCTOS-FULL-2026-08-31 / WP11 · S14-12] `ui/loading-spinner.tsx` rendered
  // three decorative <span> dots with no role="status", no aria-label and no
  // sr-only text: every loading state in the app was silent for a screen
  // reader (WCAG 4.1.3 / EN 301 549 §9.4.1.3). WP11 found the defect with this
  // test and reported it; WP12 fixed the component, so this is a plain
  // regression test again. It was an `it.fails` for exactly as long as the
  // defect existed — never a skip.
  it("LoadingSpinner is announced rather than silent (S14-12)", async () => {
    const mod = (await import("../../components/ui/loading-spinner")) as Record<
      string,
      unknown
    >;
    const Spinner = (mod.LoadingSpinner ?? mod.default) as React.ComponentType<
      Record<string, unknown>
    >;
    const { container } = render(<Spinner />);
    // An ARIA live/status role or an accessible name must be present: a purely
    // decorative spinner leaves a screen reader with silence.
    const announced =
      container.querySelector('[role="status"]') ??
      container.querySelector("[aria-label]") ??
      container.querySelector("[aria-live]") ??
      container.querySelector(".sr-only");
    expect(
      announced,
      "LoadingSpinner renders no role=status / aria-label / sr-only text",
    ).not.toBeNull();
  });
});
