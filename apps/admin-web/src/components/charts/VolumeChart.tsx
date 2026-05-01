import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const THIRTY_DAY_VOLUME = Array.from({ length: 30 }, (_, i) => ({
  name: `D${i + 1}`,
  count: 60 + ((i * 37) % 190),
}));

interface VolumeChartProps {
  period: '7D' | '30D' | '6M';
}

export const VolumeChart: React.FC<VolumeChartProps> = ({ period }) => {
  const data = useMemo(() => {
    switch (period) {
      case '7D':
        return [
          { name: 'Mon', count: 120 },
          { name: 'Tue', count: 150 },
          { name: 'Wed', count: 200 },
          { name: 'Thu', count: 180 },
          { name: 'Fri', count: 240 },
          { name: 'Sat', count: 300 },
          { name: 'Sun', count: 190 },
        ];
      case '30D':
        return THIRTY_DAY_VOLUME;
      case '6M':
        return [
          { name: 'Jan', count: 800 },
          { name: 'Feb', count: 1200 },
          { name: 'Mar', count: 1500 },
          { name: 'Apr', count: 1400 },
          { name: 'May', count: 2100 },
          { name: 'Jun', count: 2400 },
        ];
      default:
        return [];
    }
  }, [period]);

  return (
    <div className="card w-full h-full flex-col gap-4 animate-fade-in" style={{ height: '350px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-secondary">Order Volume</h3>
      </div>
      <div style={{ flex: 1, width: '100%', height: 'calc(100% - 40px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)' }}
              contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
            />
            <Bar dataKey="count" fill="var(--info)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
