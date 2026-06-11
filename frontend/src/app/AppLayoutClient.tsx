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
  UserCircle 
} from 'lucide-react';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading, useMockIam } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">Rx</div>
          <span className="brand-name">ClinEDC</span>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="nav-list">
            <li>
              <Link href="/" className={`nav-link ${isLinkActive('/') ? 'active' : ''}`}>
                <LayoutDashboard />
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/patients" className={`nav-link ${isLinkActive('/patients') ? 'active' : ''}`}>
                <Users />
                Patients
              </Link>
            </li>
            {showAuditLogs && (
              <li>
                <Link href="/audit" className={`nav-link ${isLinkActive('/audit') ? 'active' : ''}`}>
                  <History />
                  Audit Trail
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* User profile section at the bottom of the sidebar */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UserCircle style={{ width: '36px', height: '36px', color: 'var(--color-primary)' }} />
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </p>
              <span className={`badge ${
                user.role === 'ADMIN' ? 'badge-completed' :
                user.role === 'MONITOR' ? 'badge-frozen' :
                user.role === 'DATA_ENTRY' ? 'badge-enrolled' :
                'badge-screening'
              }`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.5rem', marginTop: '0.25rem' }}>
                {user.role}
              </span>
            </div>
          </div>

          <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut style={{ width: '16px' }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        {/* User Identity Context Banner */}
        <div className="user-banner">
          <div className="user-banner-details">
            <div>
              <span className="user-banner-label">Study Site</span>
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {user.site_id === 1 ? 'Berlin Charité Medical Center (Site 1)' :
                 user.site_id === 2 ? 'New York Presbyterian Hospital (Site 2)' :
                 'Global Study Control'}
              </p>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
            <div>
              <span className="user-banner-label">FDA Compliance Status</span>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck style={{ width: '16px', height: '16px' }} />
                21 CFR Part 11 Audit Active
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
