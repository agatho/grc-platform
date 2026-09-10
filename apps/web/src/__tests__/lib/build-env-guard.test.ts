import { describe, expect, it } from "vitest";

import {
  findBuildNodeEnvConflict,
  isNextBuildInvocation,
} from "@/lib/build-env-guard";

const NEXT_BIN_WIN = "C:\\repo\\node_modules\\next\\dist\\bin\\next";
const NEXT_BIN_POSIX = "/repo/node_modules/next/dist/bin/next";

describe("isNextBuildInvocation", () => {
  it("recognises `next build` on both path styles", () => {
    expect(isNextBuildInvocation(["node", NEXT_BIN_WIN, "build"])).toBe(true);
    expect(isNextBuildInvocation(["node", NEXT_BIN_POSIX, "build"])).toBe(true);
    expect(
      isNextBuildInvocation([
        "node",
        NEXT_BIN_POSIX,
        "build",
        "--debug-prerender",
      ]),
    ).toBe(true);
  });

  it("is false for dev, start and for build workers", () => {
    expect(isNextBuildInvocation(["node", NEXT_BIN_POSIX, "dev"])).toBe(false);
    expect(isNextBuildInvocation(["node", NEXT_BIN_POSIX, "start"])).toBe(
      false,
    );
    // jest-worker / export workers are started with a worker script, not the CLI.
    expect(
      isNextBuildInvocation([
        "node",
        "/repo/node_modules/next/dist/compiled/jest-worker/processChild.js",
      ]),
    ).toBe(false);
    expect(
      isNextBuildInvocation(["node", "/repo/scripts/next-build.mjs"]),
    ).toBe(false);
  });
});

describe("findBuildNodeEnvConflict (OP-167)", () => {
  const build = ["node", NEXT_BIN_POSIX, "build"];

  it("refuses `next build` with NODE_ENV=development", () => {
    const reason = findBuildNodeEnvConflict({
      nodeEnv: "development",
      argv: build,
    });
    expect(reason).toMatch(/NODE_ENV=development/);
    expect(reason).toMatch(/useContext/);
    expect(reason).toMatch(/OP-167/);
  });

  it("allows the production default and an unset NODE_ENV", () => {
    expect(
      findBuildNodeEnvConflict({ nodeEnv: "production", argv: build }),
    ).toBeNull();
    expect(
      findBuildNodeEnvConflict({ nodeEnv: undefined, argv: build }),
    ).toBeNull();
    expect(
      findBuildNodeEnvConflict({ nodeEnv: "test", argv: build }),
    ).toBeNull();
  });

  it("allows --debug-prerender, the one supported development-mode build", () => {
    expect(
      findBuildNodeEnvConflict({
        nodeEnv: "development",
        argv: [...build, "--debug-prerender"],
      }),
    ).toBeNull();
  });

  it("does not fire for `next dev`, where development is the normal value", () => {
    expect(
      findBuildNodeEnvConflict({
        nodeEnv: "development",
        argv: ["node", NEXT_BIN_POSIX, "dev"],
      }),
    ).toBeNull();
  });
});
