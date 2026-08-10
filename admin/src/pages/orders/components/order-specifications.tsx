import { Descriptions, Typography } from 'antd';
import type { OrderItem } from '@/types/order';
import { humanizeEnumValue } from '@/utils/api-normalizers';

const { Text } = Typography;

export function OrderSpecifications({ item }: { item: Pick<OrderItem, 'specs' | 'paper_specs' | 'three_d_specs'> }) {
  if (item.specs?.length) {
    return (
      <Descriptions column={1} size="small">
        {item.specs.map((spec, index) => (
          <Descriptions.Item key={`${spec.key}:${index}`} label={spec.label || humanizeEnumValue(spec.key)}>
            {spec.display_value || spec.option_label || spec.value || '—'}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }
  if (item.paper_specs) {
    return <Text>{`${item.paper_specs.paper_size?.toUpperCase()} · ${humanizeEnumValue(item.paper_specs.color_mode)} · ${humanizeEnumValue(item.paper_specs.print_sides)}`}</Text>;
  }
  if (item.three_d_specs) {
    return <Text>{`${item.three_d_specs.file_format?.toUpperCase()} · ${item.three_d_specs.material?.toUpperCase()} · ${item.three_d_specs.infill_percentage}% infill`}</Text>;
  }
  return <Text type="secondary">No specifications recorded</Text>;
}
