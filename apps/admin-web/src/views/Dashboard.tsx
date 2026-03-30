import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { KpiCard } from '../components/KpiCard';
import { FilterPills } from '../components/FilterPills';
import type { FilterPeriod } from '../components/FilterPills';
import { SalesChart } from '../components/charts/SalesChart';
import { VolumeChart } from '../components/charts/VolumeChart';
import { StorageTrackingChart } from '../components/charts/StorageTrackingChart';
import { PhilippinePesoIcon, FileText, Printer, CheckCircle, Package } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterPeriod>('7D');

  return (
    <Layout>
      {/* Top Controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Analytics Overview</h2>
        <FilterPills activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KpiCard
          title="Monthly Revenue"
          value="₱42,500.00"
          icon={PhilippinePesoIcon}
          isRevenue={true}
          trend={12}
          highlightColor="var(--info)"
        />
        <KpiCard
          title="New Orders"
          value="45"
          icon={FileText}
          highlightColor="var(--info)"
        />
        <KpiCard
          title="In Production"
          value="12"
          icon={Printer}
          highlightColor="var(--warning)"
        />
        <KpiCard
          title="Ready For Pickup"
          value="8"
          icon={Package}
          highlightColor="var(--success)"
        />
        <KpiCard
          title="Delivered"
          value="124"
          icon={CheckCircle}
          highlightColor="var(--success)"
        />
      </div>

      {/* Chart Grid */}
      <div className="charts-grid">
        <SalesChart period={activeFilter} />
        <VolumeChart period={activeFilter} />
      </div>

      {/* Second Row Charts */}
      <div className="mb-6">
        <StorageTrackingChart />
      </div>
    </Layout>
  );
};
