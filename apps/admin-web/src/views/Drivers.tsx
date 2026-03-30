import React from 'react';
import { Layout } from '../components/Layout';
import { MapTracker } from '../components/MapTracker';
import { DispatchQueue } from '../components/DispatchQueue';
import { KpiCard } from '../components/KpiCard';
import { Wallet, Truck, PhilippinePeso, Clock } from 'lucide-react';
import { mockDeliveries } from '../data/mockDrivers';

export const Drivers: React.FC = () => {

  // Calculate some simple stats
  const totalPayout = mockDeliveries.reduce((acc, curr) => acc + curr.earnings, 0);
  const pendingDeliveries = mockDeliveries.filter(d => ['Assigned', 'Accepted', 'Picked Up', 'On the Way'].includes(d.status));
  
  return (
    <Layout>
      {/* 
        Operator Dashboard Layout 
        Map taking up main left area (2fr), Data tools taking up right area (1fr)
      */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
        
        {/* Left Column: Massive Tracking Map */}
        <section style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={24} color="var(--brand-yellow)" />
            Rider Live Tracking
          </h2>
          <div style={{ flex: 1, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            <MapTracker />
          </div>
        </section>

        {/* Right Column: Cost & Dispatch */}
        <section style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          
          {/* Cost Management Metrics */}
          <div className="flex-col gap-4">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wallet size={24} color="var(--brand-yellow)" />
              Cost Tracker
            </h2>
            <div className="flex-col gap-3">
              <KpiCard
                title="Total Payouts Resolved"
                value={`₱${totalPayout.toFixed(2)}`}
                icon={PhilippinePeso}
                highlightColor="var(--success)"
              />
              <KpiCard
                title="Active Rider Costs"
                value={`₱${(pendingDeliveries.length * 90).toFixed(2)}`} 
                icon={Clock}
                highlightColor="var(--warning)"
              />
            </div>
            {/* Quick list of recent payouts */}
            <div className="card animate-fade-in" style={{ padding: '1rem' }}>
               <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Recent Earnings Log</h3>
               {mockDeliveries.filter(d => d.earnings > 0).slice(0, 3).map(d => (
                 <div key={d.id} className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div className="flex-col">
                      <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{d.orderId}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.date}</span>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)' }}>+₱{d.earnings.toFixed(2)}</span>
                 </div>
               ))}
            </div>
          </div>

          {/* Dispatch Queue */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300, overflow: 'hidden' }}>
            <DispatchQueue />
          </div>

        </section>

      </div>
    </Layout>
  );
};
