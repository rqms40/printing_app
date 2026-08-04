import { Space } from "antd";
import { CreditRequestsList } from "./list";
import { CreditSettingsCard } from "./settings";
import { GrantPilotCreditsCard } from "./grant";

export const CreditRequestsPage = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <GrantPilotCreditsCard />
      <CreditSettingsCard />
      <CreditRequestsList />
    </Space>
  );
};
