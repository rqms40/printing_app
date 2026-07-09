import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin document title", () => {
  it("keeps the GRIDGO Admin title after Refine mounts", () => {
    const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

    expect(appSource).toMatch(
      /<DocumentTitleHandler\s+handler=\{\(\)\s*=>\s*["']GRIDGO Admin["']\}\s*\/>/,
    );
  });
});
