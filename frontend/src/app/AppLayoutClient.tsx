'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  History, 
  LogOut, 
  Database, 
  ShieldCheck, 
  UserCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    logout, 
    isLoading, 
    useMockIam,
    isOffline,
    toggleOffline,
    syncQueue,
    syncOfflineData,
    switchContext
  } = useAuth();
  const pathname = usePathname();

  const [sites, setSites] = React.useState<any[]>([]);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (user) {
      fetch('/api/auth/sites')
        .then(res => res.json())
        .then(data => setSites(data))
        .catch(err => console.error('Failed to load sites in layout:', err));
    }
  }, [user]);

  if (isLoading || !isMounted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0a0e17',
        color: '#f3f4f6',
        gap: '1rem',
        fontFamily: 'sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(20, 184, 166, 0.1)',
          borderTopColor: '#14b8a6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: '0.9rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
          INITIALIZING SECURE SESSION...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If not logged in, render the login page directly without the sidebar layout
  if (!user) {
    return <>{children}</>;
  }

  const isLinkActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const showAuditLogs = user.role === 'ADMIN' || user.role === 'MONITOR';
  const showSafetyAlerts = user.role === 'ADMIN' || user.role === 'MONITOR';

  return (
    <div className="app-container">
      {/* Horizontal Header Navigation (LibreClinica style) */}
      <header className="header-bar">
        <div className="header-brand">
          <div className="header-logo">Rx</div>
          <span className="header-title">ClinEDC Portal</span>
        </div>

        <nav className="header-nav">
          <Link href="/" className={`header-link ${isLinkActive('/') ? 'active' : ''}`}>
            <LayoutDashboard />
            Dashboard
          </Link>
          <Link href="/patients" className={`header-link ${isLinkActive('/patients') ? 'active' : ''}`}>
            <Users />
            Registry Matrix
          </Link>
          {showSafetyAlerts && (
            <Link href="/safety" className={`header-link ${isLinkActive('/safety') ? 'active' : ''}`}>
              <AlertTriangle />
              Safety Alerts
            </Link>
          )}
          {showAuditLogs && (
            <Link href="/audit" className={`header-link ${isLinkActive('/audit') ? 'active' : ''}`}>
              <History />
              Audit Trail
            </Link>
          )}
        </nav>

        {/* User Details & Sign Out */}
        <div className="header-user-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#bfdbfe' }}>
            <UserCircle style={{ width: '22px', height: '22px' }} />
            <span>
              <strong>{user.name}</strong> ({user.role})
            </span>
          </div>

          <button 
            onClick={logout} 
            className="btn btn-secondary" 
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.75rem', 
              color: '#1e3a8a', 
              background: '#ffffff', 
              border: '1px solid #ffffff',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <LogOut style={{ width: '12px' }} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <main className="main-content">
        {/* User Identity Context Banner */}
        <div className="user-banner">
          <div className="user-banner-details">
            <div>
              <label htmlFor="site-select" className="user-banner-label">Clinical Study Site</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                {user.role === 'ADMIN' ? (
                  <select
                    id="site-select"
                    title="Clinical Study Site"
                    aria-label="Clinical Study Site"
                    value={user.site_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      switchContext(user.role, val ? parseInt(val, 10) : null);
                    }}
                    style={{
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">Global Study Control Center</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {sites.find(s => s.id === user.site_id)?.name || (user.site_id ? `Site #${user.site_id}` : 'Global Study Control Center')}
                  </span>
                )}
              </div>
            </div>
            <div className="user-banner-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
            <div>
              <span className="user-banner-label">FDA Compliance Status</span>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck style={{ width: '16px', height: '16px' }} />
                21 CFR Part 11 Active Logging
              </p>
            </div>
          </div>
          
          <div className="user-banner-actions">
            {/* Queue Sync button */}
            {isOffline && syncQueue.length > 0 && (
              <button 
                onClick={syncOfflineData} 
                className="btn btn-primary"
                style={{ 
                  padding: '0.35rem 0.75rem', 
                  fontSize: '0.7rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.25rem', 
                  color: '#ffffff',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <RefreshCw style={{ width: '12px' }} />
                Sync Edge Queue ({syncQueue.length})
              </button>
            )}

            {/* Connectivity Toggle */}
            <button
              onClick={() => toggleOffline(!isOffline)}
              className="btn"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.7rem',
                background: isOffline ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                border: isOffline ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                color: isOffline ? 'var(--color-error)' : 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {isOffline ? (
                <>
                  <WifiOff style={{ width: '14px' }} />
                  Offline Mode
                </>
              ) : (
                <>
                  <Wifi style={{ width: '14px' }} />
                  Edge Online
                </>
              )}
            </button>

            <span className="badge badge-screening" style={{ textTransform: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
              <Database style={{ width: '12px' }} />
              {useMockIam ? 'Local Mock IAM' : 'Keycloak OIDC Integration'}
            </span>
          </div>
        </div>

        {/* Dynamic page children */}
        {children}
      </main>
    </div>
  );
}
