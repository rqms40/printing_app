import { Typography, Card, Space, Divider, Tag, Spin, theme } from "antd";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShowPage } from "@/components/show-page";
import { apiClient } from "@/providers/api-client";
import { formatDate } from "@/utils/format";
import {
  parseTamSurveyFeedback,
  TAM_SURVEY_FEEDBACK_FIELDS,
} from "./feedback";

const { Title, Text, Paragraph } = Typography;

const SURVEY_QUESTIONS = [
  // SURVEY
  { category: 'SURVEY', question: 'GRIDGO allows me to manage my printing tasks more efficiently.' },
  { category: 'SURVEY', question: 'Using GRIDGO simplifies my entire printing process.' },
  { category: 'SURVEY', question: 'It was easy to learn how to use the GRIDGO app.' },
  { category: 'SURVEY', question: 'I find the GRIDGO app intuitive and easy to navigate.' },
  { category: 'SURVEY', question: 'I intend to continue using GRIDGO for my printing needs.' },
  { category: 'SURVEY', question: 'I would recommend GRIDGO to my peers or colleagues.' },
  // LOGISTICS & SERVICE
  { category: 'LOGISTICS & SERVICE', question: 'Accuracy of the prints received compared to your digital order.' },
  { category: 'LOGISTICS & SERVICE', question: 'Physical condition of the prints (no damage, clean finish).' },
  { category: 'LOGISTICS & SERVICE', question: 'Speed and punctuality of the delivery/pickup readiness.' },
  { category: 'LOGISTICS & SERVICE', question: 'Clarity of the status updates (Order Received, Printing, For Delivery).' },
  { category: 'LOGISTICS & SERVICE', question: 'The delivery/pickup system fits my schedule perfectly.' },
  // PRODUCT & TECHNICAL SPECIFICS
  { category: 'PRODUCT & TECHNICAL SPECIFICS', question: 'Color accuracy and resolution of the final product.' },
  { category: 'PRODUCT & TECHNICAL SPECIFICS', question: 'The weight and feel of the paper/media used.' },
  { category: 'PRODUCT & TECHNICAL SPECIFICS', question: 'Performance of the app (no crashes or slow loading).' },
];

const LIKERT_SCALES = [
  { label: 'Strongly Disagree', value: 0, color: 'red' },
  { label: 'Disagree', value: 1, color: 'volcano' },
  { label: 'Neutral', value: 2, color: 'gold' },
  { label: 'Agree', value: 3, color: 'lime' },
  { label: 'Strongly Agree', value: 4, color: 'green' },
];

export function TamSurveyShow() {
  const { token } = theme.useToken();
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void apiClient.get(`/admin/tam-surveys/${id}`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch survey", err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!data) {
    return <div style={{ padding: 40 }}>Survey not found.</div>;
  }

  const getAverageScore = (surveyData: any): string => {
    if (!surveyData) return "0.0";
    const values = Object.values(surveyData) as number[];
    if (values.length === 0) return "0.0";
    const sum = values.reduce((acc, val) => acc + val, 0);
    return (sum / values.length).toFixed(1);
  };

  const avgScore = getAverageScore(data.survey_data);
  const numScore = parseFloat(avgScore);
  let avgColor = "red";
  if (numScore > 3) avgColor = "orange";
  if (numScore >= 4) avgColor = "green";

  return (
    <ShowPage title={`Survey - SURV-${data.id}`} backTo="/tam-surveys" contentCard={false}>
      <Card variant="borderless">
        <Title level={4}>Customer Details</Title>
        <Space direction="vertical" size="small" style={{ marginBottom: 24 }}>
          <Text type="secondary">Customer Name</Text>
          <Text strong style={{ fontSize: 16 }}>{data.user_name}</Text>
          <Text type="secondary" style={{ marginTop: 8 }}>Submitted On</Text>
          <Text>{formatDate(data.created_at)}</Text>
          {data.order_ref && (
            <>
              <Text type="secondary" style={{ marginTop: 8 }}>Linked Order</Text>
              <Space size="small">
                <Tag color="blue" style={{ width: "fit-content", fontFamily: "monospace" }}>
                  {data.order_ref}
                </Tag>
                {data.requirement_id && (
                  <Text type="secondary">Requirement #{data.requirement_id}</Text>
                )}
              </Space>
            </>
          )}
          <Text type="secondary" style={{ marginTop: 8 }}>Overall Score</Text>
          <Tag color={avgColor} style={{ fontSize: 16, padding: '4px 12px' }}>{avgScore} / 5.0</Tag>
        </Space>

        <Divider />

        <Title level={4}>Survey Responses</Title>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SURVEY_QUESTIONS.map((q, idx) => {
            const rawValue = data.survey_data ? data.survey_data[idx] : null;
            // The JSON from mobile sends values 0 to 4 (matching index) or 1 to 5?
            // "Strongly Disagree" (Likert index 0)
            const scale = LIKERT_SCALES.find((s) => s.value === rawValue) || LIKERT_SCALES[2]; // Default to neutral if somehow missing mapped

            return (
              <Card key={idx} size="small" variant="borderless" style={{ background: token.colorBgLayout }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {q.category.toUpperCase()}
                </Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ flex: 1, paddingRight: 16, color: token.colorText }}>{q.question}</Text>
                  {rawValue !== null && rawValue !== undefined ? (
                    <Tag color={scale.color}>{scale.label}</Tag>
                  ) : (
                    <Tag>Unanswered</Tag>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Divider />

        <Title level={4}>Additional Feedback</Title>
        {(() => {
          const parsed = parseTamSurveyFeedback(data.open_forum_feedback);
          const answeredFields = TAM_SURVEY_FEEDBACK_FIELDS.filter(
            ({ key }) => parsed[key],
          );
          if (answeredFields.length === 0) {
            return <Text type="secondary">No additional feedback provided.</Text>;
          }

          return (
            <Card style={{ background: token.colorBgLayout, borderColor: token.colorBorder }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {answeredFields.map(({ key, label }) => (
                  <div key={key}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
                    <Paragraph style={{ margin: 0, marginTop: 4, fontSize: 15, fontStyle: 'italic', color: token.colorPrimary }}>
                      "{parsed[key]}"
                    </Paragraph>
                  </div>
                ))}
              </Space>
            </Card>
          );
        })()}
      </Card>
    </ShowPage>
  );
}
