import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
  period: '7D' | '30D' | '6M';
}

export const SalesChart: React.FC<SalesChartProps> = ({ period }) => {
  const data = useMemo(() => {
    switch (period) {
      case '7D':
        return [
          { name: 'Mon', revenue: 4000 },
          { name: 'Tue', revenue: 3000 },
          { name: 'Wed', revenue: 2000 },
          { name: 'Thu', revenue: 2780 },
          { name: 'Fri', revenue: 1890 },
          { name: 'Sat', revenue: 2390 },
          { name: 'Sun', revenue: 3490 },
        ];
      case '30D':
        // Generate 30 data points mock
        return Array.from({ length: 30 }, (_, i) => ({
          name: `Day ${i + 1}`,
          revenue: Math.floor(Math.random() * 5000) + 1000,
        }));
      case '6M':
        return [
          { name: 'Jan', revenue: 40000 },
          { name: 'Feb', revenue: 30000 },
          { name: 'Mar', revenue: 45000 },
          { name: 'Apr', revenue: 27800 },
          { name: 'May', revenue: 58900 },
          { name: 'Jun', revenue: 63900 },
        ];
      default:
        return [];
    }
  }, [period]);

  return (
    <div className="card w-full h-full flex-col gap-4 animate-fade-in" style={{ height: '350px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-secondary">Sales Trend</h3>
      </div>
      <div style={{ flex: 1, width: '100%', height: 'calc(100% - 40px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand-yellow)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="var(--brand-yellow)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₱${value}`} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
              itemStyle={{ color: 'var(--brand-yellow)' }}
              formatter={(value: any) => [`₱${value}`, 'Revenue']}
            />
            <Area type="monotone" dataKey="revenue" stroke="var(--brand-yellow)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
