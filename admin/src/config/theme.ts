import { theme } from "antd";
import type { ThemeConfig } from "antd";

const GRID_BRAND_YELLOW = "#FFDE58";

export const gridTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: GRID_BRAND_YELLOW,
  },
  components: {
    Menu: {
      darkItemSelectedBg: GRID_BRAND_YELLOW,
      darkItemSelectedColor: "#141414",
      darkItemHoverColor: GRID_BRAND_YELLOW,
    },
  },
};
