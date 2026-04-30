import { List } from "@refinedev/antd";
import { Table, Tooltip, Tag, Switch, Space, Typography } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate, formatRelativeTime } from "@/utils/format";
import { apiClient } from "@/providers/api-client";

export function TamSurveyList() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    void apiClient.get("/tam-surveys/settings")
      .then((res) => setIsEnabled(res.data.isEnabled))
      .catch((err) => console.error(err));
    void apiClient.get("/admin/tam-surveys")
      .then((res) => {
        setSurveys(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch surveys", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute average score from 10 questions (0-4 values mapped to 1-5 scale)
  const getAverageScore = (data: any): string => {
    if (!data) return "0.0";
    const values = Object.values(data) as number[];
    if (values.length === 0) return "0.0";
    const sum = values.reduce((acc, val) => acc + val, 0);
    return (sum / values.length).toFixed(1);
  };

  const toggleSurvey = async (checked: boolean) => {
    try {
      await apiClient.patch("/admin/tam-surveys/settings", { isEnabled: checked });
      setIsEnabled(checked);
    } catch (err) {
      console.error("Failed to toggle survey", err);
    }
  };

  return (
    <List 
      title="Surveys & Feedback"
      headerButtons={
        <Space>
          <Typography.Text type="secondary">Mobile Visibility:</Typography.Text>
          <Switch 
            checked={isEnabled} 
            onChange={toggleSurvey} 
            checkedChildren="Visible" 
            unCheckedChildren="Hidden" 
          />
        </Space>
      }
    >
      <Table
        dataSource={surveys}
        rowKey="id"
        size="middle"
        loading={loading}
        scroll={{ x: 930 }}
        onRow={(record) => ({
          onClick: () => navigate(`/tam-surveys/show/${record.id}`),
          style: { cursor: "pointer" },
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => <span style={{ color: "#808080" }}>{total} surveys</span>,
        }}
      >
        <Table.Column
          title="Survey ID"
          dataIndex="id"
          width={100}
          render={(v) => <span style={{ fontFamily: "monospace", fontWeight: 600 }}>SURV-{v}</span>}
        />
        <Table.Column
          title="Customer"
          dataIndex="user_name"
          width={150}
        />
        <Table.Column
          title="Order"
          dataIndex="order_ref"
          width={130}
          render={(v) =>
            v ? (
              <Tag color="blue" style={{ fontFamily: "monospace" }}>
                {v}
              </Tag>
            ) : (
              <Tag>Voluntary</Tag>
            )
          }
        />
        <Table.Column
          title="Avg Score"
          dataIndex="survey_data"
          width={100}
          align="center"
          render={(v) => {
            const score = getAverageScore(v);
            const num = parseFloat(score);
            let color = "red";
            if (num > 3) color = "orange";
            if (num >= 4) color = "green";
            return <Tag color={color}>{score} / 5.0</Tag>;
          }}
        />
        <Table.Column
          title="Additional Feedback"
          dataIndex="open_forum_feedback"
          render={(v: any) => {
            if (!v) return <span style={{ color: "#ccc" }}>No feedback</span>;
            let displayString = v;
            try {
              const parsed = JSON.parse(v);
              displayString = [parsed.feature, parsed.delivery].filter(Boolean).join(" | ");
            } catch (e) {
              // Not JSON
            }
            if (!displayString) return <span style={{ color: "#ccc" }}>No feedback</span>;
            return (
              <span style={{ fontStyle: "italic", color: "#555" }}>
                {displayString.length > 60 ? displayString.substring(0, 60) + "..." : displayString}
              </span>
            );
          }}
        />
        <Table.Column
          title="Submitted"
          dataIndex="created_at"
          width={130}
          render={(v: string) => (
            <Tooltip title={formatDate(v)}>
              <span>{formatRelativeTime(v)}</span>
            </Tooltip>
          )}
        />
        <Table.Column
          title="Show in Feed"
          dataIndex="is_approved_for_feed"
          align="center"
          width={110}
          render={(val, record: any) => (
            <Switch
              checked={!!val}
              size="small"
              onClick={(_checked, e) => {
                e.stopPropagation();
              }}
              onChange={async (checked) => {
                try {
                  await apiClient.patch(`/admin/tam-surveys/${record.id}/approve`, {
                    isApprovedForFeed: checked,
                  });
                  setSurveys(prev => prev.map(s => s.id === record.id ? { ...s, is_approved_for_feed: checked } : s));
                } catch (err) {
                  console.error("Failed to approve/unapprove survey for feed", err);
                }
              }}
            />
          )}
        />
        <Table.Column
          title=""
          width={50}
          render={(_: unknown, record: any) => (
            <Tooltip title="View Details">
              <EyeOutlined
                style={{ color: "#808080", fontSize: 16 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/tam-surveys/show/${record.id}`);
                }}
              />
            </Tooltip>
          )}
        />
      </Table>
    </List>
  );
}
