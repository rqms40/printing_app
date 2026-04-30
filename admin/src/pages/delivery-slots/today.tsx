import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Progress,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import {
  ArrowUpOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { apiClient } from "@/providers/api-client";
import {
  connectDeliverySlotsWS,
  disconnectDeliverySlotsWS,
} from "@/providers/delivery-slot-ws";
import type {
  DeliverySlotTemplate,
  DeliverySlotBooking,
} from "@/types/delivery-slot";

interface RawRow {
  bo_id?: number | null;
  bo_batch_ref?: string | null;
  u_full_name?: string | null;
  u_email?: string | null;
}

interface TodaySnapshot {
  templates: DeliverySlotTemplate[];
  bookings: DeliverySlotBooking[];
  raw?: RawRow[];
}

interface EnrichedBooking extends DeliverySlotBooking {
  batchRef: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

const BRAND = "#FFDE58";
const BRAND_BG = "#3a2f0b";

function format12h(hms: string) {
  const [hStr, m] = hms.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${period}`;
}

export function DeliverySlotsTodayPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<TodaySnapshot>({
    templates: [],
    bookings: [],
  });
  const [loading, setLoading] = useState(true);
  const [busyBooking, setBusyBooking] = useState<number | null>(null);
  const todayIso = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const isToday = selectedDate === todayIso;

  const refresh = async (date: string = selectedDate) => {
    try {
      const res = await apiClient.get<TodaySnapshot>(
        `/admin/delivery-slots/today?date=${date}`,
      );
      setSnapshot(res.data ?? { templates: [], bookings: [] });
    } catch {
      message.error(`Failed to load bookings for ${date}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh(selectedDate);
    const socket = connectDeliverySlotsWS(selectedDate);
    socket.on("slot-updated", () => refresh(selectedDate));
    return () => {
      socket.off("slot-updated");
      disconnectDeliverySlotsWS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const shiftDay = (delta: number) => {
    setSelectedDate(dayjs(selectedDate).add(delta, "day").format("YYYY-MM-DD"));
  };

  // Enrich bookings with raw user/batch info from getRawAndEntities response.
  const enriched = useMemo<EnrichedBooking[]>(() => {
    const rawByIdx = snapshot.raw ?? [];
    return snapshot.bookings.map((b, i) => {
      const r = rawByIdx[i] ?? {};
      return {
        ...b,
        batchRef: r.bo_batch_ref ?? null,
        customerName: r.u_full_name ?? null,
        customerEmail: r.u_email ?? null,
      };
    });
  }, [snapshot]);

  const togglePriority = async (b: EnrichedBooking) => {
    const next = !b.priority;

    if (next) {
      const ok = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "Mark as Express?",
          content: (
            <div>
              <p style={{ margin: 0 }}>
                <strong>
                  {b.customerName ?? `Batch #${b.batchOrderId}`}
                </strong>{" "}
                will be moved to the top of this slot, and other ranked
                bookings will be pushed down.
              </p>
              <p style={{ marginTop: 12, color: "#999" }}>
                Express does not increase the slot's capacity — once a slot
                is full, even Express jobs wait until the next batch.
              </p>
            </div>
          ),
          okText: "Make Express",
          cancelText: "Cancel",
          okButtonProps: {
            style: { background: BRAND, color: "#111", borderColor: BRAND },
          },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!ok) return;
    }

    setBusyBooking(b.id);
    try {
      await apiClient.patch(`/admin/slot-bookings/${b.id}/priority`, {
        priority: next,
      });
      message.success(
        next
          ? `${b.customerName ?? `Batch #${b.batchOrderId}`} is now Express`
          : `Express removed from ${b.customerName ?? `Batch #${b.batchOrderId}`}`,
      );
      await refresh();
    } catch {
      message.error("Could not update priority. Try again.");
    } finally {
      setBusyBooking(null);
    }
  };

  const moveToTop = async (b: EnrichedBooking, sameSlot: EnrichedBooking[]) => {
    if (sameSlot[0]?.id === b.id) {
      message.info("Already at the top of this slot.");
      return;
    }
    const orderedIds = [b.id, ...sameSlot.filter((x) => x.id !== b.id).map((x) => x.id)];
    setBusyBooking(b.id);
    try {
      await apiClient.patch("/admin/slot-bookings/order", { orderedIds });
      message.success("Moved to top of slot");
      await refresh();
    } catch {
      message.error("Could not reorder. Try again.");
    } finally {
      setBusyBooking(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const dayLabel = isToday
    ? "Today's Slots"
    : selectedDate === dayjs().add(1, "day").format("YYYY-MM-DD")
      ? "Tomorrow's Slots"
      : `Slots — ${dayjs(selectedDate).format("ddd, MMM D")}`;

  const headerControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Button
        icon={<LeftOutlined />}
        onClick={() => shiftDay(-1)}
        title="Previous day"
      />
      <DatePicker
        value={dayjs(selectedDate)}
        onChange={(d: Dayjs | null) => {
          if (d) setSelectedDate(d.format("YYYY-MM-DD"));
        }}
        suffixIcon={<CalendarOutlined />}
        allowClear={false}
        style={{ width: 160 }}
      />
      <Button
        icon={<RightOutlined />}
        onClick={() => shiftDay(1)}
        title="Next day"
      />
      {!isToday && (
        <Button
          type="primary"
          ghost
          onClick={() => setSelectedDate(todayIso)}
          style={{ borderColor: BRAND, color: BRAND }}
        >
          Today
        </Button>
      )}
      <Button
        icon={<ReloadOutlined />}
        onClick={() => {
          setLoading(true);
          refresh(selectedDate);
        }}
      >
        Refresh
      </Button>
    </div>
  );

  if (snapshot.templates.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>{dayLabel}</h2>
            <div style={{ color: "#999", fontSize: 13, marginTop: 4 }}>
              {selectedDate}
            </div>
          </div>
          {headerControls}
        </div>
        <Empty
          description={`No slot templates configured for ${dayjs(selectedDate).format("dddd")}`}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{dayLabel}</h2>
          <div style={{ color: "#999", fontSize: 13, marginTop: 4 }}>
            {selectedDate} · {enriched.length} booking{enriched.length === 1 ? "" : "s"}{" "}
            across {snapshot.templates.length} window
            {snapshot.templates.length === 1 ? "" : "s"}
          </div>
        </div>
        {headerControls}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        {snapshot.templates.map((t) => {
          const slotBookings = enriched
            .filter((b) => b.slotTemplateId === t.id)
            .sort((a, b) => {
              const ar = a.priorityRank ?? Number.MAX_SAFE_INTEGER;
              const br = b.priorityRank ?? Number.MAX_SAFE_INTEGER;
              if (ar !== br) return ar - br;
              return a.bookedAt.localeCompare(b.bookedAt);
            });
          const percent = Math.round(
            (slotBookings.length / t.capacity) * 100,
          );
          const isFull = slotBookings.length >= t.capacity;
          const expressCount = slotBookings.filter((b) => b.priority).length;

          return (
            <Card
              key={t.id}
              title={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>
                    {format12h(t.startTime)} – {format12h(t.endTime)}
                  </span>
                  {expressCount > 0 && (
                    <Tag
                      icon={<ThunderboltFilled />}
                      style={{
                        background: BRAND_BG,
                        color: BRAND,
                        border: `1px solid ${BRAND}55`,
                        margin: 0,
                      }}
                    >
                      {expressCount} Express
                    </Tag>
                  )}
                </div>
              }
              extra={
                <Tag color={isFull ? "red" : "default"}>
                  {slotBookings.length} / {t.capacity}
                </Tag>
              }
              styles={{ body: { padding: 0 } }}
            >
              <div style={{ padding: "12px 16px 6px" }}>
                <Progress
                  percent={percent}
                  status={isFull ? "exception" : "active"}
                  strokeColor={isFull ? undefined : BRAND}
                  size="small"
                  showInfo={false}
                />
              </div>

              {slotBookings.length === 0 ? (
                <div style={{ padding: 24 }}>
                  <Empty
                    description="No bookings"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              ) : (
                <div>
                  {slotBookings.map((b, idx) => {
                    const isExpress = b.priority;
                    const isFirst = idx === 0;
                    const busy = busyBooking === b.id;
                    const customer =
                      b.customerName ?? b.customerEmail ?? `User #${b.batchOrderId}`;

                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          // Ignore clicks that originated on inner action buttons.
                          if ((e.target as HTMLElement).closest("button")) return;
                          if (b.batchOrderId != null) {
                            navigate(`/orders/show/${b.batchOrderId}`);
                          }
                        }}
                        style={{
                          padding: "12px 16px",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          background: isExpress ? BRAND_BG : "transparent",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          position: "relative",
                          cursor: "pointer",
                        }}
                        title="Open order detail"
                      >
                        {isExpress && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 3,
                              background: BRAND,
                            }}
                          />
                        )}
                        <div
                          style={{
                            width: 28,
                            textAlign: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: isExpress ? BRAND : "#888",
                          }}
                        >
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: "#fff",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {customer}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#888",
                              marginTop: 2,
                            }}
                          >
                            {b.batchRef ?? `Batch #${b.batchOrderId}`}
                            {b.priorityRank != null && (
                              <span style={{ marginLeft: 8 }}>
                                · rank {b.priorityRank}
                              </span>
                            )}
                          </div>
                        </div>
                        <Tooltip
                          title={
                            isFirst
                              ? "Already at top"
                              : "Move to top of this slot"
                          }
                        >
                          <Button
                            size="small"
                            type="text"
                            icon={<ArrowUpOutlined />}
                            disabled={isFirst || busy}
                            onClick={() => moveToTop(b, slotBookings)}
                          />
                        </Tooltip>
                        <Tooltip
                          title={
                            isExpress
                              ? "Remove Express"
                              : "Mark as Express (jumps to top)"
                          }
                        >
                          <Switch
                            size="small"
                            checked={isExpress}
                            loading={busy}
                            onChange={() => togglePriority(b)}
                            checkedChildren={<ThunderboltFilled />}
                            unCheckedChildren={<ThunderboltOutlined />}
                            style={
                              isExpress
                                ? { background: BRAND }
                                : undefined
                            }
                          />
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
