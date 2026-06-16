import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Grid, Settings, LogOut, Printer, Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="flex items-center gap-3" style={{ marginBottom: '2rem' }}>
          <div className="bg-accent" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Printer size={20} color="#000" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>GRIDGO Admin</span>
        </div>
        
        <nav style={{ flex: 1 }}>
          <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link to="/queue" className={`nav-item ${path.startsWith('/queue') ? 'active' : ''}`}>
            <Grid size={20} />
            Order Queue
          </Link>
          <Link to="/riders" className={`nav-item ${path.startsWith('/riders') ? 'active' : ''}`}>
            <Users size={20} />
            Riders
          </Link>
          <a href="#" className="nav-item">
            <Settings size={20} />
            Settings
          </a>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button className="nav-item w-full" style={{ width: '100%', display: 'flex' }}>
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="text-3xl">{path.startsWith('/queue') ? (path === '/queue' ? 'Order Queue' : '') : path.startsWith('/riders') ? 'Riders Panel' : 'Dashboard'}</h1>
            {path === '/' && <p className="text-secondary">Welcome back, Admin</p>}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="filter-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, padding: 0 }}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            {/* User Profile avatar */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--border-color)' }} />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
};
