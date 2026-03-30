import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './views/Dashboard';
import { OrderQueue } from './views/OrderQueue';
import { OrderDetail } from './views/OrderDetail';
import { Drivers } from './views/Drivers';
import './index.css';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-root">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/queue" element={<OrderQueue />} />
          <Route path="/queue/:id" element={<OrderDetail />} />
          <Route path="/drivers" element={<Drivers />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
