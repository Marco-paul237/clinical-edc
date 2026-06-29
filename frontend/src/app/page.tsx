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
    frozenFormsCount: 0,
    openQueriesCount: 0
  });
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [activeQueries, setActiveQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'MONITOR' | 'DATA_ENTRY'>('DATA_ENTRY');
  const [newSiteId, setNewSiteId] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'ADMIN' | 'MONITOR' | 'DATA_ENTRY'>('DATA_ENTRY');
  const [editingSiteId, setEditingSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTown, setNewSiteTown] = useState('');
  const [newSiteCountry, setNewSiteCountry] = useState('');
  const [newSiteStudyCase, setNewSiteStudyCase] = useState('');
  const [newSiteFile, setNewSiteFile] = useState<File | null>(null);

  // States for editing clinical sites
  const [editingClinicalSiteId, setEditingClinicalSiteId] = useState<number | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteTown, setEditSiteTown] = useState('');
  const [editSiteCountry, setEditSiteCountry] = useState('');
  const [editSiteStudyCase, setEditSiteStudyCase] = useState('');
  const [editSiteFile, setEditSiteFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        // Load dashboard metadata in parallel to optimize load speed and reduce network roundtrips
        const [patients, sites, queries] = await Promise.all([
          apiFetch('/api/patients'),
          apiFetch('/api/sites'),
          apiFetch('/api/queries')
        ]);
        const openQueries = queries.filter((q: any) => q.status === 'OPEN' || q.status === 'RESOLVED');

        // Compile counts
        const enrolled = patients.filter((p: any) => p.status === 'ENROLLED').length;
        
        // Fetch all clinical forms in a single call to avoid roundtrip network latency
        const forms = await apiFetch('/api/forms').catch(() => []);
        const totalForms = forms.length;
        const frozenForms = forms.filter((f: any) => f.is_frozen).length;

        setStats({
          patientsCount: patients.length,
          enrolledCount: enrolled,
          sitesCount: sites.length,
          formsCount: totalForms,
          frozenFormsCount: frozenForms,
          openQueriesCount: openQueries.filter((q: any) => q.status === 'OPEN').length
        });

        setActiveQueries(openQueries.slice(0, 5));

        // Load Audit Logs if allowed
        if (user.role === 'MONITOR' || user.role === 'ADMIN') {
          const audits = await apiFetch('/api/audit');
          setRecentAudits(audits.slice(0, 5)); // Keep latest 5
        }

        // Load sites and users if admin
        if (user.role === 'ADMIN') {
          const sitesData = await apiFetch('/api/sites');
          setSitesList(sitesData);
          const usersData = await apiFetch('/api/auth/users');
          setUsersList(usersData);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.warn(err);
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
      console.warn(err);
      alert('Failed to export dataset.');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword || !newRole) {
      alert('All fields are required.');
      return;
    }

    try {
      const newUser = await apiFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          role: newRole,
          site_id: newSiteId ? parseInt(newSiteId, 10) : null
        })
      });

      alert(`User "${newUser.name}" added successfully!`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('DATA_ENTRY');
      setNewSiteId('');

      // Refresh users
      const updatedUsers = await apiFetch('/api/auth/users');
      setUsersList(updatedUsers);
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to add user.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setNewSiteFile(e.target.files[0]);
    } else {
      setNewSiteFile(null);
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName || !newSiteTown || !newSiteCountry || !newSiteStudyCase || !newSiteFile) {
      alert('Site name, town, country, study case, and protocol document are required.');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const newSite = await apiFetch('/api/sites', {
            method: 'POST',
            body: JSON.stringify({
              name: newSiteName,
              town: newSiteTown,
              country: newSiteCountry,
              study_case: newSiteStudyCase,
              study_case_filename: newSiteFile.name,
              study_case_file_data: base64Data
            })
          });

          alert(`Site "${newSite.name}" created successfully!`);
          setNewSiteName('');
          setNewSiteTown('');
          setNewSiteCountry('');
          setNewSiteStudyCase('');
          setNewSiteFile(null);

          // Clear file input manually
          const fileInput = document.getElementById('site-file-input') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

          // Refresh sites list
          const updatedSites = await apiFetch('/api/sites');
          setSitesList(updatedSites);
        } catch (err: any) {
          console.warn(err);
          alert(err.message || 'Failed to create site.');
        }
      };
      reader.onerror = () => {
        alert('Failed to read the file.');
      };
      reader.readAsDataURL(newSiteFile);
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to process file.');
    }
  };

  const handleUpdateUserRole = async (userId: string) => {
    try {
      const updatedUser = await apiFetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({
          role: editingRole,
          site_id: editingSiteId ? parseInt(editingSiteId, 10) : null
        })
      });

      alert(`User "${updatedUser.name}" updated successfully!`);
      setEditingUserId(null);

      // Refresh users
      const updatedUsers = await apiFetch('/api/auth/users');
      setUsersList(updatedUsers);
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to update user role.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await apiFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE'
      });

      alert('User deleted successfully.');

      // Refresh users
      const updatedUsers = await apiFetch('/api/auth/users');
      setUsersList(updatedUsers);
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to delete user.');
    }
  };

  const startEditSite = (site: any) => {
    setEditingClinicalSiteId(site.id);
    setEditSiteName(site.name);
    setEditSiteTown(site.town || '');
    setEditSiteCountry(site.country || '');
    setEditSiteStudyCase(site.study_case || '');
    setEditSiteFile(null);
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClinicalSiteId) return;

    try {
      const performUpdate = async (base64Data?: string) => {
        try {
          const updatedSite = await apiFetch(`/api/sites/${editingClinicalSiteId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: editSiteName,
              town: editSiteTown,
              country: editSiteCountry,
              study_case: editSiteStudyCase,
              study_case_filename: editSiteFile ? editSiteFile.name : undefined,
              study_case_file_data: base64Data
            })
          });

          alert(`Site "${updatedSite.name}" updated successfully!`);
          setEditingClinicalSiteId(null);
          setEditSiteName('');
          setEditSiteTown('');
          setEditSiteCountry('');
          setEditSiteStudyCase('');
          setEditSiteFile(null);

          // Refresh sites list
          const updatedSites = await apiFetch('/api/sites');
          setSitesList(updatedSites);
        } catch (err: any) {
          console.warn(err);
          alert(err.message || 'Failed to update site.');
        }
      };

      if (editSiteFile) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result as string;
          await performUpdate(base64Data);
        };
        reader.onerror = () => {
          alert('Failed to read the file.');
        };
        reader.readAsDataURL(editSiteFile);
      } else {
        await performUpdate();
      }
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to process file.');
    }
  };

  const handleDeleteSite = async (siteId: number) => {
    if (!confirm('Are you sure you want to delete this clinical site? This will disassociate users and delete all patient registries associated with this site.')) {
      return;
    }

    try {
      const res = await apiFetch(`/api/sites/${siteId}`, {
        method: 'DELETE'
      });

      alert(res.message || 'Site deleted successfully!');
      
      // Refresh sites list
      const updatedSites = await apiFetch('/api/sites');
      setSitesList(updatedSites);
    } catch (err: any) {
      console.warn(err);
      alert(err.message || 'Failed to delete site.');
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
            Patients registered
          </span>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Enrolled / Consented</span>
            <Users style={{ color: 'var(--color-success)', width: '20px' }} />
          </div>
          <span className="stat-value">{stats.enrolledCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Signed consent forms
          </span>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Study Sites</span>
            <Building2 style={{ color: 'var(--color-info)', width: '20px' }} />
          </div>
          <span className="stat-value">{stats.sitesCount}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Clinical locations
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
            Forms submitted
          </span>
        </div>

        <div className="card stat-card" onClick={() => router.push('/patients')} style={{ cursor: 'pointer', borderLeft: stats.openQueriesCount > 0 ? '2px solid var(--color-error)' : 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-title">Open Queries</span>
            <AlertTriangle style={{ color: 'var(--color-error)', width: '20px' }} />
          </div>
          <span className="stat-value" style={{ color: stats.openQueriesCount > 0 ? 'var(--color-error)' : 'inherit' }}>
            {stats.openQueriesCount}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Discrepancy Notes
          </span>
        </div>
      </div>

      <div className="details-grid">
        {/* Active Queries List */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ color: 'var(--color-error)' }} />
            Active Discrepancy Notes (Queries)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeQueries.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No active field discrepancy queries.</p>
            ) : (
              activeQueries.map((query) => (
                <div key={query.id} style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderLeft: `3px solid ${query.status === 'RESOLVED' ? 'var(--color-success)' : 'var(--color-error)'}`,
                  borderRadius: '0 4px 4px 0',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>Subject PT-{String(query.patient_id).padStart(3, '0')} ({query.initials})</span>
                    <span className={`badge ${query.status === 'RESOLVED' ? 'badge-enrolled' : 'badge-screening'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                      {query.status}
                    </span>
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    Field: <strong>{query.field_name}</strong> in {query.form_type} ({query.event_name})
                  </p>
                  <p style={{ color: 'var(--color-text-main)', marginTop: '0.25rem' }}>
                    &ldquo;{query.description}&rdquo;
                  </p>
                  <button onClick={() => router.push(`/patients/${query.patient_id}`)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    Go to Form
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

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
                      <span style={{ fontWeight: 600 }}>{log.user_name}</span>
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

      {/* Admin User Management Section */}
      {user?.role === 'ADMIN' && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}>
            <Users style={{ width: '22px' }} />
            User Management & Role Attribution
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            {/* Left Column: Add New User Form */}
            <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
              <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Create New User Account</h4>
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Username</label>
                  <input
                    type="text"
                    required
                    placeholder="john_crc"
                    className="form-input"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="john@hospital.org"
                    className="form-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Role</label>
                    <select
                      className="form-input"
                      value={newRole}
                      onChange={(e: any) => setNewRole(e.target.value)}
                      style={{ fontSize: '0.85rem', background: '#0a0d1a', color: '#fff' }}
                    >
                      <option value="DATA_ENTRY">Investigator / CRC</option>
                      <option value="MONITOR">Monitor / CRA</option>
                      <option value="ADMIN">System Admin</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Clinical Site</label>
                    <select
                      className="form-input"
                      value={newSiteId}
                      onChange={(e) => setNewSiteId(e.target.value)}
                      style={{ fontSize: '0.85rem', background: '#0a0d1a', color: '#fff' }}
                    >
                      <option value="">Global/None</option>
                      {sitesList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                  Create User
                </button>
              </form>

              <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />

              {editingClinicalSiteId ? (
                <>
                  <h4 style={{ marginBottom: '1rem', fontWeight: 600, color: '#38bdf8' }}>Edit Clinical Site</h4>
                  <form onSubmit={handleUpdateSite} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Site Name</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={editSiteName}
                        onChange={(e) => setEditSiteName(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Town (City)</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={editSiteTown}
                          onChange={(e) => setEditSiteTown(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Country</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={editSiteCountry}
                          onChange={(e) => setEditSiteCountry(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Study Case (e.g. cancer, pneumonia)</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        value={editSiteStudyCase}
                        onChange={(e) => setEditSiteStudyCase(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Protocol Document (Leave blank to keep current)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.csv"
                        className="form-input"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setEditSiteFile(e.target.files[0]);
                          } else {
                            setEditSiteFile(null);
                          }
                        }}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                        Save Changes
                      </button>
                      <button type="button" onClick={() => setEditingClinicalSiteId(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Create New Clinical Site</h4>
                  <form onSubmit={handleAddSite} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Site Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Paris Saint-Louis Hospital"
                        className="form-input"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Town (City)</label>
                        <input
                          type="text"
                          required
                          placeholder="Paris"
                          className="form-input"
                          value={newSiteTown}
                          onChange={(e) => setNewSiteTown(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Country</label>
                        <input
                          type="text"
                          required
                          placeholder="France"
                          className="form-input"
                          value={newSiteCountry}
                          onChange={(e) => setNewSiteCountry(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Study Case (e.g. cancer, pneumonia)</label>
                      <input
                        type="text"
                        required
                        placeholder="Cancer Study"
                        className="form-input"
                        value={newSiteStudyCase}
                        onChange={(e) => setNewSiteStudyCase(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Protocol Document (PDF, Doc, txt)</label>
                      <input
                        id="site-file-input"
                        type="file"
                        required
                        accept=".pdf,.doc,.docx,.txt,.csv"
                        className="form-input"
                        onChange={handleFileChange}
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                      Create Site
                    </button>
                  </form>
                </>
              )}

              <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />

              <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Created Clinical Sites</h4>
              <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Site</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Study Case</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Protocol</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sitesList.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          No sites created.
                        </td>
                      </tr>
                    ) : (
                      sitesList.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.location}</div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span className="badge badge-enrolled" style={{ fontSize: '0.65rem' }}>
                              {s.study_case}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {s.study_case_file_url ? (
                              <a 
                                href={s.study_case_file_url} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                View File <ExternalLink style={{ width: '12px', height: '12px' }} />
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => startEditSite(s)}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSite(s.id)}
                              className="btn"
                              style={{
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.7rem',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--color-error)'
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: User Accounts List & Action Panel */}
            <div>
              <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Registered EDC User Accounts</h4>
              
              <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem' }}>User Info</th>
                      <th style={{ padding: '0.75rem' }}>Assigned Role & Site</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          No users registered.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => {
                        const isSelf = user?.id === u.id;
                        const isEditing = editingUserId === u.id;

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', background: isSelf ? 'rgba(30, 58, 138, 0.02)' : 'none' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ fontWeight: 600 }}>{u.name} {isSelf && '(You)'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>@{u.id} | {u.email}</div>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <select
                                    className="form-input"
                                    value={editingRole}
                                    onChange={(e: any) => setEditingRole(e.target.value)}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem', background: '#0a0d1a', color: '#fff' }}
                                  >
                                    <option value="DATA_ENTRY">Investigator</option>
                                    <option value="MONITOR">Monitor</option>
                                    <option value="ADMIN">Admin</option>
                                  </select>

                                  <select
                                    className="form-input"
                                    value={editingSiteId}
                                    onChange={(e) => setEditingSiteId(e.target.value)}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem', background: '#0a0d1a', color: '#fff' }}
                                  >
                                    <option value="">None/Global</option>
                                    {sitesList.map((s) => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <span className={`badge ${
                                    u.role === 'ADMIN' ? 'badge-completed' :
                                    u.role === 'MONITOR' ? 'badge-enrolled' :
                                    u.role === 'DATA_ENTRY' ? 'badge-in-progress' :
                                    'badge-screening'
                                  }`} style={{ fontSize: '0.65rem' }}>
                                    {u.role}
                                  </span>
                                  {u.site_id && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                                      Site: {sitesList.find(s => s.id === u.site_id)?.name || `Site #${u.site_id}`}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => handleUpdateUserRole(u.id)}
                                    className="btn btn-primary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => {
                                      setEditingUserId(u.id);
                                      setEditingRole(u.role);
                                      setEditingSiteId(u.site_id ? String(u.site_id) : '');
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                  >
                                    Edit
                                  </button>
                                  {!isSelf && (
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--color-error)' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
