import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import { eventBroker } from '../eventBroker';

const router = Router();

// Get all clinical forms for a patient
router.get('/patient/:patientId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.patientId, 10);

  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    // Check if patient exists and enforce Row-Level Security
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }
    if (req.user.role === 'PATIENT' && req.user.patient_id !== patient.id.toString()) {
      return res.status(403).json({ error: 'Access denied: Cannot view other patient forms' });
    }

    const formsResult = await pool.query(
      'SELECT f.*, u.name as entered_by_name FROM clinical_forms f LEFT JOIN users u ON f.entered_by_id = u.id WHERE f.patient_id = $1 ORDER BY f.id ASC',
      [patientId]
    );

    res.json(formsResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patient forms' });
  }
});

// Create a new clinical form (CRC/DATA_ENTRY only)
router.post('/patient/:patientId', authenticateToken, requireRoles(['DATA_ENTRY', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.patientId, 10);
  const { form_type, event_name, data } = req.body;

  if (!form_type || !data) {
    return res.status(400).json({ error: 'Form type and data are required' });
  }

  const eventName = event_name || (form_type === 'ADVERSE_EVENTS' ? 'Adverse Event' : 'Screening');
  if (!['Screening', 'Baseline', 'Week 4', 'Week 12', 'Adverse Event'].includes(eventName)) {
    return res.status(400).json({ error: 'Invalid event name' });
  }

  try {
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Enforce CRC site boundaries
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }

    // Enforce GCP compliance: Informed consent must be signed before entering clinical data
    if (!patient.consent_signed) {
      return res.status(400).json({ error: 'Compliance Violation: Patient must sign Informed Consent before clinical data entry.' });
    }

    const result = await pool.query(
      `INSERT INTO clinical_forms (patient_id, event_name, form_type, entered_by_id, data) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, eventName, form_type, req.user.id, JSON.stringify(data)]
    );
    const newForm = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_ENTRY',
        entityType: 'FORM',
        entityId: newForm.id.toString(),
        newValue: newForm,
      },
      req
    );

    // Emit real-time safety pipeline event if Severe adverse event
    if (form_type === 'ADVERSE_EVENTS' && data.severity === 'Severe') {
      try {
        eventBroker.emit('severe_adverse_event', { form: newForm, user: req.user });
      } catch (e) {
        console.error('Failed to emit severe_adverse_event', e);
      }
    }

    res.status(201).json(newForm);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit clinical form' });
  }
});

// Update a clinical form (CRC/DATA_ENTRY only, only if not frozen)
router.put('/:id', authenticateToken, requireRoles(['DATA_ENTRY', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const formId = parseInt(req.params.id, 10);
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Data is required for updates' });
  }

  try {
    const formResult = await pool.query('SELECT * FROM clinical_forms WHERE id = $1', [formId]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clinical form not found' });
    }

    const form = formResult.rows[0];

    // Check if form is frozen (Compliance Lock)
    if (form.is_frozen) {
      return res.status(403).json({ error: 'Access Denied: This form has been frozen by a CRA and cannot be modified.' });
    }

    // Check site boundaries
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [form.patient_id]);
    const patient = patientResult.rows[0];
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }

    const result = await pool.query(
      `UPDATE clinical_forms 
       SET data = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(data), formId]
    );
    const updatedForm = result.rows[0];

    // Log old vs new value to Audit Trail (FDA 21 CFR Part 11)
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_UPDATE',
        entityType: 'FORM',
        entityId: formId.toString(),
        oldValue: form,
        newValue: updatedForm,
      },
      req
    );

    res.json(updatedForm);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update clinical form' });
  }
});

// Freeze a clinical form (CRA/Monitor/MONITOR only)
router.post('/:id/freeze', authenticateToken, requireRoles(['MONITOR', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const formId = parseInt(req.params.id, 10);

  try {
    const formResult = await pool.query('SELECT * FROM clinical_forms WHERE id = $1', [formId]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clinical form not found' });
    }

    const form = formResult.rows[0];

    if (form.is_frozen) {
      return res.status(400).json({ error: 'Form is already frozen' });
    }

    const result = await pool.query(
      `UPDATE clinical_forms 
       SET is_frozen = TRUE, frozen_by_id = $1, frozen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [req.user.id, formId]
    );
    const frozenForm = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_FREEZE',
        entityType: 'FORM',
        entityId: formId.toString(),
        oldValue: form,
        newValue: frozenForm,
      },
      req
    );

    res.json(frozenForm);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to freeze form' });
  }
});

export default router;
