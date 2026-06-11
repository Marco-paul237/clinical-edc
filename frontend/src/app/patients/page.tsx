'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { Plus, Check, X, Building, Calendar, User, Eye, ClipboardList } from 'lucide-react';

export default function PatientsPage() {
  const { user, apiFetch } = useAuth();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

      // Pre-set site ID for form
      if (user?.role === 'DATA_ENTRY' && user.site_id) {
        setSelectedSiteId(user.site_id.toString());
      } else if (siteList.length > 0) {
        setSelectedSiteId(siteList[0].id.toString());
      }
      
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
    if (!initials || !birthDate || !gender || !selectedSiteId) {
      alert('All fields are required');
      return;
    }

    try {
      await apiFetch('/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          initials,
          birth_date: birthDate,
          gender,
          site_id: parseInt(selectedSiteId, 10)
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

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading study patients...</div>;
  }

  const showAddBtn = user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Patients</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {user?.role === 'DATA_ENTRY' 
              ? 'Assigned Patient Records (Restricted to Local Site)' 
              : 'Study Patient Records (All Sites)'}
          </p>
        </div>

        {showAddBtn && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus style={{ width: '16px' }} />
            Register Patient
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Patients Table */}
      <div className="table-container">
        {patients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No patients registered for this study yet.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
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
                {user?.role === 'DATA_ENTRY' ? (
                  <select disabled className="form-select" value={selectedSiteId}>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    value={selectedSiteId} 
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="form-select"
                  >
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
