import { theme } from "antd";
import type { ThemeConfig } from "antd";

/**
 * Marketplace dual-theme tokens (Ops / Super Admin / Supplier portal).
 *
 * Action yellow (`#FFDE58`) is a finite attention budget: one primary CTA,
 * selected nav item, or active state per dense ops context. Do not paint full
 * button grids yellow. Status chips use labels via `StatusBadge` / `statusLabel`
 * — color alone is not sufficient.
 */
export const GRIDGO_ACTION_YELLOW = "#FFDE58";
/** @deprecated Prefer GRIDGO_ACTION_YELLOW — same token. */
export const GRIDGO_BRAND_YELLOW = GRIDGO_ACTION_YELLOW;

export const gridTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: GRIDGO_ACTION_YELLOW,
  },
  components: {
    Menu: {
      darkItemSelectedBg: GRIDGO_ACTION_YELLOW,
      darkItemSelectedColor: "#141414",
      darkItemHoverColor: GRIDGO_ACTION_YELLOW,
    },
  },
};
