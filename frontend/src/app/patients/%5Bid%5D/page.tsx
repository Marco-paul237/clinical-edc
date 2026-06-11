'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { 
  FileText, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Activity, 
  FileCheck2, 
  Heart, 
  FileWarning, 
  AlertOctagon,
  Calendar,
  User,
  ShieldCheck,
  Edit2,
  ClipboardList
} from 'lucide-react';

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const patientId = parseInt(resolvedParams.id, 10);
  
  const { user, apiFetch } = useAuth();
  const router = useRouter();

  const [patient, setPatient] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consent Form Sign state
  const [consentInitials, setConsentInitials] = useState('');
  const [consentCheckbox, setConsentCheckbox] = useState(false);

  // New Form Entry state
  const [activeFormTab, setActiveFormTab] = useState<'NONE' | 'VITALS' | 'LABS' | 'ADVERSE_EVENTS'>('NONE');
  const [vitals, setVitals] = useState({ heartRate: '', bloodPressure: '', weight: '' });
  const [labs, setLabs] = useState({ wbc: '', rbc: '', glucose: '' });
  const [adverseEvent, setAdverseEvent] = useState({ eventName: '', severity: 'Mild', resolutionDate: '' });

  // Edit Mode state
  const [editingFormId, setEditingFormId] = useState<number | null>(null);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientData = await apiFetch(`/api/patients/${patientId}`);
      setPatient(patientData);
      
      const formsData = await apiFetch(`/api/forms/patient/${patientId}`);
      setForms(formsData);
      
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load patient records');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPatientData();
    }
  }, [user]);

  // Handle Informed Consent Signing (FDA 21 CFR Part 11 Compliant Signature Hash)
  const handleSignConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentInitials || !consentCheckbox) {
      alert('You must provide your initials and agree to the consent conditions.');
      return;
    }

    if (consentInitials !== patient.initials) {
      alert(`Signature mismatch. Initials must match patient initials (${patient.initials}).`);
      return;
    }

    // Generate a secure mock SHA-256 signature hash of the signee credentials + date
    const signeeString = `${patient.id}-${consentInitials}-${new Date().toISOString()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signeeString);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    try {
      const updatedPatient = await apiFetch(`/api/patients/${patientId}/consent`, {
        method: 'POST',
        body: JSON.stringify({ signatureHash })
      });
      setPatient(updatedPatient);
      alert('Informed Consent signed successfully. Study Case Report Form is now active.');
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to sign consent.');
    }
  };

  // Submit clinical form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let formData = {};
    if (activeFormTab === 'VITALS') {
      if (!vitals.heartRate || !vitals.bloodPressure || !vitals.weight) {
        alert('All vitals fields are required.');
        return;
      }
      formData = { heart_rate: vitals.heartRate, blood_pressure: vitals.bloodPressure, weight: vitals.weight };
    } else if (activeFormTab === 'LABS') {
      if (!labs.wbc || !labs.rbc || !labs.glucose) {
        alert('All lab fields are required.');
        return;
      }
      formData = { white_blood_cells: labs.wbc, red_blood_cells: labs.rbc, glucose: labs.glucose };
    } else if (activeFormTab === 'ADVERSE_EVENTS') {
      if (!adverseEvent.eventName || !adverseEvent.severity) {
        alert('Adverse Event details are required.');
        return;
      }
      formData = { event_name: adverseEvent.eventName, severity: adverseEvent.severity, resolution_date: adverseEvent.resolutionDate };
    }

    try {
      if (editingFormId) {
        // Update existing form
        await apiFetch(`/api/forms/${editingFormId}`, {
          method: 'PUT',
          body: JSON.stringify({ data: formData })
        });
        alert('Case Report Form updated successfully. Change history written to audit trail.');
      } else {
        // Create new form
        await apiFetch(`/api/forms/patient/${patientId}`, {
          method: 'POST',
          body: JSON.stringify({ form_type: activeFormTab, data: formData })
        });
        alert('Case Report Form submitted successfully.');
      }

      // Reset state
      setEditingFormId(null);
      setActiveFormTab('NONE');
      setVitals({ heartRate: '', bloodPressure: '', weight: '' });
      setLabs({ wbc: '', rbc: '', glucose: '' });
      setAdverseEvent({ eventName: '', severity: 'Mild', resolutionDate: '' });
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Submission failed.');
    }
  };

  // Freeze a Form (CRA/Monitor only)
  const handleFreezeForm = async (formId: number) => {
    if (!confirm('Are you sure you want to FREEZE this form? Once frozen, this record becomes read-only for study site staff.')) {
      return;
    }

    try {
      await apiFetch(`/api/forms/${formId}/freeze`, { method: 'POST' });
      alert('Data successfully verified and locked.');
      loadPatientData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Freeze action failed.');
    }
  };

  // Trigger Edit Form Mode
  const startEditForm = (form: any) => {
    setEditingFormId(form.id);
    setActiveFormTab(form.form_type);
    
    if (form.form_type === 'VITALS') {
      setVitals({
        heartRate: form.data.heart_rate || '',
        bloodPressure: form.data.blood_pressure || '',
        weight: form.data.weight || ''
      });
    } else if (form.form_type === 'LABS') {
      setLabs({
        wbc: form.data.white_blood_cells || '',
        rbc: form.data.red_blood_cells || '',
        glucose: form.data.glucose || ''
      });
    } else if (form.form_type === 'ADVERSE_EVENTS') {
      setAdverseEvent({
        eventName: form.data.event_name || '',
        severity: form.data.severity || 'Mild',
        resolutionDate: form.data.resolution_date || ''
      });
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)', padding: '2rem' }}>Loading Case Report Form (CRF)...</div>;
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-error)', color: 'var(--color-error)' }}>
        {error}
      </div>
    );
  }

  const isCrc = user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN';
  const isCra = user?.role === 'MONITOR' || user?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText style={{ color: 'var(--color-primary)' }} />
            Subject CRF Profile: PT-{String(patient.id).padStart(3, '0')}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Informed Consent & Case Report Form Registry
          </p>
        </div>
        <button onClick={() => router.push('/patients')} className="btn btn-secondary">
          Back to Registry
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Patient Details & Consent Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Patient Card */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Subject Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Initials:</span>
                <span style={{ fontWeight: 600 }}>{patient.initials}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Birth Date:</span>
                <span style={{ fontWeight: 600 }}>{new Date(patient.birth_date).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Gender:</span>
                <span style={{ fontWeight: 600 }}>{patient.gender}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Study Status:</span>
                <span className={`badge ${patient.status === 'ENROLLED' ? 'badge-enrolled' : 'badge-screening'}`}>
                  {patient.status}
                </span>
              </div>
            </div>
          </div>

          {/* E-Consent Card */}
          <div className="card" style={{
            borderLeft: patient.consent_signed ? '4px solid var(--color-success)' : '4px solid var(--color-warning)'
          }}>
            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck2 style={{ color: patient.consent_signed ? 'var(--color-success)' : 'var(--color-warning)' }} />
              Informed E-Consent
            </h3>

            {patient.consent_signed ? (
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  <ShieldCheck style={{ width: '18px' }} />
                  Digital Signatures Verified
                </div>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Signed on: <strong style={{ color: 'var(--color-text-main)' }}>{new Date(patient.consent_date).toLocaleString()}</strong>
                </p>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Signature Hash:
                </p>
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  wordBreak: 'break-all',
                  borderRadius: '4px',
                  marginTop: '0.25rem'
                }}>
                  {patient.consent_signature_hash}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                  FDA regulations require a signed Informed Consent form on archive before clinical data can be logged.
                </p>
                
                {/* Consent Signing Box (CRC or Patient only) */}
                {(user?.role === 'PATIENT' || user?.role === 'DATA_ENTRY' || user?.role === 'ADMIN') && (
                  <form onSubmit={handleSignConsent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      color: 'var(--color-text-muted)'
                    }}>
                      Study protocol RX-492: I hereby consent to participate in this study. I understand that my records will be fully audited under FDA 21 CFR Part 11 conditions.
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Sign with Initials (Must be: {patient.initials})</label>
                      <input 
                        type="text" 
                        maxLength={4}
                        required
                        className="form-input"
                        placeholder="Initials"
                        value={consentInitials}
                        onChange={(e) => setConsentInitials(e.target.value.toUpperCase())}
                      />
                    </div>

                    <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        required
                        style={{ marginTop: '2px' }}
                        checked={consentCheckbox}
                        onChange={(e) => setConsentCheckbox(e.target.checked)}
                      />
                      <span>I authorize this digital signature for study consent archiving.</span>
                    </label>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}>
                      Submit E-Consent
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CRF Data Entry Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Lock Cover if consent pending */}
          {!patient.consent_signed ? (
            <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <Lock style={{ width: '48px', height: '48px', color: 'var(--color-warning)', marginBottom: '1rem' }} />
              <h2 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Case Report Form Locked</h2>
              <p style={{ color: 'var(--color-text-muted)', maxWidth: '460px', margin: '0 auto' }}>
                Subject has not completed the Informed Consent protocol. Please sign consent in the left panel to unlock clinical database entries.
              </p>
            </div>
          ) : (
            <>
              {/* Add Clinical Data (CRC only) */}
              {isCrc && activeFormTab === 'NONE' && (
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)' }}>New Clinical Data Entry</h3>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => { setActiveFormTab('VITALS'); setEditingFormId(null); }} className="btn btn-secondary" style={{ flex: 1, gap: '0.75rem', padding: '1rem' }}>
                      <Heart style={{ color: 'var(--color-error)' }} />
                      Record Vitals
                    </button>
                    <button onClick={() => { setActiveFormTab('LABS'); setEditingFormId(null); }} className="btn btn-secondary" style={{ flex: 1, gap: '0.75rem', padding: '1rem' }}>
                      <Activity style={{ color: 'var(--color-info)' }} />
                      Record Labs
                    </button>
                    <button onClick={() => { setActiveFormTab('ADVERSE_EVENTS'); setEditingFormId(null); }} className="btn btn-secondary" style={{ flex: 1, gap: '0.75rem', padding: '1rem' }}>
                      <FileWarning style={{ color: 'var(--color-warning)' }} />
                      Log Adverse Event
                    </button>
                  </div>
                </div>
              )}

              {/* Form Entry Panel */}
              {activeFormTab !== 'NONE' && (
                <div className="card" style={{ border: '1px solid var(--color-primary)' }}>
                  <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                    {editingFormId ? 'Edit Case Report Form' : 'New Case Report Form'}: {activeFormTab}
                  </h3>

                  <form onSubmit={handleSubmitForm}>
                    {activeFormTab === 'VITALS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Heart Rate (bpm)</label>
                          <input 
                            type="number" required placeholder="e.g. 72" className="form-input"
                            value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Blood Pressure (mmHg)</label>
                          <input 
                            type="text" required placeholder="e.g. 120/80" className="form-input"
                            value={vitals.bloodPressure} onChange={(e) => setVitals({...vitals, bloodPressure: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Weight (kg)</label>
                          <input 
                            type="number" step="0.1" required placeholder="e.g. 74.5" className="form-input"
                            value={vitals.weight} onChange={(e) => setVitals({...vitals, weight: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {activeFormTab === 'LABS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">White Blood Cells (x10^9/L)</label>
                          <input 
                            type="number" step="0.01" required placeholder="e.g. 6.5" className="form-input"
                            value={labs.wbc} onChange={(e) => setLabs({...labs, wbc: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Red Blood Cells (x10^12/L)</label>
                          <input 
                            type="number" step="0.01" required placeholder="e.g. 4.8" className="form-input"
                            value={labs.rbc} onChange={(e) => setLabs({...labs, rbc: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Glucose (mg/dL)</label>
                          <input 
                            type="number" required placeholder="e.g. 95" className="form-input"
                            value={labs.glucose} onChange={(e) => setLabs({...labs, glucose: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    {activeFormTab === 'ADVERSE_EVENTS' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Event Description</label>
                          <input 
                            type="text" required placeholder="e.g. Severe Headache" className="form-input"
                            value={adverseEvent.eventName} onChange={(e) => setAdverseEvent({...adverseEvent, eventName: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Severity Level</label>
                          <select 
                            className="form-select" value={adverseEvent.severity}
                            onChange={(e) => setAdverseEvent({...adverseEvent, severity: e.target.value})}
                          >
                            <option value="Mild">Mild</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Severe">Severe</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Resolution Date (Optional)</label>
                          <input 
                            type="date" className="form-input"
                            value={adverseEvent.resolutionDate} onChange={(e) => setAdverseEvent({...adverseEvent, resolutionDate: e.target.value})}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <button type="button" onClick={() => setActiveFormTab('NONE')} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        {editingFormId ? 'Save Case Changes' : 'Submit Clinical Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* CRF Entry Logs Timeline */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList />
                  Subject Case Report Form (CRF) Timeline
                </h3>

                {forms.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    No clinical entries logged for this subject.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {forms.map((form) => (
                      <div key={form.id} style={{
                        padding: '1.25rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,255,255,0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        position: 'relative'
                      }}>
                        {/* Lock / Unlock Icon Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ color: 'var(--color-primary)' }}>{form.form_type}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              ID: CRF-{form.id} | Logged: {new Date(form.created_at).toLocaleString()}
                            </span>
                          </div>

                          {form.is_frozen ? (
                            <span className="badge badge-frozen" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                              <Lock style={{ width: '12px' }} />
                              VERIFIED & FROZEN
                            </span>
                          ) : (
                            <span className="badge badge-screening" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                              <Unlock style={{ width: '12px' }} />
                              UNLOCKED
                            </span>
                          )}
                        </div>

                        {/* Form Body Data display */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '1rem',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '1rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          {form.form_type === 'VITALS' && (
                            <>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>Heart Rate:</span> <strong>{form.data.heart_rate} bpm</strong></div>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>Blood Pressure:</span> <strong>{form.data.blood_pressure} mmHg</strong></div>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>Weight:</span> <strong>{form.data.weight} kg</strong></div>
                            </>
                          )}
                          {form.form_type === 'LABS' && (
                            <>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>WBC:</span> <strong>{form.data.white_blood_cells} x10^9/L</strong></div>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>RBC:</span> <strong>{form.data.red_blood_cells} x10^12/L</strong></div>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>Glucose:</span> <strong>{form.data.glucose} mg/dL</strong></div>
                            </>
                          )}
                          {form.form_type === 'ADVERSE_EVENTS' && (
                            <>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Event:</span> 
                                <strong style={{ color: form.data.severity === 'Severe' ? 'var(--color-error)' : 'inherit' }}> {form.data.event_name}</strong>
                              </div>
                              <div><span style={{ color: 'var(--color-text-muted)' }}>Severity:</span> <strong>{form.data.severity}</strong></div>
                              <div>
                                <span style={{ color: 'var(--color-text-muted)' }}>Resolution Date:</span> 
                                <strong> {form.data.resolution_date ? new Date(form.data.resolution_date).toLocaleDateString() : 'Active'}</strong>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Audit info and actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <span>Entered by: {form.entered_by_name || 'System Cache'}</span>
                          
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* Edit Button (CRC only, if not frozen) */}
                            {isCrc && !form.is_frozen && (
                              <button onClick={() => startEditForm(form)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>
                                <Edit2 style={{ width: '12px' }} />
                                Edit Form
                              </button>
                            )}

                            {/* Freeze Button (CRA only, if not frozen) */}
                            {isCra && !form.is_frozen && (
                              <button onClick={() => handleFreezeForm(form.id)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>
                                <Lock style={{ width: '12px' }} />
                                Verify & Freeze
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
