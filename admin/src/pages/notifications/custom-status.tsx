import { Typography, theme, Row, Col } from "antd";
import {
  ShoppingCartOutlined,
  PrinterOutlined,
  CarOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

const STATUS_GROUPS = [
  { statusGroup: 'order', title: "Order Placed", date: "March 24, 2026 - 5:00 PM" },
  { statusGroup: 'printing', title: "File Verified", date: "March 24, 2026 - 5:00 PM" },
  { statusGroup: 'printing', title: "Printing in Progress", date: "March 24, 2026 - 7:00 PM" },
  { statusGroup: 'printing', title: "Quality Checked", date: "March 25, 2026 - 3:00 PM" },
  { statusGroup: 'dispatch', title: "Ready for Dispatch", date: "March 26, 2026 - 3:00 AM" },
  { statusGroup: 'dispatch', title: "Arrive in 30 mins...", date: "March 27, 2026 - 2:30 PM", driverName: "Carlito Jr. Dela Cruz", vehicle: "Motorcycle", plate: "123ABC", window: "9 AM - 11 PM" },
  { statusGroup: 'delivered', title: "Delivered", date: "March 27, 2026 - 3:15 PM", driverName: "Carlito Jr. Dela Cruz", vehicle: "Motorcycle", plate: "123ABC", window: "9 AM - 11 PM" },
];

const STAGES = ['order', 'printing', 'dispatch', 'delivered'];

export function CustomStatusNotifications() {
  const { token } = theme.useToken();

  return (
    <div style={{ padding: "24px", background: token.colorBgLayout, borderRadius: "8px" }}>
      <Row gutter={[24, 24]}>
        {STATUS_GROUPS.map((statusItem, index) => {
          const currentStageIndex = STAGES.indexOf(statusItem.statusGroup);
          const showRiderInfo = currentStageIndex >= 2 && statusItem.plate; // Dispatch or Delivered

          return (
            <Col xs={24} sm={24} lg={12} xl={8} key={index}>
              <div
                style={{
                  background: "#1c1c1c", // Dark background resembling the sample
                  borderRadius: "16px",
                  padding: "20px",
                  width: "100%",
                  boxShadow: token.boxShadowSecondary,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  border: "1px solid #333",
                }}
              >
                {/* Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Text style={{ fontSize: "16px", color: "#ffffff", fontWeight: 800, letterSpacing: "1px" }}>
                      GRID<span style={{ color: "#FFDE58" }}>GO</span>
                    </Text>
                    <div style={{ marginTop: "4px" }}>
                      <Text style={{ fontSize: "20px", color: "#FFDE58", fontWeight: 700, display: "block" }}>
                        {statusItem.title}
                      </Text>
                      <Text style={{ fontSize: "12px", color: "#e0e0e0" }}>
                        {statusItem.date}
                      </Text>
                    </div>
                  </div>

                  {/* Rider Info */}
                  {showRiderInfo && (
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column" }}>
                      <Text style={{ fontSize: "12px", color: "#e0e0e0" }}>{statusItem.vehicle}</Text>
                      <Text style={{ fontSize: "20px", color: "#FFDE58", fontWeight: 700 }}>{statusItem.plate}</Text>
                      <Text style={{ fontSize: "12px", color: "#e0e0e0" }}>{statusItem.window}</Text>
                    </div>
                  )}
                </div>

                {/* Optional Bottom Text like driver name if title is driver name */}
                {statusItem.title.includes("Carlito") && (
                   <Text style={{ fontSize: "12px", color: "#e0e0e0", fontStyle: "italic", marginTop: "-8px" }}>
                     OR#10290
                   </Text>
                )}

                {/* Progress Bar Area */}
                <div style={{ position: "relative", marginTop: "24px", marginBottom: "16px" }}>
                  {/* Background Line */}
                  <div style={{ position: "absolute", top: "14px", left: "12.5%", width: "75%", height: "4px", background: "#333", zIndex: 0 }} />
                  
                  {/* Active Line */}
                  <div style={{ 
                    position: "absolute", 
                    top: "14px", 
                    left: "12.5%", 
                    width: `${currentStageIndex * 25}%`, 
                    height: "4px", 
                    background: "#FFDE58", 
                    zIndex: 1,
                    transition: "width 0.3s ease" 
                  }} />

                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                    {[
                      { key: 'order', label: 'Order', icon: <ShoppingCartOutlined /> },
                      { key: 'printing', label: 'Printing', icon: <PrinterOutlined /> },
                      { key: 'dispatch', label: 'Dispatch', icon: <CarOutlined /> },
                      { key: 'delivered', label: 'Delivered', icon: <EnvironmentOutlined /> }
                    ].map((stage, sIdx) => {
                      const isActive = sIdx <= currentStageIndex;
                      const isCurrent = sIdx === currentStageIndex;

                      return (
                        <div key={stage.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "25%" }}>
                          <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: isActive ? "#FFDE58" : "#1c1c1c",
                            border: `3px solid ${isActive ? "#FFDE58" : "#555"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isActive ? "#000" : "#555",
                            fontSize: "16px",
                            boxShadow: isCurrent ? "0 0 15px 5px rgba(255, 222, 88, 0.4)" : "none",
                            transition: "all 0.3s ease"
                          }}>
                            {stage.icon}
                          </div>
                          <Text style={{ fontSize: "11px", color: isActive ? "#fff" : "#888", marginTop: "8px", fontWeight: isActive ? 600 : 400 }}>
                            {stage.label}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
