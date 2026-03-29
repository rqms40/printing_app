import { theme } from "antd";
import type { ThemeConfig } from "antd";

export const gridTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#FFDE58",
    colorBgBase: "#000000",
    colorBgContainer: "#141414",
    colorBgElevated: "#1E1E1E",
    colorText: "#F0F0F0",
    colorTextSecondary: "#808080",
    colorBorder: "#2E2E2E",
    colorSuccess: "#66BB6A",
    colorError: "#EF5350",
    colorWarning: "#FFCA28",
    colorInfo: "#42A5F5",
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: 8,
  },
  components: {
    Layout: {
      siderBg: "#0A0A0A",
      headerBg: "#0A0A0A",
      bodyBg: "#000000",
    },
    Menu: {
      darkItemBg: "#0A0A0A",
      darkItemSelectedBg: "#1E1E1E",
      darkItemSelectedColor: "#FFDE58",
    },
    Table: {
      headerBg: "#0A0A0A",
      rowHoverBg: "#1A1A1A",
    },
    Card: {
      colorBgContainer: "#141414",
    },
  },
};
