import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, File, Printer, Package, Truck, CheckCircle } from 'lucide-react';
import type { Order } from '../types';

interface OrderCardProps {
  order: Order;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const navigate = useNavigate();

  // Determine Icon and Color based on custom status mappings from the user screenshot.
  const getStatusConfig = () => {
    switch (order.status) {
      case 'New':
        return { icon: File, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'Printing in Progress':
        return { icon: Printer, color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' };
      case 'Ready for Dispatch':
        return { icon: Package, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' };
      case 'On the Way':
        return { icon: Truck, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'Delivered':
        return { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' };
      default:
        return { icon: File, color: '#888', bg: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  const { icon: Icon, color, bg } = getStatusConfig();

  return (
    <div 
      className="card flex items-center gap-4 animate-fade-in"
      style={{ padding: '1.25rem', marginBottom: '1rem', cursor: 'pointer', backgroundColor: '#161616' }}
      onClick={() => navigate(`/queue/${order.orderId}`)}
    >
      <div className="flex justify-center items-center" style={{ width: 48, height: 48, backgroundColor: bg, borderRadius: 'var(--radius-md)' }}>
        <Icon size={24} color={color} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{order.orderId}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{order.customerName}</div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, marginRight: 6 }} />
          {order.status} &bull; {order.date}
        </div>
      </div>

      <div className="flex-col items-end gap-2" style={{ textAlign: 'right', display: 'flex' }}>
        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          ₱{order.price.toFixed(2)}
        </span>
        <ChevronRight size={16} color="var(--text-secondary)" />
      </div>
    </div>
  );
};
