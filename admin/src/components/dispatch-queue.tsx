import React, { useState } from 'react';
import { Card, Button, List, Typography, Space, Badge } from 'antd';
import { UserAddOutlined, DropboxOutlined } from '@ant-design/icons';
import { mockOrders, mockDrivers } from '@/providers/mock-data';

const { Text } = Typography;

export const DispatchQueue: React.FC = () => {
  const readyOrders = mockOrders.filter(o => o.order_status === 'ready_for_dispatch');
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  
  // Available drivers only
  const availableDrivers = mockDrivers.filter(d => d.is_available);

  return (
    <Card 
      title="Dispatch Queue" 
      extra={<Badge count={`${readyOrders.length} Pending`} color="#FFDE58" style={{ color: '#1A1A0A', fontWeight: 'bold' }} />}
      style={{ background: "#141414", border: '1px solid #2E2E2E', height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { padding: 12, flex: 1, overflowY: 'auto', minHeight: '300px' } }}
    >
      <List
        dataSource={readyOrders}
        locale={{ emptyText: <Text type="secondary">No orders waiting for dispatch.</Text> }}
        renderItem={order => (
          <List.Item
            style={{ 
              background: '#1f1f1f', 
              borderRadius: 8, 
              marginBottom: 12, 
              padding: 12, 
              border: '1px solid #2E2E2E',
              display: 'block'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <Text strong style={{ display: 'block', color: '#F0F0F0' }}>{order.order_id}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>Delivery Fee: ₱{order.delivery_fee.toFixed(2)}</Text>
              </div>
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '6px 8px', borderRadius: 8, alignSelf: 'flex-start' }}>
                <DropboxOutlined style={{ color: '#22c55e', fontSize: 18 }} />
              </div>
            </div>

            {assigningOrderId === order.order_id ? (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Select Rider:</Text>
                <List
                  size="small"
                  dataSource={availableDrivers}
                  renderItem={driver => (
                    <List.Item
                      style={{ cursor: 'pointer', background: '#2E2E2E', borderRadius: 6, marginBottom: 4, border: 'none' }}
                      onClick={() => setAssigningOrderId(null)}
                      className="hover-rider-item"
                    >
                      <Space direction="vertical" size={0}>
                        <Text style={{ fontSize: 14, color: '#F0F0F0' }}>{driver.full_name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{driver.vehicle_type} • {driver.plate_number}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Button type="text" size="small" onClick={() => setAssigningOrderId(null)} style={{ color: '#808080' }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                block 
                type="primary" 
                ghost 
                icon={<UserAddOutlined />} 
                onClick={() => setAssigningOrderId(order.order_id)}
                style={{ borderColor: '#FFDE58', color: '#FFDE58', marginTop: 4 }}
              >
                Assign Rider
              </Button>
            )}
          </List.Item>
        )}
      />
    </Card>
  );
};
