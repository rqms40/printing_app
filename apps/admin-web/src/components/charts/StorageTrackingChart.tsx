import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export const StorageTrackingChart: React.FC = () => {
  // Mock data comparing Student vs Employee print volumes for different sizes
  const data = [
    { size: 'A5', Student: 350, Employee: 80 },
    { size: 'A4', Student: 1800, Employee: 1250 },
    { size: 'A3', Student: 240, Employee: 410 },
    { size: 'A2', Student: 90, Employee: 280 },
    { size: 'A1', Student: 40, Employee: 150 },
    { size: 'Poster(20x30in)', Student: 120, Employee: 300 },
  ];

  return (
    <div className="card w-full h-full flex-col gap-4 animate-fade-in" style={{ height: '400px' }}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-secondary">Document Print Storage Tracking</h3>
          <p className="text-xs text-secondary mt-1">Print volume by dimension & user segment</p>
        </div>
      </div>
      <div style={{ flex: 1, width: '100%', height: 'calc(100% - 60px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey="size" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)' }}
              contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="Student" fill="var(--info)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Employee" fill="var(--warning)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
