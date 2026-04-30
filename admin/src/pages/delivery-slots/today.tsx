import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App,
  Button,
  DatePicker,
  Empty,
  Spin,
  Switch,
  Tooltip,
  theme,
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
const BRAND_BG = "rgba(255,222,88,0.10)";
const BRAND_RING = "rgba(255,222,88,0.35)";

function format12h(hms: string) {
  const [hStr, m] = hms.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${period}`;
}

function timeRange(start: string, end: string) {
  return `${format12h(start)} – ${format12h(end)}`;
}

function initials(name: string | null, email: string | null): string {
  const src = name?.trim() || email?.split("@")[0] || "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function colorFromString(seed: string): string {
  // Deterministic pleasant hue for avatar bg
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 38%)`;
}

export function DeliverySlotsTodayPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<TodaySnapshot>({
    templates: [],
    bookings: [],
  });
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({});
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

  // Fetch booking counts for the surrounding week (the day pill strip)
  const refreshWeekCounts = async (anchor: string) => {
    const days = Array.from({ length: 7 }, (_, i) =>
      dayjs(anchor).startOf("week").add(i, "day").format("YYYY-MM-DD"),
    );
    try {
      const results = await Promise.all(
        days.map((d) =>
          apiClient
            .get<TodaySnapshot>(`/admin/delivery-slots/today?date=${d}`)
            .then((r) => [d, r.data?.bookings?.length ?? 0] as const)
            .catch(() => [d, 0] as const),
        ),
      );
      const map: Record<string, number> = {};
      for (const [d, count] of results) map[d] = count;
      setWeekCounts(map);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh(selectedDate);
    refreshWeekCounts(selectedDate);
    const socket = connectDeliverySlotsWS(selectedDate);
    socket.on("slot-updated", () => {
      refresh(selectedDate);
      refreshWeekCounts(selectedDate);
    });
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

  const stats = useMemo(() => {
    const totalCap = snapshot.templates.reduce((s, t) => s + t.capacity, 0);
    const totalBooked = enriched.length;
    const fullSlots = snapshot.templates.filter(
      (t) => enriched.filter((b) => b.slotTemplateId === t.id).length >= t.capacity,
    ).length;
    const expressCount = enriched.filter((b) => b.priority).length;
    return {
      totalCap,
      totalBooked,
      pct: totalCap === 0 ? 0 : Math.round((totalBooked / totalCap) * 100),
      fullSlots,
      expressCount,
      windows: snapshot.templates.length,
    };
  }, [snapshot, enriched]);

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
                will jump to the top of this slot. Other ranked bookings push
                down.
              </p>
              <p style={{ marginTop: 12, color: "#999" }}>
                Express does not increase capacity — once a slot is full, even
                Express jobs wait until the next batch.
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
        <Spin size="large" />
      </div>
    );
  }

  const dayLabel = isToday
    ? "Today's Slots"
    : selectedDate === dayjs().add(1, "day").format("YYYY-MM-DD")
      ? "Tomorrow's Slots"
      : `Slots — ${dayjs(selectedDate).format("ddd, MMM D")}`;

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    dayjs(selectedDate).startOf("week").add(i, "day"),
  );

  const headerControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Button icon={<LeftOutlined />} onClick={() => shiftDay(-1)} title="Previous day" />
      <DatePicker
        value={dayjs(selectedDate)}
        onChange={(d: Dayjs | null) => d && setSelectedDate(d.format("YYYY-MM-DD"))}
        suffixIcon={<CalendarOutlined />}
        allowClear={false}
        style={{ width: 160 }}
      />
      <Button icon={<RightOutlined />} onClick={() => shiftDay(1)} title="Next day" />
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
          refreshWeekCounts(selectedDate);
        }}
      >
        Refresh
      </Button>
    </div>
  );

  // ── Header with stats + week pills ─────────────────────────────────────
  const headerBlock = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: -0.3 }}>
            {dayLabel}
          </h2>
          <div style={{ color: token.colorTextSecondary, fontSize: 13, marginTop: 4 }}>
            {dayjs(selectedDate).format("dddd, MMMM D, YYYY")}
          </div>
        </div>
        {headerControls}
      </div>

      {/* Week pill navigator */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginBottom: 18,
        }}
      >
        {weekDays.map((d) => {
          const iso = d.format("YYYY-MM-DD");
          const active = iso === selectedDate;
          const isTodayPill = iso === todayIso;
          const count = weekCounts[iso] ?? 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              style={{
                background: active ? BRAND : token.colorBgElevated,
                color: active ? "#111" : token.colorText,
                border: `1px solid ${
                  active
                    ? BRAND
                    : isTodayPill
                      ? BRAND_RING
                      : token.colorBorder
                }`,
                borderRadius: 10,
                padding: "8px 4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  fontWeight: 800,
                  color: active ? "#111" : token.colorTextSecondary,
                  textTransform: "uppercase",
                }}
              >
                {d.format("ddd")}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginTop: 2,
                  color: active ? "#111" : token.colorText,
                }}
              >
                {d.format("D")}
              </div>
              {count > 0 && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? "#111" : BRAND,
                  }}
                >
                  {count} booking{count === 1 ? "" : "s"}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      {snapshot.templates.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <_StatCard
            token={token}
            label="Capacity used"
            value={`${stats.pct}%`}
            sub={`${stats.totalBooked} of ${stats.totalCap}`}
            accent
          />
          <_StatCard
            token={token}
            label="Bookings"
            value={stats.totalBooked}
            sub={`across ${stats.windows} window${stats.windows === 1 ? "" : "s"}`}
          />
          <_StatCard
            token={token}
            label="Express jobs"
            value={stats.expressCount}
            sub={stats.expressCount > 0 ? "priority drop" : "none queued"}
          />
          <_StatCard
            token={token}
            label="Full slots"
            value={stats.fullSlots}
            sub={stats.fullSlots > 0 ? "no spare seats" : "all open"}
            danger={stats.fullSlots > 0}
          />
        </div>
      )}
    </>
  );

  if (snapshot.templates.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        {headerBlock}
        <Empty
          description={`No slot templates configured for ${dayjs(selectedDate).format("dddd")}`}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {headerBlock}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
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
          const used = slotBookings.length;
          const isFull = used >= t.capacity;
          const expressCount = slotBookings.filter((b) => b.priority).length;
          const fillRatio = used / t.capacity;
          const ringColor = isFull
            ? "#FF4D4F"
            : fillRatio >= 0.7
              ? "#FFB020"
              : "#52C41A";
          const ringBg = isFull
            ? "rgba(255,77,79,0.12)"
            : fillRatio >= 0.7
              ? "rgba(255,176,32,0.10)"
              : "rgba(82,196,26,0.10)";

          return (
            <div
              key={t.id}
              style={{
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Slot header */}
              <div
                style={{
                  padding: "14px 18px 12px",
                  borderBottom: `1px solid ${token.colorBorder}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                {/* Capacity ring */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: ringBg,
                    border: `2px solid ${ringColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ textAlign: "center", lineHeight: 1.1 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: ringColor,
                      }}
                    >
                      {used}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: token.colorTextSecondary,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      / {t.capacity}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: -0.2,
                      color: token.colorText,
                    }}
                  >
                    {timeRange(t.startTime, t.endTime)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <_Chip color={ringColor} label={isFull ? "FULL" : `${Math.round(fillRatio * 100)}% full`} />
                    {expressCount > 0 && (
                      <_Chip
                        color={BRAND}
                        icon={<ThunderboltFilled style={{ fontSize: 10 }} />}
                        label={`${expressCount} EXPRESS`}
                      />
                    )}
                    {used === 0 && <_Chip color="#888" label="OPEN" />}
                  </div>
                </div>
              </div>

              {/* Capacity dot row — visual at-a-glance */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  padding: "10px 18px",
                  borderBottom: `1px solid ${token.colorBorder}`,
                }}
              >
                {Array.from({ length: t.capacity }).map((_, i) => {
                  const filled = i < used;
                  const isExpressDot = filled && i < expressCount;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: filled
                          ? isExpressDot
                            ? BRAND
                            : ringColor
                          : "transparent",
                        border: `1.5px solid ${filled ? (isExpressDot ? BRAND : ringColor) : token.colorBorder}`,
                      }}
                    />
                  );
                })}
              </div>

              {/* Bookings */}
              {slotBookings.length === 0 ? (
                <div style={{ padding: "24px 18px", textAlign: "center" }}>
                  <div
                    style={{
                      color: token.colorTextTertiary,
                      fontSize: 13,
                    }}
                  >
                    No bookings yet — slot is wide open.
                  </div>
                </div>
              ) : (
                <div>
                  {slotBookings.map((b, idx) => {
                    const isExpress = b.priority;
                    const isFirst = idx === 0;
                    const busy = busyBooking === b.id;
                    const customer =
                      b.customerName ?? b.customerEmail ?? `User #${b.batchOrderId}`;
                    const initialsStr = initials(b.customerName, b.customerEmail);
                    const avatarBg = isExpress
                      ? BRAND
                      : colorFromString(customer);
                    const avatarFg = isExpress ? "#111" : "#fff";

                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button")) return;
                          if (b.batchOrderId != null) {
                            navigate(`/orders/show/${b.batchOrderId}`);
                          }
                        }}
                        style={{
                          padding: "12px 18px",
                          borderTop: `1px solid ${token.colorBorder}`,
                          background: isExpress ? BRAND_BG : "transparent",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isExpress
                            ? "rgba(255,222,88,0.16)"
                            : "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isExpress
                            ? BRAND_BG
                            : "transparent";
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
                            width: 22,
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            color: isExpress ? BRAND : token.colorTextSecondary,
                            letterSpacing: "0.03em",
                          }}
                        >
                          #{idx + 1}
                        </div>
                        {/* Avatar */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: avatarBg,
                            color: avatarFg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: "0.03em",
                            flexShrink: 0,
                            boxShadow: isExpress
                              ? "0 0 0 2px rgba(255,222,88,0.30)"
                              : "none",
                          }}
                        >
                          {initialsStr}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              color: token.colorText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {customer}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: token.colorTextSecondary,
                              marginTop: 2,
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontFamily:
                                  "'SFMono-Regular', Consolas, monospace",
                                background: token.colorBgContainer,
                                padding: "1px 6px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {b.batchRef ?? `BATCH #${b.batchOrderId}`}
                            </span>
                            <span style={{ fontSize: 10 }}>
                              {dayjs(b.bookedAt).format("h:mm A")}
                            </span>
                            {b.priorityRank != null && (
                              <span style={{ fontSize: 10, color: BRAND, fontWeight: 700 }}>
                                rank {b.priorityRank}
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
                            style={isExpress ? { background: BRAND } : undefined}
                          />
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tiny helpers ────────────────────────────────────────────────────────────

function _StatCard({
  token,
  label,
  value,
  sub,
  accent,
  danger,
}: {
  token: any;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const valueColor = danger ? "#FF4D4F" : accent ? BRAND : token.colorText;
  return (
    <div
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${
          danger
            ? "rgba(255,77,79,0.30)"
            : accent
              ? BRAND_RING
              : token.colorBorder
        }`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: token.colorTextSecondary,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: valueColor,
            lineHeight: 1,
            letterSpacing: -0.5,
          }}
        >
          {value}
        </span>
        {sub && (
          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function _Chip({
  color,
  label,
  icon,
}: {
  color: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: `${color}1F`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 99,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
      }}
    >
      {icon}
      {label}
    </span>
  );
}
