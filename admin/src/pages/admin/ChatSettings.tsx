import { useState, useEffect } from 'react';
import {
  Card,
  Switch,
  Select,
  Typography,
  Space,
  Button,
  message,
  Spin,
  Divider,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { apiClient } from '@/providers/api-client';

const { Title, Text } = Typography;

export const ChatSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFileSendingEnabled, setIsFileSendingEnabled] = useState(true);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/chat/settings');
      setIsFileSendingEnabled(res.data.isFileSendingEnabled ?? true);
      setFilteredWords(res.data.filteredWords ?? []);
    } catch (err) {
      message.error('Failed to load chat settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.patch('/admin/chat/settings', {
        isFileSendingEnabled,
        filteredWords,
      });
      message.success('Chat settings saved successfully');
    } catch (err) {
      message.error('Failed to save chat settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Chat Moderation Settings</Title>}
      bordered={false}
      style={{ maxWidth: 800, margin: '0 auto' }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Configure moderation rules for chat conversations between Clients and Suppliers.
        These rules do not apply to Admin support threads.
      </Text>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={5}>File Attachments</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Switch
              checked={isFileSendingEnabled}
              onChange={setIsFileSendingEnabled}
            />
            <Text>Allow Clients and Suppliers to send file attachments</Text>
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <Title level={5}>Word Filter</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Enter words that should be blocked. If a message contains any of these words, it will be rejected.
            Press Enter to add a word.
          </Text>
          <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder="e.g. price, cost, payment"
            value={filteredWords}
            onChange={setFilteredWords}
            open={false}
          />
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            Save Settings
          </Button>
        </div>
      </Space>
    </Card>
  );
};
