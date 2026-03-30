import React from 'react';
import { Column } from '@ant-design/charts';
import { mockStorageData } from '@/providers/mock-data';

export const StorageTrackingChart: React.FC = () => {
  const config = {
    data: mockStorageData,
    group: true,
    xField: 'size',
    yField: 'value',
    colorField: 'type',
    color: ['#42A5F5', '#FFCA28'], 
    dodgePadding: 2,
    height: 300,
    style: { radiusTopLeft: 4, radiusTopRight: 4 },
  };

  return <Column {...config} />;
};
