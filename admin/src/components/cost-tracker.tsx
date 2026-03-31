import React from 'react';
import { Card, Typography, List } from 'antd';
import { ClockCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { mockDeliveries } from '@/providers/mock-data';

const { Title, Text } = Typography;

export const CostTracker: React.FC = () => {
  const totalPayout = mockDeliveries.reduce((acc, curr) => acc + curr.earnings, 0);
  const pendingDeliveries = mockDeliveries.filter(d => ['Assigned', 'Accepted', 'Picked Up', 'On the Way'].includes(d.status));
  const recentEarnings = mockDeliveries.filter(d => d.earnings > 0).slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card
          style={{ background: '#1f1f1f', border: '1px solid #2E2E2E' }}
          styles={{ body: { padding: 16 } }}
        >
          <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <DollarOutlined /> Total Payouts
          </Text>
          <Title level={4} style={{ margin: 0, color: '#66BB6A' }}>₱{totalPayout.toFixed(2)}</Title>
        </Card>
        <Card
          style={{ background: '#1f1f1f', border: '1px solid #2E2E2E' }}
          styles={{ body: { padding: 16 } }}
        >
          <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ClockCircleOutlined /> Active Costs
          </Text>
          <Title level={4} style={{ margin: 0, color: '#FFCA28' }}>₱{(pendingDeliveries.length * 90).toFixed(2)}</Title>
        </Card>
      </div>

      {/* Log */}
      <Card title="Recent Earnings Log" size="small" style={{ background: '#141414', border: '1px solid #2E2E2E' }}>
        <List
          dataSource={recentEarnings}
          renderItem={item => (
            <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #2E2E2E' }}>
              <List.Item.Meta
                title={<span style={{ color: '#F0F0F0', fontSize: 13 }}>{item.order_id}</span>}
                description={<span style={{ color: '#808080', fontSize: 12 }}>{item.date}</span>}
              />
              <Text strong style={{ color: '#66BB6A', fontSize: 14 }}>+₱{item.earnings.toFixed(2)}</Text>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
