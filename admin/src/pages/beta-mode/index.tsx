import { useState, useEffect } from 'react';
import {
  Typography, Button, Switch, Table, Tag, Modal, Input, List, Spin,
  Popconfirm, App, Space, Divider,
} from 'antd';
import {
  getSettings, updateSettings, getBetaUsers, enrollUser, unenrollUser,
} from '@/services/betaModeApi';
import type { BetaModeSettings, BetaUserItem } from '@/services/betaModeApi';
import { apiClient } from '@/providers/api-client';
import { formatDate } from '@/utils/format';

const { Text, Title } = Typography;

interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
}

const S = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: 24, paddingBottom: 48 },
  card: {
    background: '#141414',
    border: '1px solid #2E2E2E',
    borderRadius: 12,
    padding: 24,
  },
};

export function BetaModePage() {
  const { message } = App.useApp();

  const [settings, setSettings] = useState<BetaModeSettings | null>(null);
  const [betaUsers, setBetaUsers] = useState<BetaUserItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const fetchBetaUsers = async () => {
    setTableLoading(true);
    try {
      const users = await getBetaUsers();
      setBetaUsers(users);
    } catch {
      void message.error('Failed to load beta members');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [s, u] = await Promise.all([getSettings(), getBetaUsers()]);
        setSettings(s);
        setBetaUsers(u);
      } catch {
        void message.error('Failed to load beta mode data');
      } finally {
        setPageLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async (checked: boolean) => {
    const prev = settings;
    setSettings((s) => (s ? { ...s, isEnabled: checked } : s));
    setToggleLoading(true);
    try {
      const updated = await updateSettings(checked);
      setSettings(updated);
    } catch {
      setSettings(prev);
      void message.error('Failed to update beta mode');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleUnenroll = async (userId: number) => {
    try {
      await unenrollUser(userId);
      void fetchBetaUsers();
    } catch {
      void message.error('Failed to remove user from beta');
    }
  };

  const openModal = async () => {
    setModalOpen(true);
    setSearch('');
    setSelectedUser(null);
    setUsersLoading(true);
    try {
      const res = await apiClient.get<AdminUser[]>('/admin/users');
      setAllUsers(res.data);
    } catch {
      void message.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSearch('');
    setSelectedUser(null);
  };

  const handleEnroll = async () => {
    if (!selectedUser) return;
    setEnrolling(true);
    try {
      await enrollUser(selectedUser.id);
      closeModal();
      void fetchBetaUsers();
    } catch {
      void message.error('Failed to enroll user');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q)
    );
  });

  const enrolledIds = new Set(betaUsers.map((u) => u.id));

  const columns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 48,
      render: (rank: number) => (
        <Text style={{ color: '#555', fontSize: 12 }}>{rank}</Text>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <Text style={{ color: '#E0E0E0', fontSize: 13 }}>{email}</Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string | null) => (
        <Text style={{ color: name ? '#A0A0A0' : '#444', fontSize: 13 }}>
          {name ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Enrolled',
      dataIndex: 'betaEnrolledAt',
      key: 'betaEnrolledAt',
      render: (date: string) => (
        <Text style={{ color: '#777', fontSize: 12 }}>{formatDate(date)}</Text>
      ),
    },
    {
      title: 'Credits',
      dataIndex: 'betaCreditsGranted',
      key: 'betaCreditsGranted',
      render: (granted: boolean) =>
        granted ? (
          <Tag
            style={{
              background: '#0D2A0D',
              border: '1px solid #2E7D32',
              color: '#66BB6A',
              borderRadius: 6,
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
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            —
          </Tag>
        ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_: unknown, record: BetaUserItem) => (
        <Popconfirm
          title="Remove from beta?"
          description="This user will lose beta access."
          onConfirm={() => void handleUnenroll(record.id)}
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
  ];

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* ── Global Toggle Card ─────────────────────────────────────── */}
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
              style={{ color: '#F0F0F0', margin: 0, marginBottom: 4, fontWeight: 700 }}
            >
              Beta Mode
            </Title>
            <Text style={{ color: '#666', fontSize: 13 }}>
              Controls visibility of beta indicators on customer devices
            </Text>
          </div>
          <Switch
            checked={settings?.isEnabled ?? false}
            onChange={(checked) => void handleToggle(checked)}
            loading={toggleLoading}
            style={settings?.isEnabled ? { backgroundColor: '#FFD700' } : undefined}
          />
        </div>
      </div>

      {/* ── Beta Users Table ───────────────────────────────────────── */}
      <div style={{ ...S.card, padding: 0 }}>
        <div
          style={{
            padding: '20px 24px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title
              level={5}
              style={{ color: '#F0F0F0', margin: 0, fontWeight: 700 }}
            >
              Beta Members
            </Title>
            <Text style={{ color: '#555', fontSize: 13 }}>
              {betaUsers.length} enrolled
            </Text>
          </div>
          <Button
            onClick={() => void openModal()}
            style={{
              borderColor: '#FFD700',
              color: '#FFD700',
              background: 'transparent',
              fontWeight: 600,
            }}
          >
            Enroll User
          </Button>
        </div>

        <Divider style={{ borderColor: '#2E2E2E', margin: '16px 0 0' }} />

        <Table<BetaUserItem>
          dataSource={betaUsers}
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          pagination={false}
          style={{ background: '#141414' }}
          locale={{
            emptyText: (
              <Text style={{ color: '#444' }}>No beta members yet</Text>
            ),
          }}
        />
      </div>

      {/* ── Enroll Modal ───────────────────────────────────────────── */}
      <Modal
        title={
          <Text style={{ color: '#F0F0F0', fontWeight: 700 }}>
            Enroll User
          </Text>
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
                background: '#FFD700',
                borderColor: '#FFD700',
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginBottom: 12,
            background: '#0F0F0F',
            borderColor: '#2E2E2E',
            color: '#E0E0E0',
          }}
          allowClear
        />
        {usersLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <List<AdminUser>
              dataSource={filteredUsers}
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
                        ? '3px solid #FFD700'
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
