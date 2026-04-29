import { useEffect, useState } from "react";
import { Card, Progress, Tag, Spin, App, Empty } from "antd";
import { apiClient } from "@/providers/api-client";
import {
  connectDeliverySlotsWS,
  disconnectDeliverySlotsWS,
} from "@/providers/delivery-slot-ws";
import type {
  DeliverySlotTemplate,
  DeliverySlotBooking,
} from "@/types/delivery-slot";

interface TodaySnapshot {
  templates: DeliverySlotTemplate[];
  bookings: DeliverySlotBooking[];
}

export function DeliverySlotsTodayPage() {
  const { message } = App.useApp();
  const [snapshot, setSnapshot] = useState<TodaySnapshot>({
    templates: [],
    bookings: [],
  });
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<TodaySnapshot>(
        `/admin/delivery-slots/today?date=${today}`,
      );
      setSnapshot(res.data ?? { templates: [], bookings: [] });
    } catch {
      message.error("Failed to load today's bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const socket = connectDeliverySlotsWS(today);
    socket.on("slot-updated", () => refresh());
    return () => {
      socket.off("slot-updated");
      disconnectDeliverySlotsWS();
    };
  }, []);

  if (loading) {
    return <Spin />;
  }

  if (snapshot.templates.length === 0) {
    return <Empty description="No slot templates configured for today" />;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Today's Slots — {today}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {snapshot.templates.map((t) => {
          const bookings = snapshot.bookings.filter(
            (b) => b.slotTemplateId === t.id,
          );
          const percent = (bookings.length / t.capacity) * 100;
          return (
            <Card
              key={t.id}
              title={`${t.startTime} – ${t.endTime}`}
              extra={
                <Tag>
                  {bookings.length}/{t.capacity}
                </Tag>
              }
            >
              <Progress
                percent={percent}
                status={bookings.length >= t.capacity ? "exception" : "active"}
                size="small"
                style={{ marginBottom: 12 }}
              />
              {bookings.length === 0 ? (
                <Empty
                  description="No bookings"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                bookings.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: 8,
                      borderBottom: "1px solid #2A2A2A",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Batch #{b.batchOrderId}</span>
                    {b.priority && <Tag color="gold">Priority</Tag>}
                  </div>
                ))
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
