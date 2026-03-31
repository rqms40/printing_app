import { theme } from "antd";
import { describe, expect, it } from "vitest";

import { gridTheme } from "./theme";

describe("gridTheme", () => {
  it("uses GRID's brand yellow from the PRD instead of Refine's preset", () => {
    expect(gridTheme.token?.colorPrimary).toBe("#FFDE58");
    expect(gridTheme.algorithm).toBe(theme.darkAlgorithm);
    expect(gridTheme.components?.Menu?.darkItemSelectedBg).toBe("#FFDE58");
    expect(gridTheme.components?.Menu?.darkItemHoverColor).toBe("#FFDE58");
    expect(gridTheme.components?.Menu?.darkItemSelectedColor).toBe("#141414");
  });
});
