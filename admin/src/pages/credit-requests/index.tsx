import { Space } from "antd";
import { CreditRequestsList } from "./list";
import { CreditSettingsCard } from "./settings";

export const CreditRequestsPage = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <CreditSettingsCard />
      <CreditRequestsList />
    </Space>
  );
};
