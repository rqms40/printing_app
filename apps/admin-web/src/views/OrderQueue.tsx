import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { OrderCard } from '../components/OrderCard';
import { mockOrders } from '../data/mockOrders';
import { Search } from 'lucide-react';

export const OrderQueue: React.FC = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  const filterConfigs = [
    { label: 'New', count: mockOrders.filter(o => o.status === 'New').length },
    { label: 'Production', count: mockOrders.filter(o => o.status === 'Printing in Progress' || o.status === 'Quality Checked').length },
    { label: 'Done', count: mockOrders.filter(o => o.status === 'Ready for Dispatch' || o.status === 'Delivered').length },
    { label: 'All', count: mockOrders.length },
  ];

  const displayOrders = mockOrders.filter(order => {
    // text search
    if (search && !order.orderId.toLowerCase().includes(search.toLowerCase())) return false;
    
    // tab filter
    if (activeTab === 'New') return order.status === 'New';
    if (activeTab === 'Production') return ['Printing in Progress', 'Quality Checked'].includes(order.status);
    if (activeTab === 'Done') return ['Ready for Dispatch', 'Delivered'].includes(order.status);
    return true; // "All"
  });

  return (
    <Layout>
      {/* Tabs */}
      <div className="tab-container">
        {filterConfigs.map((config) => (
          <div 
            key={config.label}
            className={`tab-item ${activeTab === config.label ? 'active' : ''}`}
            onClick={() => setActiveTab(config.label)}
          >
            {config.label} <span className="tab-badge">{config.count}</span>
          </div>
        ))}
      </div>

      {/* Search Input */}
      <div className="search-container">
        <Search className="search-icon" size={20} />
        <input 
          type="text" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID..." 
          className="search-input" 
        />
      </div>

      {/* Order List */}
      <div className="flex-col gap-4">
        {displayOrders.map(order => (
          <OrderCard key={order.orderId} order={order} />
        ))}
      </div>
    </Layout>
  );
};
