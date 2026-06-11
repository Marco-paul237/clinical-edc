'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Building2, 
  Lock, 
  FileSpreadsheet, 
  FileUp, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function DashboardPage() {
  const { user, apiFetch } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState({
    patientsCount: 0,
    enrolledCount: 0,
    sitesCount: 0,
    formsCount: 0,
    frozenFormsCount: 0
  });
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        // Load Patients
        const patients = await apiFetch('/api/patients');
        // Load Sites
        const sites = await apiFetch('/api/sites');

        // Compile counts
        const enrolled = patients.filter((p: any) => p.status === 'ENROLLED').length;
        
        // Fetch forms for each patient to compute statistics
        let totalForms = 0;
        let frozenForms = 0;
        
        for (const p of patients) {
          try {
            const forms = await apiFetch(`/api/forms/patient/${p.id}`);
            totalForms += forms.length;
            frozenForms += forms.filter((f: any) => f.is_frozen).length;
          } catch (e) {
            // Ignore if patient forms are not readable (due to RLS or empty)
          }
        }

        setStats({
          patientsCount: patients.length,
          enrolledCount: enrolled,
          sitesCount: sites.length,
          formsCount: totalForms,
          frozenFormsCount: frozenForms
        });

        // Load Audit Logs if allowed
        if (user.role === 'MONITOR' || user.role === 'ADMIN') {
          const audits = await apiFetch('/api/audit');
          setRecentAudits(audits.slice(0, 5)); // Keep latest 5
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load dashboard data. Ensure the database is fully seeded.');
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const handleExportData = async () => {
    try {
      const exportData = await apiFetch('/api/audit/export', { method: 'POST' });
      
      // Trigger a browser file download of the JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edc_trial_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Refresh recent audits list since export triggers an audit log
      if (user?.role === 'MONITOR' || user?.role === 'ADMIN') {
        const audits = await apiFetch('/api/audit');
        setRecentAudits(audits.slice(0, 5));
      }
      
      alert('CDISC SDTM Dataset exported successfully and recorded in audit trail!');
    } catch (err) {
      console.error(err);
      alert('Failed to export dataset.');
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading dashboard metrics...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-error)', margin: '2rem 0' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--color-error)' }}>
          <AlertTriangle />
          <div>
            <h3 style={{ fontWeight: 700 }}>Database Connection Pending</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role === 'PATIENT') {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Patient Portal Dashboard</h1>
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Welcome to the Clinical Trial</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            As a trial participant, you can view your profile details and securely sign the required Informed Consent document digitally to participate.
          </p>
          <button onClick={() => router.push(`/patients`)} className="btn btn-primary">
            Go to My Patient Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Study Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Clinical Trial Metrics & Real-time Site Monitoring
          </p>
        </div>
        
        {(user?.role === 'MONITOR' || user?.role === 'ADMIN') && (
          <button onClick={handleExportData} className="btn btn-primary">
            <FileSpreadsheet style={{ width: '16px' }} />
            Export CDISC Dataset
          </button>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="dashboard-grid">
        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Screening Patients</span>
            <Users style={{ color: 'var(--color-warning)', width: '20px' }} />
          </div>
          <span className="stat-value">{stats.patientsCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Patients registered at study sites
          </span>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Enrolled / Consented</span>
            <Users style={{ color: 'var(--color-success)', width: '20px' }} />
          </div>
          <span className="stat-value">{stats.enrolledCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Signed informed consent forms
          </span>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Study Sites</span>
            <Building2 style={{ color: 'var(--color-info)', width: '20px' }} />
          </div>
          <span className="stat-value">{stats.sitesCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Authorized clinical locations
          </span>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Clinical Forms</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Lock style={{ color: 'var(--color-secondary)', width: '16px' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}>{stats.frozenFormsCount} locked</span>
            </div>
          </div>
          <span className="stat-value">{stats.formsCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Vitals, Labs & Adverse Events logs
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Recent Audits */}
        {(user?.role === 'MONITOR' || user?.role === 'ADMIN') ? (
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck style={{ color: 'var(--color-success)' }} />
              Recent Compliance Log Feed
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentAudits.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No recent audit trail entries.</p>
              ) : (
                recentAudits.map((log) => (
                  <div key={log.id} style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: `3px solid ${
                      log.action === 'DATA_FREEZE' ? 'var(--color-secondary)' :
                      log.action === 'CONSENT_SIGN' ? 'var(--color-success)' :
                      log.action === 'DATA_UPDATE' ? 'var(--color-warning)' :
                      'var(--color-info)'
                    }`,
                    borderRadius: '0 4px 4px 0',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>{log.user_name} ({log.user_email})</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                      Action: <strong style={{ color: 'var(--color-text-main)' }}>{log.action}</strong> | Target: {log.entity_type} ({log.entity_id})
                    </p>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => router.push('/audit')} 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}
            >
              Explore Full Audit Trail
              <ExternalLink style={{ width: '14px' }} />
            </button>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={() => router.push('/patients')} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                View Study Patients
              </button>
            </div>
          </div>
        )}

        {/* Study Context Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Study Protocol</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              <strong>Title:</strong> Phase III double-blind study to evaluate the efficacy and safety of Compound RX-492 in patients with hypertension.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <strong>Regulatory Body:</strong> FDA & EMA
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              <strong>Status:</strong> Active Recruiting
            </p>
          </div>
          
          <div style={{
            background: 'rgba(20, 184, 166, 0.05)',
            border: '1px solid rgba(20, 184, 166, 0.15)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-primary)'
          }}>
            🔐 Data encryption standard TLS 1.3 active. Access token session expires in 15 minutes.
          </div>
        </div>
      </div>
    </div>
  );
}
