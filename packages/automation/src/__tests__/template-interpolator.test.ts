import { describe, it, expect } from "vitest";
import { interpolate, interpolateConfig } from "../template-interpolator";

describe("interpolate", () => {
  it("replaces entity variables", () => {
    expect(
      interpolate("Risk {entity.title} has score {entity.score}", {
        title: "Ransomware",
        score: 18,
      }),
    ).toBe("Risk Ransomware has score 18");
  });

  it("handles missing values", () => {
    expect(
      interpolate("Value: {entity.missing}", { other: 1 }),
    ).toBe("Value: ");
  });

  it("handles nested entity values", () => {
    expect(
      interpolate("Owner: {entity.owner.name}", {
        owner: { name: "Test User" },
      }),
    ).toBe("Owner: Test User");
  });

  it("leaves non-entity placeholders unchanged", () => {
    expect(
      interpolate("Hello {name}", { title: "World" }),
    ).toBe("Hello {name}");
  });

  it("handles multiple replacements", () => {
    expect(
      interpolate(
        "{entity.title} ({entity.status}) - Score: {entity.score}",
        { title: "Risk A", status: "open", score: 42 },
      ),
    ).toBe("Risk A (open) - Score: 42");
  });
});

describe("interpolateConfig", () => {
  it("interpolates all string values in config", () => {
    const result = interpolateConfig(
      {
        title: "Review {entity.title}",
        deadlineDays: 14,
        message: "Score is {entity.score}",
      },
      { title: "My Risk", score: 20 },
    );
    expect(result.title).toBe("Review My Risk");
    expect(result.deadlineDays).toBe(14);
    expect(result.message).toBe("Score is 20");
  });
});
