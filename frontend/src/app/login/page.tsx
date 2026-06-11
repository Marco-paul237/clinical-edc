'use client';

import React from 'react';
import { useAuth, mockProfiles } from '../../context/AuthContext';
import { ShieldAlert, Key, User, Activity } from 'lucide-react';

export default function LoginPage() {
  const { login, useMockIam } = useAuth();

  const handleMockLogin = (profileKey: string) => {
    const profile = mockProfiles[profileKey];
    if (profile) {
      login(profile);
    }
  };

  const handleKeycloakLogin = () => {
    // Standard OIDC Keycloak flow
    // In production, this redirects to the Keycloak auth server
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'edc-realm';
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'edc-frontend';
    const redirectUri = encodeURIComponent(window.location.origin);
    
    const url = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=openid`;
    window.location.href = url;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0e17',
      backgroundImage: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
      padding: '2rem'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '2.5rem',
        background: 'rgba(16, 24, 40, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* App Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '1.25rem',
            color: '#000',
            marginBottom: '1rem'
          }}>
            Rx
          </div>
          <h1 className="brand-name" style={{
            fontSize: '1.75rem',
            marginBottom: '0.5rem',
            fontFamily: 'var(--font-heading)',
            display: 'block'
          }}>
            ClinEDC Portal
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Clinical Data Management & Regulatory Audit Platform
          </p>
        </div>

        {useMockIam ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: 'var(--color-warning)',
              fontSize: '0.85rem'
            }}>
              <ShieldAlert style={{ flexShrink: 0, width: '18px' }} />
              <span>
                <strong>Developer IAM Mock Mode Active</strong>. Select a role below to simulate real-time data entries, audit logging, and site boundaries.
              </span>
            </div>

            <p style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              marginBottom: '1rem'
            }}>
              Select Study Profile
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={() => handleMockLogin('mock-crc-1')} className="btn btn-secondary" style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '1rem'
              }}>
                <User style={{ color: 'var(--color-primary)' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>John | CRC Coordinator (Site 1)</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Can add patients & input vitals at Berlin. Restricted from Site 2.
                  </span>
                </div>
              </button>

              <button onClick={() => handleMockLogin('mock-crc-2')} className="btn btn-secondary" style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '1rem'
              }}>
                <User style={{ color: 'var(--color-primary)' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Jane | CRC Coordinator (Site 2)</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Can add patients & input vitals at New York. Restricted from Site 1.
                  </span>
                </div>
              </button>

              <button onClick={() => handleMockLogin('mock-cra')} className="btn btn-secondary" style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '1rem'
              }}>
                <Activity style={{ color: 'var(--color-secondary)' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Alice | CRA Monitor (Sponsor)</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Reviews all sites, freezes verified data fields, and view audit trail.
                  </span>
                </div>
              </button>

              <button onClick={() => handleMockLogin('mock-admin')} className="btn btn-secondary" style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '1rem'
              }}>
                <Key style={{ color: 'var(--color-success)' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>System Administrator</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Bypass auth controls, manage study sites.
                  </span>
                </div>
              </button>

              <button onClick={() => handleMockLogin('mock-patient-1')} className="btn btn-secondary" style={{
                textAlign: 'left',
                justifyContent: 'flex-start',
                padding: '1rem'
              }}>
                <User style={{ color: '#fb7185' }} />
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Robert | Trial Patient (Site 1)</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Access Patient Portal to read and sign Informed Consent.
                  </span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(20, 184, 166, 0.08)',
              border: '1px solid rgba(20, 184, 166, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              color: 'var(--color-primary)',
              fontSize: '0.85rem'
            }}>
              <ShieldAlert style={{ flexShrink: 0, width: '18px' }} />
              <span>
                Standard OIDC authentication mode is active. You will be redirected to the secure Keycloak server.
              </span>
            </div>

            <button onClick={handleKeycloakLogin} className="btn btn-primary" style={{
              width: '100%',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              Authenticate with Keycloak
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
