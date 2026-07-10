import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Divider,
  Input,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import {
  enrollUser,
  getBetaUsers,
  getSettings,
  resetOrderLimit,
  searchBetaMembers,
  setBetaSurveyExempt,
  unenrollUser,
  updateSettings,
} from '@/services/betaModeApi';
import type {
  BetaMemberRow,
  BetaModeSettings,
} from '@/services/betaModeApi';
import { apiClient } from '@/providers/api-client';
import { formatDate } from '@/utils/format';

const { Text, Title } = Typography;

const BRAND = '#FFD700';

export function betaModeConfirmation(checked: boolean) {
  return checked
    ? {
        title: 'Enable Beta Mode?',
        content:
          'New customer accounts are auto-enrolled in order and receive a one-time 100 GRID Credits grant. Beta checkout accepts GRID Credits only. After delivery, the mandatory 14-question feedback survey is shown; completed beta accounts are held from login until beta mode is disabled. Enrollment and credit history is retained.',
        okText: 'Enable',
        okButtonProps: { danger: false },
      }
    : {
        title: 'Disable Beta Mode?',
        content:
          'Disabling beta mode immediately restores held beta accounts. Existing enrollment, rank, credit-grant, order, and feedback history is retained; beta auto-enrollment and credits-only checkout stop while beta mode is disabled.',
        okText: 'Disable',
        okButtonProps: { danger: true },
      };
}

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
}

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
    paddingBottom: 48,
  },
  card: {
    background: '#141414',
    border: '1px solid #2E2E2E',
    borderRadius: 12,
    padding: 24,
  },
};

export function BetaModePage() {
  const { message, modal } = App.useApp();

  const [settings, setSettings] = useState<BetaModeSettings | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  // ── Members table state (server-side search + pagination) ──
  const [rows, setRows] = useState<BetaMemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // ── Enroll modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set());
  const [usersLoading, setUsersLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchPage = async () => {
    setTableLoading(true);
    try {
      const res = await searchBetaMembers({
        search: debouncedSearch || undefined,
        page,
        limit,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch {
      void message.error('Failed to load beta members.');
    } finally {
      setTableLoading(false);
    }
  };

  // Initial load.
  useEffect(() => {
    const load = async () => {
      try {
        const [s] = await Promise.all([getSettings(), fetchPage()]);
        setSettings(s);
      } catch {
        void message.error('Failed to load beta mode data.');
      } finally {
        setPageLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on search/page change.
  useEffect(() => {
    if (pageLoading) return;
    void fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  const doToggleSettings = async (checked: boolean) => {
    const prev = settings;
    setSettings((s) => (s ? { ...s, isEnabled: checked } : s));
    setToggleLoading(true);
    try {
      const updated = await updateSettings(checked);
      setSettings(updated);
    } catch {
      setSettings(prev);
      void message.error('Failed to update beta mode.');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleSettingsToggle = (checked: boolean) => {
    modal.confirm({
      ...betaModeConfirmation(checked),
      onOk: () => doToggleSettings(checked),
    });
  };

  const toggleExempt = async (row: BetaMemberRow) => {
    const next = !row.isBetaSurveyExempt;

    if (next) {
      const ok = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: 'Allow re-login after TAM survey?',
          content: (
            <div>
              <p style={{ margin: 0 }}>
                <strong>{row.fullName ?? row.email}</strong> will be allowed to
                log back in even when beta mode is on and they have pending
                survey holds.
              </p>
              <p style={{ marginTop: 12, color: '#999' }}>
                Default: beta members are signed out after submitting the
                post-delivery TAM survey and can't sign back in until the next
                requirement clears. This override lifts that lock.
              </p>
            </div>
          ),
          okText: 'Allow re-login',
          cancelText: 'Cancel',
          okButtonProps: {
            style: { background: BRAND, color: '#111', borderColor: BRAND },
          },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!ok) return;
    }

    setBusyId(row.id);
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id ? { ...r, isBetaSurveyExempt: next } : r,
      ),
    );
    try {
      await setBetaSurveyExempt(row.id, next);
      void message.success(
        next
          ? `${row.fullName ?? row.email} can now re-login`
          : `Default lock restored for ${row.fullName ?? row.email}`,
      );
    } catch {
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id ? { ...r, isBetaSurveyExempt: !next } : r,
        ),
      );
      void message.error('Could not update. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnenroll = async (userId: number) => {
    try {
      await unenrollUser(userId);
      void fetchPage();
    } catch {
      void message.error('Failed to remove user from beta.');
    }
  };

  const handleResetOrderLimit = (row: BetaMemberRow) => {
    modal.confirm({
      title: 'Reset beta order limit?',
      content: (
        <span>
          This re-enrolls <strong>{row.email}</strong> as a beta tester at the
          current time. They&apos;ll be able to place one new order during the
          beta program. Note: their beta rank will move to the latest rank as a
          side effect.
        </span>
      ),
      okText: 'Reset',
      cancelText: 'Cancel',
      onOk: async () => {
        setBusyId(row.id);
        try {
          await resetOrderLimit(row.id);
          await fetchPage();
          void message.success(`Order limit reset for ${row.email}`);
        } catch {
          void message.error('Failed to reset order limit.');
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const openEnrollModal = async () => {
    setModalOpen(true);
    setModalSearch('');
    setSelectedUser(null);
    setUsersLoading(true);
    try {
      const [users, enrolled] = await Promise.all([
        apiClient.get<AdminUser[]>('/admin/users'),
        getBetaUsers(),
      ]);
      setAllUsers(users.data);
      setEnrolledIds(new Set(enrolled.map((u) => u.id)));
    } catch {
      void message.error('Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalSearch('');
    setSelectedUser(null);
  };

  const handleEnroll = async () => {
    if (!selectedUser) return;
    setEnrolling(true);
    try {
      await enrollUser(selectedUser.id);
      closeModal();
      void fetchPage();
    } catch {
      void message.error('Failed to enroll user.');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredModalUsers = allUsers.filter((u) => {
    const q = modalSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q)
    );
  });

  const columns = useMemo(
    () => [
      {
        title: 'Member',
        key: 'member',
        render: (_: unknown, row: BetaMemberRow) => (
          <div>
            <Text style={{ color: '#E0E0E0', fontSize: 13 }}>{row.email}</Text>
            {row.fullName ? (
              <div>
                <Text style={{ color: '#777', fontSize: 12 }}>
                  {row.fullName}
                </Text>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: 'Enrolled',
        dataIndex: 'betaEnrolledAt',
        key: 'betaEnrolledAt',
        width: 130,
        render: (date: string | null) => (
          <Text style={{ color: '#777', fontSize: 12 }}>
            {date ? formatDate(date) : '—'}
          </Text>
        ),
      },
      {
        title: 'Credits',
        dataIndex: 'betaCreditsGranted',
        key: 'betaCreditsGranted',
        width: 100,
        render: (granted: boolean) =>
          granted ? (
            <Tag
              style={{
                background: '#0D2A0D',
                border: '1px solid #2E7D32',
                color: '#66BB6A',
                margin: 0,
                fontSize: 11,
              }}
            >
              Granted
            </Tag>
          ) : (
            <Tag
              style={{
                background: '#1A1A1A',
                border: '1px solid #2E2E2E',
                color: '#555',
                margin: 0,
                fontSize: 11,
              }}
            >
              —
            </Tag>
          ),
      },
      {
        title: 'Pending survey',
        dataIndex: 'pendingSurveyCount',
        key: 'pendingSurveyCount',
        width: 130,
        render: (count: number) =>
          count > 0 ? (
            <Tag
              style={{
                background: '#3a2f0b',
                border: `1px solid ${BRAND}55`,
                color: BRAND,
                margin: 0,
                fontSize: 11,
              }}
            >
              {count} pending
            </Tag>
          ) : (
            <Tag
              style={{
                background: '#0F2A0F',
                border: '1px solid #2E4A2E',
                color: '#66BB6A',
                margin: 0,
                fontSize: 11,
              }}
            >
              clear
            </Tag>
          ),
      },
      {
        title: (
          <span>
            Re-login allowed{' '}
            <Tooltip title="When ON, this member skips the post-survey lockout and can sign in repeatedly even with pending TAM holds.">
              <span
                style={{ color: '#666', cursor: 'help', fontSize: 11 }}
              >
                (?)
              </span>
            </Tooltip>
          </span>
        ),
        key: 'isBetaSurveyExempt',
        width: 150,
        render: (_: unknown, row: BetaMemberRow) => (
          <Switch
            size="small"
            checked={row.isBetaSurveyExempt}
            loading={busyId === row.id}
            onChange={() => toggleExempt(row)}
            checkedChildren={<ThunderboltFilled />}
            style={
              row.isBetaSurveyExempt ? { background: BRAND } : undefined
            }
          />
        ),
      },
      {
        title: 'Order Limit',
        key: 'orderLimit',
        width: 120,
        render: (_: unknown, row: BetaMemberRow) => (
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={busyId === row.id}
            onClick={() => handleResetOrderLimit(row)}
            style={{
              background: '#1A1A1A',
              borderColor: '#3A3A1A',
              color: '#F5C842',
              fontSize: 12,
            }}
          >
            Reset
          </Button>
        ),
      },
      {
        title: '',
        key: 'action',
        width: 110,
        render: (_: unknown, row: BetaMemberRow) => (
          <Popconfirm
            title="Remove from beta?"
            description="This user will lose beta access."
            onConfirm={() => void handleUnenroll(row.id)}
            okText="Remove"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
          >
            <Button
              size="small"
              danger
              style={{
                background: '#1A1A1A',
                borderColor: '#3A1A1A',
                color: '#EF5350',
                fontSize: 12,
              }}
            >
              Remove
            </Button>
          </Popconfirm>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId],
  );

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* ── Global Toggle ──────────────────────────────────────────── */}
      <div style={S.card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <Title
              level={5}
              style={{
                color: '#F0F0F0',
                margin: 0,
                marginBottom: 4,
                fontWeight: 700,
              }}
            >
              Beta Mode
            </Title>
            <Text style={{ color: '#666', fontSize: 13 }}>
              Auto-enrolls new customers in rank order, grants one-time 100
              GRID Credits, and limits beta checkout to GRID Credits. Delivery
              completion requires the 14-question feedback survey and then
              holds completed accounts until beta mode is disabled. Disabling
              restores access immediately while retaining enrollment, credit,
              order, and feedback history.
            </Text>
          </div>
          <Switch
            aria-label="Beta mode"
            checked={settings?.isEnabled ?? false}
            onChange={(checked) => handleSettingsToggle(checked)}
            loading={toggleLoading}
            style={
              settings?.isEnabled ? { backgroundColor: BRAND } : undefined
            }
          />
        </div>
      </div>

      {/* ── Members: search + paginate + enroll + per-row actions ──── */}
      <div style={{ ...S.card, padding: 0 }}>
        <div
          style={{
            padding: '20px 24px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Title
              level={5}
              style={{ color: '#F0F0F0', margin: 0, fontWeight: 700 }}
            >
              Beta Members
            </Title>
            <Text style={{ color: '#666', fontSize: 12 }}>
              {total} total · toggle <strong>Re-login allowed</strong> to lift
              the post-survey lockout for a member.
            </Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void fetchPage()}
              loading={tableLoading}
            >
              Refresh
            </Button>
            <Button
              onClick={() => void openEnrollModal()}
              style={{
                borderColor: BRAND,
                color: BRAND,
                background: 'transparent',
                fontWeight: 600,
              }}
            >
              Enroll User
            </Button>
          </Space>
        </div>

        <div style={{ padding: '16px 24px 0' }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#666' }} />}
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#0F0F0F',
              borderColor: '#2E2E2E',
              color: '#E0E0E0',
            }}
          />
        </div>

        <Divider style={{ borderColor: '#2E2E2E', margin: '16px 0 0' }} />

        <Table<BetaMemberRow>
          dataSource={rows}
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          pagination={false}
          style={{ background: '#141414' }}
          locale={{
            emptyText: (
              <Text style={{ color: '#444' }}>
                {debouncedSearch
                  ? 'No beta members match that search.'
                  : 'No beta members enrolled yet.'}
              </Text>
            ),
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 16,
            borderTop: '1px solid #2E2E2E',
          }}
        >
          <Pagination
            current={page}
            pageSize={limit}
            total={total}
            showSizeChanger={false}
            onChange={(p) => setPage(p)}
            showTotal={(t, range) => (
              <Text
                style={{ color: '#666', fontSize: 12, marginRight: 12 }}
              >
                {range[0]}–{range[1]} of {t}
              </Text>
            )}
          />
        </div>
      </div>

      {/* ── Enroll Modal ───────────────────────────────────────────── */}
      <Modal
        title={
          <Text style={{ color: '#F0F0F0', fontWeight: 700 }}>Enroll User</Text>
        }
        open={modalOpen}
        onCancel={closeModal}
        footer={
          <Space>
            <Button onClick={closeModal}>Cancel</Button>
            <Button
              type="primary"
              disabled={!selectedUser}
              loading={enrolling}
              onClick={() => void handleEnroll()}
              style={{
                background: BRAND,
                borderColor: BRAND,
                color: '#141414',
                fontWeight: 700,
              }}
            >
              Enroll + Grant 100 Credits
            </Button>
          </Space>
        }
        styles={{
          content: { background: '#141414', border: '1px solid #2E2E2E' },
          header: { background: '#141414', borderBottom: '1px solid #2E2E2E' },
          footer: { background: '#141414', borderTop: '1px solid #2E2E2E' },
          mask: { backdropFilter: 'blur(2px)' },
        }}
      >
        <Input
          placeholder="Search by email or name"
          value={modalSearch}
          onChange={(e) => setModalSearch(e.target.value)}
          style={{
            marginBottom: 12,
            background: '#0F0F0F',
            borderColor: '#2E2E2E',
            color: '#E0E0E0',
          }}
          allowClear
        />
        {usersLoading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: 32,
            }}
          >
            <Spin />
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <List<AdminUser>
              dataSource={filteredModalUsers}
              renderItem={(user) => {
                const isSelected = selectedUser?.id === user.id;
                const alreadyEnrolled = enrolledIds.has(user.id);
                return (
                  <List.Item
                    onClick={() => {
                      if (!alreadyEnrolled) setSelectedUser(user);
                    }}
                    style={{
                      cursor: alreadyEnrolled ? 'not-allowed' : 'pointer',
                      padding: '10px 12px',
                      borderLeft: isSelected
                        ? `3px solid ${BRAND}`
                        : '3px solid transparent',
                      background: isSelected
                        ? 'rgba(255, 215, 0, 0.06)'
                        : 'transparent',
                      opacity: alreadyEnrolled ? 0.45 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div>
                      <Text
                        style={{
                          color: '#E0E0E0',
                          fontSize: 13,
                          display: 'block',
                        }}
                      >
                        {user.email}
                        {alreadyEnrolled && (
                          <Tag
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              background: '#1A2A1A',
                              borderColor: '#2E4A2E',
                              color: '#66BB6A',
                            }}
                          >
                            enrolled
                          </Tag>
                        )}
                      </Text>
                      {user.full_name && (
                        <Text style={{ color: '#666', fontSize: 12 }}>
                          {user.full_name}
                        </Text>
                      )}
                    </div>
                  </List.Item>
                );
              }}
              locale={{
                emptyText: (
                  <Text style={{ color: '#444' }}>No users found</Text>
                ),
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
