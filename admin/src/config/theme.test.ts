import { theme } from "antd";
import { describe, expect, it } from "vitest";

import {
  GRIDGO_ACTION_YELLOW,
  GRIDGO_BRAND_YELLOW,
  gridTheme,
} from "./theme";

describe("gridTheme", () => {
  it("uses GRIDGO action yellow (#FFDE58) from the PRD dual-theme tokens", () => {
    expect(GRIDGO_ACTION_YELLOW).toBe("#FFDE58");
    expect(GRIDGO_BRAND_YELLOW).toBe(GRIDGO_ACTION_YELLOW);
    expect(gridTheme.token?.colorPrimary).toBe(GRIDGO_ACTION_YELLOW);
    expect(gridTheme.algorithm).toBe(theme.darkAlgorithm);
    expect(gridTheme.components?.Menu?.darkItemSelectedBg).toBe(
      GRIDGO_ACTION_YELLOW,
    );
    expect(gridTheme.components?.Menu?.darkItemHoverColor).toBe(
      GRIDGO_ACTION_YELLOW,
    );
    expect(gridTheme.components?.Menu?.darkItemSelectedColor).toBe("#141414");
  });
});
