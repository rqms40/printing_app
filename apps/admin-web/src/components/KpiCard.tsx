import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  highlightColor?: string;
  isRevenue?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  highlightColor = 'var(--info)',
  isRevenue = false,
}) => {
  if (isRevenue) {
    return (
      <div className="card animate-fade-in" style={{ gridColumn: '1 / -1' }}>
        <div className="flex items-center justify-between" style={{ gap: '1rem' }}>
          <div className="flex items-center gap-4">
            <div className="flex justify-center items-center" style={{
              width: 56,
              height: 56,
              backgroundColor: 'var(--brand-yellow-muted)',
              borderRadius: 'var(--radius-md)'
            }}>
              <Icon size={28} color="var(--brand-yellow)" />
            </div>
            <div className="flex flex-col" style={{ gap: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{title}</span>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-2" style={{
              backgroundColor: trend >= 0 ? 'var(--success-muted)' : 'var(--warning-muted)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-100)',
              color: trend >= 0 ? 'var(--success)' : 'var(--warning)',
              fontWeight: 600,
              fontSize: '1rem'
            }}>
              {trend >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fade-in flex items-center justify-between" style={{ gap: '1rem' }}>
      <div className="flex-col" style={{ display: 'flex', gap: '0.25rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
        <span className="text-sm text-secondary">{title}</span>
      </div>
      <div className="flex justify-center items-center" style={{
        width: 48,
        height: 48,
        backgroundColor: `${highlightColor}20`,
        borderRadius: 'var(--radius-md)'
      }}>
        <Icon size={24} color={highlightColor} />
      </div>
    </div>
  );
};
