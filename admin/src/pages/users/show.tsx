import { ListButton, Show } from "@refinedev/antd";
import {
  Alert,
  Card,
  Descriptions,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import {
  buildAdminUserDetailViewModel,
  loadAdminUserDetail,
} from "@/pages/users/data";
import { humanizeEnumValue, type AdminUserDetailPayload } from "@/utils/api-normalizers";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  statusLabel,
} from "@/utils/format";

const { Paragraph, Text, Title } = Typography;

function renderValue(value: string | null | undefined, fallback: string) {
  return value ? value : fallback;
}

function UserHero({ detail }: { detail: AdminUserDetailPayload["user"] }) {
  return (
    <Card>
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {detail.full_name ?? `User #${detail.id}`}
        </Title>
        <Space wrap size={[8, 8]}>
          <Text>{detail.email}</Text>
          <Text type="secondary">
            {renderValue(detail.phone_number, "No phone provided")}
          </Text>
        </Space>
        <Space wrap size={[8, 8]}>
          <Tag color="blue">{humanizeEnumValue(detail.role, "Unknown")}</Tag>
          <Tag color={detail.is_profile_complete ? "green" : "default"}>
            {detail.is_profile_complete ? "Profile Complete" : "Profile Incomplete"}
          </Tag>
          <Tag color={detail.is_active ? "green" : "default"}>
            {detail.is_active ? "Active" : "Inactive"}
          </Tag>
        </Space>
      </Space>
    </Card>
  );
}


function ProfileSummary({ detail }: { detail: AdminUserDetailPayload["user"] }) {
  return (
    <Card title="Profile Summary">
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Category">
          {renderValue(
            detail.profile_category ? humanizeEnumValue(detail.profile_category) : null,
            "No category provided",
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Field">
          {renderValue(
            detail.profile_field ? humanizeEnumValue(detail.profile_field) : null,
            "No field provided",
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Course">
          {renderValue(detail.course, "No course provided")}
        </Descriptions.Item>
        <Descriptions.Item label="Organization">
          {renderValue(detail.organization, "No organization provided")}
        </Descriptions.Item>
        <Descriptions.Item label="Gender">
          {renderValue(
            detail.gender ? humanizeEnumValue(detail.gender) : null,
            "No gender provided",
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Date of Birth">
          {detail.date_of_birth ? formatDate(detail.date_of_birth) : "No date of birth provided"}
        </Descriptions.Item>
        <Descriptions.Item label="Joined">
          {formatDateTime(detail.created_at)}
        </Descriptions.Item>
        <Descriptions.Item label="Updated">
          {formatDateTime(detail.updated_at)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

function PrintPreferences({ preferences }: { preferences: string[] }) {
  return (
    <Card title="Print Preferences">
      {preferences.length > 0 ? (
        <Space wrap size={[8, 8]}>
          {preferences.map((preference) => (
            <Tag key={preference}>{humanizeEnumValue(preference)}</Tag>
          ))}
        </Space>
      ) : (
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          No print preferences yet
        </Paragraph>
      )}
    </Card>
  );
}

function RecentOrders({ orders }: { orders: AdminUserDetailPayload["recent_orders"] }) {
  return (
    <Card title="Recent Orders">
      {orders.length === 0 ? (
        <Empty description="No recent orders yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          dataSource={orders}
          rowKey="id"
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            {
              title: "Order",
              dataIndex: "order_id",
            },
            {
              title: "Category",
              dataIndex: "category",
              render: (value: string) => humanizeEnumValue(value),
            },
            {
              title: "Status",
              dataIndex: "order_status",
              render: (value: Parameters<typeof statusLabel>[0]) => statusLabel(value),
            },
            {
              title: "Payment",
              dataIndex: "payment_status",
              render: (value: string) => humanizeEnumValue(value),
            },
            {
              title: "Total",
              dataIndex: "total_price",
              align: "right",
              render: (value: number) => formatCurrency(value),
            },
            {
              title: "Created",
              dataIndex: "created_at",
              render: (value: string) => formatDateTime(value),
            },
          ]}
        />
      )}
    </Card>
  );
}

export function UserShow() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    if (!id) {
      setDetail(null);
      setError("Unable to load user");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    void loadAdminUserDetail(id)
      .then((response) => {
        if (!active) {
          return;
        }

        if (!response) {
          setDetail(null);
          setError("Unable to load user");
          return;
        }

        setDetail(response);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setDetail(null);
        setError("Unable to load user");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const view = buildAdminUserDetailViewModel({
    loading,
    detail,
    error,
  });

  if (view.kind === "loading") {
    return (
      <Show
        title={view.title}
        headerButtons={({ listButtonProps }) =>
          listButtonProps ? <ListButton {...listButtonProps} /> : null
        }
      >
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      </Show>
    );
  }

  if (view.kind === "error") {
    return (
      <Show
        title={view.title}
        headerButtons={({ listButtonProps }) =>
          listButtonProps ? <ListButton {...listButtonProps} /> : null
        }
      >
        <Alert
          type="error"
          showIcon
          message={view.message}
          action={
            <a
              href="#retry"
              onClick={(event) => {
                event.preventDefault();
                setReloadKey((value) => value + 1);
              }}
            >
              {view.retryLabel}
            </a>
          }
        />
      </Show>
    );
  }

  return (
    <Show
      title={view.detail.user.full_name ?? `User #${view.detail.user.id}`}
      headerButtons={({ listButtonProps }) =>
        listButtonProps ? <ListButton {...listButtonProps} /> : null
      }
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <UserHero detail={view.detail.user} />
        <ProfileSummary detail={view.detail.user} />
        <PrintPreferences preferences={view.detail.user.printing_preferences} />
        <RecentOrders orders={view.detail.recent_orders} />
      </Space>
    </Show>
  );
}
