'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Check, 
  X, 
  Building, 
  Calendar, 
  User, 
  Eye, 
  Grid3X3, 
  List, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle 
} from 'lucide-react';

export default function PatientsPage() {
  const { user, apiFetch } = useAuth();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [formsMap, setFormsMap] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');
  const [error, setError] = useState<string | null>(null);

  // Form states for new patient
  const [initials, setInitials] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('Male');
  const [selectedSiteId, setSelectedSiteId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const patientList = await apiFetch('/api/patients');
      setPatients(patientList);
      
      const siteList = await apiFetch('/api/sites');
      setSites(siteList);

      try {
        const queriesList = await apiFetch('/api/queries');
        setQueries(queriesList);
      } catch (err) {
        // Fallback if queries table doesn't exist yet
      }

      // Pre-set site ID for form
      if (user?.site_id) {
        setSelectedSiteId(user.site_id.toString());
      } else if (siteList.length > 0) {
        setSelectedSiteId(siteList[0].id.toString());
      }

      // Fetch forms for each patient to resolve statuses
      const tempFormsMap: Record<number, any[]> = {};
      for (const p of patientList) {
        try {
          const forms = await apiFetch(`/api/forms/patient/${p.id}`);
          tempFormsMap[p.id] = forms;
        } catch (e) {
          tempFormsMap[p.id] = [];
        }
      }
      setFormsMap(tempFormsMap);
      
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch patients list');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSiteId = user?.site_id || (selectedSiteId ? parseInt(selectedSiteId, 10) : null);
    if (!initials || !birthDate || !gender || !targetSiteId) {
      alert('All fields are required, and a clinical study site must be active.');
      return;
    }

    try {
      await apiFetch('/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          initials,
          birth_date: birthDate,
          gender,
          site_id: targetSiteId
        })
      });

      // Clear states & reload
      setInitials('');
      setBirthDate('');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to register patient');
    }
  };

  // Resolve status for a specific visit event of a patient
  const getEventStatus = (patientId: number, eventName: string) => {
    const forms = formsMap[patientId] || [];
    const patientForms = forms.filter((f: any) => f.event_name === eventName);
    
    if (patientForms.length === 0) {
      return { code: 'NOT_STARTED', label: 'Scheduled', color: '#6b7280', icon: HelpCircle };
    }

    // Check if any form for this event is frozen
    const isFrozen = patientForms.some((f: any) => f.is_frozen);
    if (isFrozen) {
      return { code: 'LOCKED', label: 'Locked & Verified', color: '#6366f1', icon: Lock };
    }

    // Check for open/resolved discrepancy notes linked to forms in this event
    const formIds = patientForms.map((f: any) => f.id);
    const formQueries = queries.filter(q => formIds.includes(q.form_id));
    const hasUnresolved = formQueries.some(q => q.status === 'OPEN' || q.status === 'RESOLVED');

    if (hasUnresolved) {
      return { code: 'IN_PROGRESS', label: 'Data Queries Pending', color: '#f59e0b', icon: AlertTriangle };
    }

    return { code: 'COMPLETED', label: 'Entry Completed', color: '#10b981', icon: CheckCircle2 };
  };

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading study patients...</div>;
  }

  const showAddBtn = user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN';
  const studyEvents = ['Screening', 'Baseline', 'Week 4', 'Week 12'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Subject Registry</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {user?.role === 'DATA_ENTRY' 
              ? 'Site Patients case entry dashboard' 
              : 'Study Subjects case entry dashboard (All Sites)'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {/* View Toggle */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.25rem',
            display: 'flex',
            gap: '0.25rem'
          }}>
            <button 
              onClick={() => setViewMode('matrix')}
              className="btn btn-secondary"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                background: viewMode === 'matrix' ? 'rgba(20, 184, 166, 0.15)' : 'none',
                color: viewMode === 'matrix' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderColor: 'transparent'
              }}
            >
              <Grid3X3 style={{ width: '14px' }} />
              Event Matrix
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className="btn btn-secondary"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                background: viewMode === 'list' ? 'rgba(20, 184, 166, 0.15)' : 'none',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderColor: 'transparent'
              }}
            >
              <List style={{ width: '14px' }} />
              Subject List
            </button>
          </div>

          {showAddBtn && (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus style={{ width: '16px' }} />
              Register Subject
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' ? (
        <div>
          <div className="table-container">
            {patients.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No subjects registered for this study.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject ID</th>
                    <th>Initials</th>
                    <th>Site Location</th>
                    <th>Consent</th>
                    {studyEvents.map(event => (
                      <th key={event} style={{ textAlign: 'center', width: '140px' }}>
                        {event} Visit
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                        PT-{String(patient.id).padStart(3, '0')}
                      </td>
                      <td>{patient.initials}</td>
                      <td>{patient.site_name}</td>
                      <td>
                        {patient.consent_signed ? (
                          <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                            <Check style={{ width: '14px' }} />
                            Signed
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                            <X style={{ width: '14px' }} />
                            Pending
                          </span>
                        )}
                      </td>
                      
                      {studyEvents.map(event => {
                        const status = getEventStatus(patient.id, event);
                        const IconComponent = status.icon;
                        
                        return (
                          <td key={event} style={{ textAlign: 'center' }}>
                            <Link 
                              href={`/patients/${patient.id}?event=${event}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${status.color}40`,
                                color: status.color,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              title={`${event} Visit: ${status.label}`}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = `0 0 12px ${status.color}30`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <IconComponent style={{ width: '18px', height: '18px' }} />
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Matrix Legend */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Event Status Legend:
            </span>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#6b7280' }}>
                <HelpCircle style={{ width: '16px' }} /> Scheduled / Not Started
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b' }}>
                <AlertTriangle style={{ width: '16px' }} /> Active Queries / Discrepancy Note
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}>
                <CheckCircle2 style={{ width: '16px' }} /> Data Entry Completed
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#6366f1' }}>
                <Lock style={{ width: '16px' }} /> Form Verified & Frozen
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="table-container">
          {patients.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No subjects registered for this study yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Initials</th>
                  <th>Site Location</th>
                  <th>Birth Date</th>
                  <th>Gender</th>
                  <th>Consent Status</th>
                  <th>Study Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                      PT-{String(patient.id).padStart(3, '0')}
                    </td>
                    <td>{patient.initials}</td>
                    <td>{patient.site_name}</td>
                    <td>{new Date(patient.birth_date).toLocaleDateString()}</td>
                    <td>{patient.gender}</td>
                    <td>
                      {patient.consent_signed ? (
                        <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <Check style={{ width: '16px' }} />
                          Signed
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                          <X style={{ width: '16px' }} />
                          Pending
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        patient.status === 'ENROLLED' ? 'badge-enrolled' :
                        patient.status === 'COMPLETED' ? 'badge-completed' :
                        'badge-screening'
                      }`}>
                        {patient.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/patients/${patient.id}`} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        <Eye style={{ width: '14px' }} />
                        View CRF
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Registration Modal Overlay */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="card modal-content">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
              <Plus style={{ color: 'var(--color-primary)' }} />
              Register New Study Patient
            </h3>
            
            <form onSubmit={handleRegisterPatient}>
              <div className="form-group">
                <label className="form-label">Patient Initials (e.g. JB)</label>
                <input 
                  type="text" 
                  maxLength={4} 
                  required
                  placeholder="Initials"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value.toUpperCase())}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Birth Date</label>
                <input 
                  type="date" 
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Biological Gender</label>
                <select 
                  value={gender} 
                  onChange={(e) => setGender(e.target.value)}
                  className="form-select"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Study Site</label>
                {user?.site_id ? (
                  <input 
                    type="text" 
                    disabled 
                    className="form-input" 
                    value={sites.find(s => s.id === user.site_id)?.name || 'Loading Site Details...'} 
                  />
                ) : (
                  <div style={{ color: 'var(--color-error)', fontSize: '0.85rem', fontWeight: 500 }}>
                    Please select a study site from the top header banner to register patients.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!user?.site_id}>
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
