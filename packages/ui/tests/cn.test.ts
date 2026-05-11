// cn() utility — class-name merger built on clsx + tailwind-merge.
// Used in every UI component; if it breaks, every styled element breaks.

import { describe, it, expect } from "vitest";
import { cn } from "../src/utils";

describe("cn() — class-name composer", () => {
  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });

  it("joins multiple string arguments with space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values (undefined, null, false)", () => {
    expect(cn("a", undefined, null, false, "b")).toBe("a b");
  });

  it("supports conditional object syntax (clsx)", () => {
    expect(cn("a", { b: true, c: false, d: true })).toBe("a b d");
  });

  it("merges conflicting Tailwind utilities (later wins)", () => {
    // tailwind-merge dedups conflicting classes, last write wins
    expect(cn("p-2 p-4")).toBe("p-4");
  });

  it("merges conflicting Tailwind utilities across arguments", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting Tailwind utilities", () => {
    const result = cn("rounded-md", "bg-white", "text-sm");
    expect(result).toContain("rounded-md");
    expect(result).toContain("bg-white");
    expect(result).toContain("text-sm");
  });

  it("flattens nested arrays", () => {
    expect(cn(["a", "b"], ["c"])).toBe("a b c");
  });

  it("handles a mix of types", () => {
    expect(
      cn("base", ["arr1", "arr2"], { conditional: true }, undefined, "final"),
    ).toBe("base arr1 arr2 conditional final");
  });

  it("retains Tailwind variants correctly (hover:, dark:)", () => {
    const result = cn("hover:bg-blue-500", "dark:text-white");
    expect(result).toContain("hover:bg-blue-500");
    expect(result).toContain("dark:text-white");
  });

  it("dedupes within a single string input (clsx + twMerge interplay)", () => {
    // p-2 inside one string is preserved by clsx; twMerge then collapses
    expect(cn("p-2 p-4 p-6")).toBe("p-6");
  });
});
