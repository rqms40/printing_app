import { Typography, theme, Space, Row, Col } from "antd";
import { GridLogo } from "@/components/grid-logo";

const { Text } = Typography;

const STATUSES = [
  { title: "Order Placed", date: "Mar 24, 2026", time: "3:00 PM", progress: 5 },
  { title: "File Verified", date: "Mar 24, 2026", time: "5:00 PM", progress: 15 },
  { title: "Printing in Progress", date: "Mar 24, 2026", time: "7:00 PM", progress: 30 },
  { title: "Finishing & Mounting", date: "Mar 25, 2026", time: "10:00 AM", progress: 45 },
  { title: "Quality Checked", date: "Mar 25, 2026", time: "3:00 PM", progress: 55 },
  { title: "Ready for Dispatch", date: "Mar 26, 2026", time: "3:00 AM", progress: 65 },
  { title: "Driver Assigned", date: "Mar 27, 2026", time: "2:00 PM", progress: 75 },
  { title: "Picked Up", date: "Mar 27, 2026", time: "2:20 PM", progress: 80 },
  { title: "On the Way", date: "Mar 27, 2026", time: "2:30 PM", progress: 90, highlight: true },
  { title: "Arrived at Destination", date: "Mar 27, 2026", time: "3:00 PM", progress: 95 },
  { title: "Delivered", date: "Mar 27, 2026", time: "3:15 PM", progress: 100 },
];

export function CustomStatusNotifications() {
  const { token } = theme.useToken();

  return (
    <div style={{ padding: "24px", background: token.colorBgLayout, borderRadius: "8px" }}>
      <Row gutter={[24, 24]}>
        {STATUSES.map((status, index) => (
          <Col xs={24} sm={12} lg={8} key={index}>
            <div
              style={{
                background: "#4b4b4b", // Dark background resembling the sample
                borderRadius: "16px",
                padding: "16px",
                width: "100%",
                boxShadow: token.boxShadowSecondary,
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              <div
                style={{
                  background: "#000000ff", // Brand yellow
                  borderRadius: "12px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "4px",
                }}
              >
                <GridLogo size={24} />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Text style={{ fontSize: "12px", color: "#a0a0a0", lineHeight: "1" }}>
                  GRID
                </Text>
                <Text style={{ fontSize: "14px", color: "#FFDE58", fontWeight: 600, marginTop: "2px", marginBottom: "8px" }}>
                  GRID GO
                </Text>

                <Text style={{ fontSize: "18px", color: "#ffffff", fontWeight: 600, marginBottom: "4px" }}>
                  {status.title}
                </Text>

                <Text style={{ fontSize: "14px", color: status.highlight ? "#FFDE58" : "#a0a0a0", marginBottom: "12px" }}>
                  {status.date} · {status.time}
                </Text>

                <div style={{ height: "4px", background: "#333", borderRadius: "2px", overflow: "hidden", position: "relative" }}>
                  <div
                    style={{
                      width: `${status.progress}%`,
                      height: "100%",
                      background: "#FFDE58",
                      borderRadius: "2px",
                    }}
                  />
                  {/* Delivery icon at the end of progress */}
                  <div
                    style={{
                      position: "absolute",
                      left: `calc(${status.progress}% - 8px)`,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "10px"
                    }}
                  >
                    🛵
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}
