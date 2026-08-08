import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useGetIdentity } from "@refinedev/core";

import {
  buildAdminUserDetailViewModel,
  loadAdminUserDetail,
} from "@/pages/users/data";
import { ShowPage } from "@/components/show-page";
import {
  humanizeEnumValue,
  type AdminSupplierProfileRecord,
  type AdminUserDetailPayload,
} from "@/utils/api-normalizers";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  statusLabel,
} from "@/utils/format";
import { isSuperAdminRole } from "@/types/enums";
import type { AdminIdentity } from "@/utils/api-normalizers";
import { updateUserRole } from "@/services/superAdminApi";
import { rankLabel } from "@/utils/supplier-service-focus";

const { Paragraph, Text, Title } = Typography;

const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  under_review: "blue",
  verified: "green",
  rejected: "red",
};

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

/** Live supplier shop profile (self-edited from the supplier interface). */
function SupplierShopProfile({
  profile,
}: {
  profile: AdminSupplierProfileRecord;
}) {
  const attributeEntries = Object.entries(profile.attributes ?? {});
  const verification = profile.verification_status;

  return (
    <Card
      title="Supplier shop profile"
      extra={
        verification ? (
          <Tag color={SUPPLIER_STATUS_COLOR[verification] ?? "default"}>
            {humanizeEnumValue(verification)}
          </Tag>
        ) : null
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space align="start" size="large" wrap>
          {profile.logo_url ? (
            <img
              src={profile.logo_url}
              alt={`${profile.business_name || "Supplier"} logo`}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid #e5e7eb",
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                color: "#6b7280",
              }}
            >
              {(profile.business_name || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {renderValue(profile.business_name, "Unnamed shop")}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {renderValue(profile.description, "No description provided")}
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Shop profile #{profile.id}
              {profile.updated_at
                ? ` · Updated ${formatDateTime(profile.updated_at)}`
                : ""}
            </Text>
          </div>
        </Space>

        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Contact phone">
            {renderValue(profile.contact_phone, "No phone provided")}
          </Descriptions.Item>
          <Descriptions.Item label="Contact email">
            {renderValue(profile.contact_email, "No email provided")}
          </Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>
            {renderValue(profile.address, "No address provided")}
          </Descriptions.Item>
          <Descriptions.Item label="Service zones" span={2}>
            {profile.service_zones.length > 0
              ? profile.service_zones.join(", ")
              : "No zones listed"}
          </Descriptions.Item>
          <Descriptions.Item label="Reviews">
            {(profile.rating_average ?? 0).toFixed(1)} ★ ·{" "}
            {profile.rating_count ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="Shop active">
            <Tag color={profile.is_active ? "green" : "default"}>
              {profile.is_active ? "Active" : "Inactive"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        <div>
          <Text strong>Service focus (onboarding ranks)</Text>
          <div style={{ marginTop: 8 }}>
            {(profile.ranked_services ?? []).length > 0 ? (
              <Space wrap size={[8, 8]}>
                {profile.ranked_services.map((s) => (
                  <Tag key={s.key} color={s.rank === 1 ? "blue" : "default"}>
                    {rankLabel(s.rank)}: {s.label}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                No service focus ranks yet
              </Paragraph>
            )}
          </div>
        </div>

        <div>
          <Text strong>Attributes</Text>
          <div style={{ marginTop: 8 }}>
            {attributeEntries.length > 0 ? (
              <Space wrap size={[8, 8]}>
                {attributeEntries.map(([key, value]) => (
                  <Tag key={key}>
                    {key}
                    {value ? `: ${value}` : ""}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                No attributes yet
              </Paragraph>
            )}
          </div>
        </div>

        <div>
          <Text strong>Capabilities</Text>
          <div style={{ marginTop: 8 }}>
            {profile.capabilities.length > 0 ? (
              <Space direction="vertical" size="small" style={{ width: "100%" }}>
                {profile.capabilities.map((cap) => (
                  <div key={cap.id}>
                    <Tag color="purple">{cap.product_family}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {cap.materials.length > 0
                        ? cap.materials.join(", ")
                        : "No materials"}
                      {cap.max_capacity > 0
                        ? ` · capacity ${cap.max_capacity}`
                        : ""}
                      {cap.lead_time_days > 0
                        ? ` · lead ${cap.lead_time_days}d`
                        : ""}
                    </Text>
                  </div>
                ))}
              </Space>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                No capabilities listed
              </Paragraph>
            )}
          </div>
        </div>
      </Space>
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

/** Assignable roles only — Super Admin is singular and never offered here. */
const ROLE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "supplier", label: "Supplier" },
  { value: "rider", label: "Rider" },
  { value: "ops_admin", label: "Ops Admin" },
];

export function UserShow() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<AdminIdentity>();
  const canChangeRole = isSuperAdminRole(identity?.role);
  const [detail, setDetail] = useState<AdminUserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [nextRole, setNextRole] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);

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
        setNextRole(response.user.role);
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
      <ShowPage
        title={view.title}
        backTo="/users"
        contentCard={false}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      </ShowPage>
    );
  }

  if (view.kind === "error") {
    return (
      <ShowPage
        title={view.title}
        backTo="/users"
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
      </ShowPage>
    );
  }

  const handleRoleSave = async () => {
    if (!detail || !nextRole || nextRole === detail.user.role) return;
    setRoleSaving(true);
    try {
      await updateUserRole(detail.user.id, nextRole);
      message.success(`Role updated to ${nextRole}`);
      setReloadKey((v) => v + 1);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Role change failed (super_admin only)";
      message.error(typeof msg === "string" ? msg : "Role change failed");
    } finally {
      setRoleSaving(false);
    }
  };

  return (
    <ShowPage
      title={view.detail.user.full_name ?? `User #${view.detail.user.id}`}
      backTo="/users"
      contentCard={false}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <UserHero detail={view.detail.user} />
        {canChangeRole ? (
          <Card title="Role (Super Admin)">
            {view.detail.user.role === "super_admin" ? (
              <Alert
                type="info"
                showIcon
                message="Super Admin is a single platform owner role"
                description="This account is the only Super Admin. It is not reassignable and Super Admin is not offered when changing other users' roles."
              />
            ) : (
              <Space direction="vertical" size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Assignable roles: Client, Supplier, Rider, Ops Admin. Super
                  Admin is not listed (one account only).
                </Text>
                <Space wrap>
                  <Select
                    style={{ width: 200 }}
                    value={
                      ROLE_OPTIONS.some((o) => o.value === nextRole)
                        ? nextRole
                        : view.detail.user.role
                    }
                    options={ROLE_OPTIONS}
                    onChange={setNextRole}
                  />
                  <Button
                    type="primary"
                    loading={roleSaving}
                    disabled={
                      !nextRole ||
                      nextRole === view.detail.user.role ||
                      nextRole === "super_admin"
                    }
                    onClick={() => void handleRoleSave()}
                  >
                    Save role
                  </Button>
                </Space>
              </Space>
            )}
          </Card>
        ) : null}
        <ProfileSummary detail={view.detail.user} />
        {view.detail.supplier_profile ? (
          <SupplierShopProfile profile={view.detail.supplier_profile} />
        ) : null}
        <PrintPreferences preferences={view.detail.user.printing_preferences} />
        <RecentOrders orders={view.detail.recent_orders} />
      </Space>
    </ShowPage>
  );
}
