import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockOrders } from '../data/mockOrders';
import { Layout } from '../components/Layout';
import { StatusDropdown } from '../components/StatusDropdown';
import { ArrowLeft, FileText } from 'lucide-react';

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Find order
  const orderData = mockOrders.find(o => o.orderId === id);
  const [currentStatus, setCurrentStatus] = useState(orderData?.status || 'Order Placed');

  if (!orderData) {
    return (
      <Layout>
        <div style={{ color: 'var(--text-secondary)' }}>Order not found.</div>
      </Layout>
    );
  }

  const specKeys = Object.keys(orderData.specs) as (keyof typeof orderData.specs)[];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', padding: '2rem' }}>
      <header className="flex items-center gap-4" style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate('/queue')} style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{orderData.orderId}</h1>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Controls */}
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Status</span>
          <StatusDropdown currentStatus={currentStatus as any} onStatusChange={(s: any) => setCurrentStatus(s)} />
        </div>

        <button style={{
          width: '100%', padding: '12px 0', border: '1px solid #fff', borderRadius: '8px', 
          backgroundColor: 'transparent', color: '#fff', fontSize: '1rem', fontWeight: 600, transition: '0.2s'
        }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          Decline
        </button>

        {/* File Info */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>File Info</h2>
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <FileText size={20} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{orderData.fileName}</span>
          </div>
        </section>

        {/* Specifications */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Specifications</h2>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {specKeys.map(key => (
              <div key={key} className="flex justify-between items-center" style={{ fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span style={{ color: '#fff' }}>{orderData.specs[key]}</span>
              </div>
            ))}
            <div className="flex justify-between items-center" style={{ fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Quantity</span>
              <span style={{ color: '#fff' }}>{orderData.quantity}</span>
            </div>
          </div>
        </section>

        {/* Price Breakdown */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Price Breakdown</h2>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex justify-between items-center" style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span>
              <span style={{ color: '#fff' }}>₱{(orderData.price - orderData.deliveryFee).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
              <span>Delivery Fee</span>
              <span style={{ color: '#fff' }}>₱{orderData.deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <span>Total</span>
              <span>₱{orderData.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <span>Payment</span>
              <span style={{ color: '#fff' }}>{orderData.paymentLabel}</span>
            </div>
          </div>
        </section>

        {/* Status History */}
        <section>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Status History</h2>
          <div className="card" style={{ padding: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No status changes recorded.
          </div>
        </section>

      </div>
    </div>
  );
};
