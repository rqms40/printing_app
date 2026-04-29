import type { ReactNode } from "react";
import { Card, Space, Spin, Typography } from "antd";
import type { CardProps } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface ShowPageProps {
  title: ReactNode;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
  extra?: ReactNode;
  loading?: boolean;
  contentCard?: boolean;
  contentVariant?: CardProps["variant"];
}

export function ShowPage({
  title,
  children,
  backTo,
  backLabel = "Back to list",
  extra,
  loading = false,
  contentCard = true,
  contentVariant = "borderless",
}: ShowPageProps) {
  const content = contentCard ? (
    <Card variant={contentVariant}>{children}</Card>
  ) : (
    children
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Space direction="vertical" size={8}>
          {backTo && (
            <Link
              to={backTo}
              aria-label={backLabel}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 500,
              }}
            >
              <ArrowLeftOutlined />
              {backLabel}
            </Link>
          )}
          <Title
            level={1}
            style={{ margin: 0, fontSize: 24, lineHeight: 1.3 }}
          >
            {title}
          </Title>
        </Space>
        {extra}
      </div>
      <Spin spinning={loading}>{content}</Spin>
    </Space>
  );
}
