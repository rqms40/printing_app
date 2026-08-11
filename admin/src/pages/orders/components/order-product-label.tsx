import { Space, Tag, Typography } from 'antd';
import type { OrderItem } from '@/types/order';

const { Text } = Typography;

export function productDisplayName(item: Pick<OrderItem, 'category' | 'category_name'>): string {
  if (item.category_name?.trim()) return item.category_name;
  if (item.category === 'paper') return 'Paper';
  if (item.category === '3d') return '3D';
  return item.category;
}

export function OrderProductLabel({ item }: { item: Pick<OrderItem, 'category' | 'category_name' | 'group_name'> }) {
  return (
    <Space direction="vertical" size={0}>
      <Text strong>{productDisplayName(item)}</Text>
      {item.group_name ? <Text type="secondary">{item.group_name}</Text> : null}
      {!item.category_name && (item.category === 'paper' || item.category === '3d') ? (
        <Tag color={item.category === 'paper' ? 'blue' : 'purple'}>{item.category}</Tag>
      ) : null}
    </Space>
  );
}
