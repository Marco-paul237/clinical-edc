'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { History, ShieldAlert, Search, RefreshCw, Download } from 'lucide-react';

export default function AuditTrailPage() {
  const { user, apiFetch } = useAuth();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      let queryPath = '/api/audit?';
      if (actionFilter) queryPath += `action=${actionFilter}&`;
      if (entityFilter) queryPath += `entityType=${entityFilter}&`;
      if (searchQuery) queryPath += `search=${encodeURIComponent(searchQuery)}&`;

      const auditLogs = await apiFetch(queryPath);
      setLogs(auditLogs);
      setLoading(false);
    } catch (err: any) {
      console.warn(err);
      setError(err.message || 'Failed to fetch audit logs');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'MONITOR' || user.role === 'ADMIN')) {
      loadLogs();
    }
  }, [user, actionFilter, entityFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const downloadAuditTrail = () => {
    // Generate JSON download
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sdtm_audit_trail_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!user || (user.role !== 'MONITOR' && user.role !== 'ADMIN')) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)' }}>
        Access Denied: Insufficient authorization to view study audit trail files.
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History style={{ color: 'var(--color-primary)' }} />
            Regulatory Audit Trail
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            FDA 21 CFR Part 11 & GCP Immutable Compliance Records
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadLogs} className="btn btn-secondary">
            <RefreshCw style={{ width: '16px' }} />
            Reload
          </button>
          <button onClick={downloadAuditTrail} className="btn btn-primary">
            <Download style={{ width: '16px' }} />
            Download Trail
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <label className="form-label">Search User / Action</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search user, action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
              <button type="submit" style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer'
              }}>
                <Search style={{ width: '18px' }} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ width: '160px', marginBottom: 0 }}>
            <label className="form-label">Action</label>
            <select 
              className="form-select" 
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="DATA_ENTRY">DATA_ENTRY</option>
              <option value="DATA_UPDATE">DATA_UPDATE</option>
              <option value="DATA_FREEZE">DATA_FREEZE</option>
              <option value="EXPORT">EXPORT</option>
              <option value="CONSENT_SIGN">CONSENT_SIGN</option>
            </select>
          </div>

          <div className="form-group" style={{ width: '160px', marginBottom: 0 }}>
            <label className="form-label">Entity Type</label>
            <select 
              className="form-select" 
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="">All Entities</option>
              <option value="PATIENT">PATIENT</option>
              <option value="FORM">FORM</option>
              <option value="SITE">SITE</option>
              <option value="SESSION">SESSION</option>
            </select>
          </div>
        </form>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Terminal View */}
      <div className="audit-terminal">
        {loading ? (
          <p>Scanning security log channels...</p>
        ) : logs.length === 0 ? (
          <p>-- End of trail. No compliance entries matching search credentials. --</p>
        ) : (
          logs.map((log) => {
            const dateStr = new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19);
            
            return (
              <div key={log.id} className="audit-log-line">
                <div>
                  <span className="audit-timestamp">[{dateStr}]</span>
                  <span className="audit-action">{log.action}</span>
                  <span className="audit-meta">
                    by <strong>{log.user_name}</strong> ({log.user_email}) 
                    on {log.entity_type} ID: {log.entity_id} 
                    {log.ip_address && ` from IP: ${log.ip_address}`}
                  </span>
                </div>
                
                {/* Diff box if changes happened */}
                {(log.old_value || log.new_value) && (
                  <div className="audit-diff">
                    {log.old_value && (
                      <div style={{ color: 'var(--color-error)', display: 'flex', gap: '0.5rem' }}>
                        <span>[-]</span>
                        <pre style={{ margin: 0, fontFamily: 'inherit' }}>
                          OLD: {JSON.stringify(log.old_value.data || log.old_value)}
                        </pre>
                      </div>
                    )}
                    {log.new_value && (
                      <div style={{ color: 'var(--color-success)', display: 'flex', gap: '0.5rem' }}>
                        <span>[+]</span>
                        <pre style={{ margin: 0, fontFamily: 'inherit' }}>
                          NEW: {JSON.stringify(log.new_value.data || log.new_value)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
