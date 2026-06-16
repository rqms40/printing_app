import { theme } from "antd";
import type { ThemeConfig } from "antd";

const GRIDGO_BRAND_YELLOW = "#FFDE58";

export const gridTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: GRIDGO_BRAND_YELLOW,
  },
  components: {
    Menu: {
      darkItemSelectedBg: GRIDGO_BRAND_YELLOW,
      darkItemSelectedColor: "#141414",
      darkItemHoverColor: GRIDGO_BRAND_YELLOW,
    },
  },
};
