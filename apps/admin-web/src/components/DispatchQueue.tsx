import React, { useState } from 'react';
import { mockOrders } from '../data/mockOrders';
import { mockRiders } from '../data/mockRiders';
import { UserPlus, Package, ChevronRight } from 'lucide-react';

export const DispatchQueue: React.FC = () => {
  const readyOrders = mockOrders.filter(o => o.status === 'Ready for Dispatch');
  
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  // Available riders only
  const availableRiders = mockRiders.filter(d => d.isAvailable);

  return (
    <div className="card flex-col gap-4 animate-fade-in" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Dispatch Queue</h2>
        <span className="filter-pill" style={{ padding: '2px 8px', backgroundColor: 'var(--brand-yellow-muted)', color: 'var(--brand-yellow)', border: 'none' }}>
          {readyOrders.length} Pending
        </span>
      </div>

      {readyOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
          No orders waiting for dispatch.
        </div>
      ) : (
        <div className="flex-col gap-3">
          {readyOrders.map(order => (
            <div key={order.orderId} style={{ 
              backgroundColor: 'var(--surface-color)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex-col">
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{order.orderId}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Delivery Fee: ₱{order.deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-center items-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '6px', borderRadius: '8px' }}>
                  <Package size={18} color="#22c55e" />
                </div>
              </div>

              {assigningOrderId === order.orderId ? (
                <div className="flex-col gap-2 mt-2">
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Select Rider:</span>
                  <div className="flex-col gap-2 max-h-40 overflow-y-auto">
                    {availableRiders.map(rider => (
                      <button key={rider.id} className="flex justify-between items-center" style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: 'var(--surface-hover)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        textAlign: 'left'
                      }}>
                        <div className="flex-col">
                          <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>{rider.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rider.vehicleType} &bull; {rider.plateNumber}</span>
                        </div>
                        <ChevronRight size={16} color="var(--brand-yellow)" />
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setAssigningOrderId(null)} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px', alignSelf: 'center' }}>Cancel</button>
                </div>
              ) : (
                <button 
                  onClick={() => setAssigningOrderId(order.orderId)}
                  className="flex justify-center items-center gap-2 w-full" 
                  style={{ 
                    backgroundColor: 'var(--brand-yellow-muted)', 
                    color: 'var(--brand-yellow)', 
                    padding: '10px', 
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-yellow)' }
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-yellow-muted)'}
                >
                  <UserPlus size={18} />
                  Assign Rider
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
