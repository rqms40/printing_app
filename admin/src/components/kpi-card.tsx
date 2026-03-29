import { Card, Statistic } from "antd";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  color?: string;
}

export function KpiCard({ title, value, prefix, color }: KpiCardProps) {
  return (
    <Card
      style={{
        borderLeft: `3px solid ${color ?? "#FFDE58"}`,
        background: "#141414",
      }}
    >
      <Statistic
        title={<span style={{ color: "#808080" }}>{title}</span>}
        value={value}
        prefix={prefix}
        valueStyle={{ color: "#F0F0F0", fontFamily: "Inter" }}
      />
    </Card>
  );
}
