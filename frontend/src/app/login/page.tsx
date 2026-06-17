'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Key, User, Activity, Lock, Mail, Users, Sparkles, Building2 } from 'lucide-react';

export interface Site {
  id: number;
  name: string;
  location: string;
}

export default function LoginPage() {
  const { login } = useAuth();

  // Tab Selection State (Removed Mock Profiles tab)
  const [activeTab, setActiveTab] = useState<'credentials' | 'oidc'>('credentials');
  
  // Credentials Sub-mode
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Sign Up Form State
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<'ADMIN' | 'MONITOR' | 'DATA_ENTRY' | 'PATIENT'>('DATA_ENTRY');
  
  // Sites Selection State
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sites for signup
  const loadSites = async () => {
    try {
      const res = await fetch('/api/auth/sites');
      if (res.ok) {
        const data = await res.json();
        setSites(data);
        if (data.length > 0) {
          setSelectedSiteId(String(data[0].id));
        } else {
          setSelectedSiteId('create-new');
        }
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleKeycloakLogin = () => {
    // Port 8081 is configured for Keycloak to avoid port conflicts with local Adminer services
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8081';
    const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'edc-realm';
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'edc-frontend';
    const redirectUri = encodeURIComponent(window.location.origin);
    
    const url = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=openid`;
    window.location.href = url;
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to authenticate.');
      }

      const data = await res.json();
      login(data.user, data.token, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Network error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isCreateNew = selectedSiteId === 'create-new';
      
      if (isCreateNew && (!newSiteName || !newSiteLocation)) {
        throw new Error('Please fill in both New Site Name and New Site Location fields.');
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          password: signupPassword,
          role: signupRole,
          site_id: isCreateNew ? null : selectedSiteId,
          new_site_name: isCreateNew ? newSiteName : null,
          new_site_location: isCreateNew ? newSiteLocation : null
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to register account.');
      }

      const data = await res.json();
      
      // Reload sites in background
      loadSites();
      
      // Direct login
      login(data.user, data.token, true);
    } catch (err: any) {
      setError(err.message || 'Network error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#070a13',
      backgroundImage: 'radial-gradient(circle at center, rgba(30, 58, 138, 0.22) 0%, transparent 80%)',
      padding: '2rem',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <style>{`
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          color: #94a3b8;
          padding: 0.75rem 0.5rem;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .tab-btn.active {
          color: #38bdf8;
          border-bottom-color: #38bdf8;
        }
        .tab-btn:hover {
          color: #fff;
        }
        .auth-card {
          width: 100%;
          max-width: 520px;
          padding: 2.5rem;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(56, 189, 248, 0.15);
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
        }
        .mode-link {
          color: #38bdf8;
          text-decoration: none;
          font-weight: 500;
          cursor: pointer;
        }
        .mode-link:hover {
          text-decoration: underline;
        }
        .field-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
          margin-top: 0.25rem;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .field-input:focus {
          border-color: #38bdf8;
          outline: none;
        }
        .btn-gradient {
          width: 100%;
          padding: 0.8rem;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.95rem;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-gradient:hover {
          opacity: 0.9;
        }
        .btn-gradient:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="auth-card">
        {/* App Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '1.25rem',
            color: '#070a13',
            marginBottom: '1rem'
          }}>
            Rx
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            marginBottom: '0.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            display: 'block'
          }}>
            ClinEDC Portal
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Clinical Data Management & Regulatory Audit Platform
          </p>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => setActiveTab('credentials')} 
            className={`tab-btn ${activeTab === 'credentials' ? 'active' : ''}`}
          >
            Portal Account
          </button>

          <button 
            type="button" 
            onClick={() => setActiveTab('oidc')} 
            className={`tab-btn ${activeTab === 'oidc' ? 'active' : ''}`}
          >
            Enterprise SSO
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: '#f87171',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        {/* TAB 1: Credentials (Login & Sign Up) */}
        {activeTab === 'credentials' && (
          <div>
            {authMode === 'login' ? (
              // Login Form
              <form onSubmit={handleCredentialsLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="login-email">Email Address</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Mail style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <input 
                      id="login-email"
                      type="email" 
                      required
                      placeholder="name@trial.com" 
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="login-password">Password</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Lock style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <input 
                      id="login-password"
                      type="password" 
                      required
                      placeholder="••••••••" 
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ accentColor: '#38bdf8' }}
                    />
                    <span>Remember me</span>
                  </label>
                </div>

                <button type="submit" className="btn-gradient" disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  Don't have an account? <span onClick={() => setAuthMode('signup')} className="mode-link">Sign Up</span>
                </p>
              </form>
            ) : (
              // Sign Up Form
              <form onSubmit={handleCredentialsSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="signup-username">Username</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <User style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <input 
                      id="signup-username"
                      type="text" 
                      required
                      placeholder="john_crc" 
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="signup-email">Email Address</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Mail style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <input 
                      id="signup-email"
                      type="email" 
                      required
                      placeholder="john@site1.org" 
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="signup-password">Password</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Lock style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <input 
                      id="signup-password"
                      type="password" 
                      required
                      placeholder="••••••••" 
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }} htmlFor="signup-role">Choose Clinical Role</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Users style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <select 
                      id="signup-role"
                      required
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem', background: '#0f172a' }}
                      value={signupRole}
                      onChange={(e: any) => setSignupRole(e.target.value)}
                    >
                      <option value="DATA_ENTRY">Clinical Site Investigator / CRC (DATA_ENTRY)</option>
                      <option value="MONITOR">CRA Data Monitor (MONITOR)</option>
                      <option value="ADMIN">System Administrator (ADMIN)</option>
                      <option value="PATIENT">Clinical Trial Patient (PATIENT)</option>
                    </select>
                  </div>
                </div>

                {/* Site Selection / Creation Container */}
                <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.25rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }} htmlFor="signup-site">Clinical Study Location / Site</label>
                  <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                    <Building2 style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', color: '#94a3b8' }} />
                    <select 
                      id="signup-site"
                      required
                      className="field-input" 
                      style={{ paddingLeft: '2.25rem', background: '#0f172a' }}
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                    >
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                      ))}
                      <option value="create-new">+ Create a new site...</option>
                    </select>
                  </div>
                </div>

                {/* Create New Site Fields */}
                {selectedSiteId === 'create-new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '8px', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38bdf8' }}>New Site Specifications</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }} htmlFor="new-site-name">Site Name</label>
                      <input 
                        id="new-site-name"
                        type="text" 
                        placeholder="e.g. Mayo Clinic Rochester" 
                        className="field-input"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8' }} htmlFor="new-site-location">Location (City / Country)</label>
                      <input 
                        id="new-site-location"
                        type="text" 
                        placeholder="e.g. Minnesota, USA" 
                        className="field-input"
                        value={newSiteLocation}
                        onChange={(e) => setNewSiteLocation(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-gradient" style={{ marginTop: '0.5rem' }} disabled={loading}>
                  <Sparkles style={{ width: '16px' }} />
                  {loading ? 'Creating Account...' : 'Register Account'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  Already have an account? <span onClick={() => setAuthMode('login')} className="mode-link">Log In</span>
                </p>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: OIDC Enterprise Identity */}
        {activeTab === 'oidc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(20, 184, 166, 0.08)',
              border: '1px solid rgba(20, 184, 166, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#14b8a6',
              fontSize: '0.85rem'
            }}>
              <ShieldAlert style={{ flexShrink: 0, width: '18px' }} />
              <span>
                Standard OIDC authentication mode is active. You will be redirected to the secure Keycloak server on port 8081.
              </span>
            </div>

            <button 
              type="button" 
              onClick={handleKeycloakLogin} 
              className="btn-gradient" 
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '1rem'
              }}
            >
              Authenticate with Keycloak SSO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
