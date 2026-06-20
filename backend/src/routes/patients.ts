import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Get list of patients (Row-Level Security / ABAC Enforced)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let result;
    if (req.user.role === 'DATA_ENTRY') {
      // CRCs can only see patients at their assigned site
      if (!req.user.site_id) {
        return res.status(400).json({ error: 'User does not have an assigned site' });
      }
      result = await pool.query(
        'SELECT p.*, s.name as site_name FROM patients p JOIN sites s ON p.site_id = s.id WHERE p.site_id = $1 ORDER BY p.id DESC',
        [req.user.site_id]
      );
    } else {
      // Admins and CRAs/Monitors can see all patients
      result = await pool.query(
        'SELECT p.*, s.name as site_name FROM patients p JOIN sites s ON p.site_id = s.id ORDER BY p.id DESC'
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get a single patient's details
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.id, 10);

  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    const result = await pool.query(
      'SELECT p.*, s.name as site_name FROM patients p JOIN sites s ON p.site_id = s.id WHERE p.id = $1',
      [patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = result.rows[0];

    // Enforce Row-Level Security
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC cannot view patients from other sites' });
    }

    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// Create a new patient (CRC/DATA_ENTRY only)
router.post('/', authenticateToken, requireRoles(['DATA_ENTRY', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { initials, birth_date, gender, site_id } = req.body;

  if (!initials || !birth_date || !gender || !site_id) {
    return res.status(400).json({ error: 'Initials, birth date, gender, and site ID are required' });
  }

  // Enforce that CRC can only register patients for their own site
  const targetSiteId = parseInt(site_id, 10);
  if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== targetSiteId) {
    return res.status(403).json({ error: 'Access denied: CRC can only create patients for their own site' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO patients (site_id, initials, birth_date, gender, status) VALUES ($1, $2, $3, $4, \'SCREENING\') RETURNING *',
      [targetSiteId, initials, birth_date, gender]
    );
    const newPatient = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_ENTRY',
        entityType: 'PATIENT',
        entityId: newPatient.id.toString(),
        newValue: newPatient,
      },
      req
    );

    res.status(201).json(newPatient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create patient record' });
  }
});

// Sign Informed Consent (Patient or CRC on behalf of patient)
router.post('/:id/consent', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.id, 10);
  const { signatureHash } = req.body;

  if (!signatureHash) {
    return res.status(400).json({ error: 'Consent signature hash is required' });
  }

  try {
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Enforce Access Control
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }

    const updateResult = await pool.query(
      `UPDATE patients 
       SET consent_signed = TRUE, consent_date = CURRENT_TIMESTAMP, consent_signature_hash = $1, status = 'ENROLLED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [signatureHash, patientId]
    );

    const updatedPatient = updateResult.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'CONSENT_SIGN',
        entityType: 'PATIENT',
        entityId: patientId.toString(),
        oldValue: patient,
        newValue: updatedPatient,
      },
      req
    );

    res.json(updatedPatient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign consent' });
  }
});

export default router;
