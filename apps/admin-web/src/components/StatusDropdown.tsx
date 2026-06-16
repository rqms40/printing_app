import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardList, CheckCircle2, XCircle, Printer, Settings, 
  ShieldCheck, Package, Truck, CheckSquare, XSquare, IdCard, MapPin, ChevronDown 
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OrderStatus } from '../types';

interface StatusDropdownProps {
  currentStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
}

const statusOptions: { label: OrderStatus; icon: LucideIcon }[] = [
  { label: 'Order Placed', icon: ClipboardList },
  { label: 'File Verified', icon: CheckCircle2 },
  { label: 'File Declined', icon: XCircle },
  { label: 'Printing in Progress', icon: Printer },
  { label: 'Finishing & Mounting', icon: Settings },
  { label: 'Quality Checked', icon: ShieldCheck },
  { label: 'Ready for Dispatch', icon: Package },
  { label: 'Rider Assigned', icon: IdCard },
  { label: 'Picked Up', icon: Truck },
  { label: 'On the Way', icon: Truck },
  { label: 'Arrived at Destination', icon: MapPin },
  { label: 'Delivered', icon: CheckCircle2 },
  { label: 'Completed (Pickup)', icon: CheckSquare },
  { label: 'Cancelled', icon: XSquare },
];

export const StatusDropdown: React.FC<StatusDropdownProps> = ({ currentStatus, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef} style={{ width: '240px' }}>
      <button 
        className="flex items-center justify-between w-full"
        style={{
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333',
          padding: '10px 16px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '0.875rem'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{currentStatus}</span>
        <ChevronDown size={16} color="#888" />
      </button>

      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            zIndex: 10,
            width: '100%',
            marginTop: '8px',
            backgroundColor: '#1E1E1E',
            border: '1px solid #333',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px 0'
          }}
        >
          {statusOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.label === currentStatus;
            return (
              <button
                key={opt.label}
                className="flex items-center w-full gap-3"
                style={{
                  padding: '12px 16px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: isActive ? '#fff' : '#aaa',
                  transition: 'background 0.2s',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400
                }}
                onClick={() => {
                  onStatusChange(opt.label);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.05)' : 'transparent'}
              >
                <Icon size={18} color={isActive ? '#fff' : '#888'} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
