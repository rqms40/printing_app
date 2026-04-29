import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSourceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectTsxFiles(fullPath);
    }

    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

describe("admin console warning regressions", () => {
  it("opts BrowserRouter into React Router v7 future behavior", () => {
    const source = readSourceFile("App.tsx");

    expect(source).toContain("v7_startTransition: true");
    expect(source).toContain("v7_relativeSplatPath: true");
  });

  it("does not use the deprecated AntD Card bordered prop", () => {
    const deprecatedCardUsages = collectTsxFiles(join(process.cwd(), "src"))
      .flatMap((filePath) =>
        readFileSync(filePath, "utf8")
          .split("\n")
          .map((line, index) => ({ filePath, line, lineNumber: index + 1 })),
      )
      .filter(({ line }) => /<Card\b/.test(line) && /\bbordered\b/.test(line));

    expect(deprecatedCardUsages).toEqual([]);
  });

  it("does not use Refine Show because it forwards the deprecated Card bordered prop", () => {
    const refineShowImports = collectTsxFiles(join(process.cwd(), "src"))
      .flatMap((filePath) =>
        readFileSync(filePath, "utf8")
          .split("\n")
          .map((line, index) => ({ filePath, line, lineNumber: index + 1 })),
      )
      .filter(
        ({ line }) =>
          /import\s+\{[^}]*\bShow\b[^}]*\}\s+from\s+["']@refinedev\/antd["']/.test(
            line,
          ),
      );

    expect(refineShowImports).toEqual([]);
  });
});
