// @vitest-environment jsdom
//
// Auto-discovers every React component file under apps/web/src/components/
// and asserts that:
//   1. Module loads without errors
//   2. At least one named or default export is a function (component)
//
// This catches breaking changes in any component before integration tests
// (which would render full pages) ever run.

import { describe, it, expect, vi } from "vitest";

// Stub heavy/incompatible runtime modules that components may import.
vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, params?: Record<string, unknown>) =>
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
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => `<a href="${href}">${String(children)}</a>`,
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

const componentModules = import.meta.glob<Record<string, unknown>>(
  "../../components/**/*.tsx",
);

describe("Frontend components smoke (auto-discovered)", () => {
  it("discovers at least 50 component files", () => {
    expect(Object.keys(componentModules).length).toBeGreaterThanOrEqual(50);
  });

  for (const [path, importer] of Object.entries(componentModules)) {
    const cleanName = path.replace("../../components/", "").replace(".tsx", "");

    describe(cleanName, () => {
      it("loads without errors", async () => {
        await expect(importer()).resolves.toBeDefined();
      });

      it("exports a component (function or memo/forwardRef object)", async () => {
        const mod = await importer();
        const exports = Object.entries(mod).filter(
          ([k]) => !k.startsWith("__"),
        );
        const hasComponent = exports.some(([, v]) => {
          if (typeof v === "function") return true;
          if (
            v &&
            typeof v === "object" &&
            ("$$typeof" in v || "render" in v || "type" in v)
          ) {
            return true;
          }
          return false;
        });
        expect(hasComponent).toBe(true);
      });
    });
  }
});
