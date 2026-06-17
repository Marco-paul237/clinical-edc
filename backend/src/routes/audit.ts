import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Fetch all audit logs (CRA and ADMIN only)
router.get('/', authenticateToken, requireRoles(['MONITOR', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { action, entityType, entityId, search } = req.query;

  try {
    let queryText = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      queryText += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (entityType) {
      queryText += ` AND entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    if (entityId) {
      queryText += ` AND entity_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }

    if (search) {
      queryText += ` AND (user_name ILIKE $${paramIndex} OR user_email ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryText += ' ORDER BY timestamp DESC LIMIT 200';

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve audit trail logs' });
  }
});

// Trigger a biostatistical export (Monitors/Admins only) and log the export event to the audit trail
router.post('/export', authenticateToken, requireRoles(['MONITOR', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Query data in CDISC-like format (Anonymized: no names/emails, only patient initials, birth dates, site, clinical forms data)
    const result = await pool.query(`
      SELECT 
        p.id as patient_id, 
        p.initials, 
        p.birth_date, 
        p.gender, 
        p.status, 
        s.name as site_name,
        f.form_type, 
        f.data as form_data,
        f.is_frozen
      FROM patients p
      JOIN sites s ON p.site_id = s.id
      LEFT JOIN clinical_forms f ON p.id = f.patient_id
      ORDER BY p.id ASC
    `);

    // Log the export action (Critical compliance log - tracks who exported PHI-free datasets)
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'EXPORT',
        entityType: 'SITE',
        entityId: 'ALL',
        newValue: { record_count: result.rows.length }
      },
      req
    );

    res.json({
      exportedAt: new Date().toISOString(),
      format: 'CDISC SDTM Mock Dataset',
      records: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export trial dataset' });
  }
});

// Fetch safety alerts (MONITOR and ADMIN only)
router.get('/safety-alerts', authenticateToken, requireRoles(['MONITOR', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM safety_alerts ORDER BY dispatched_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve safety alerts' });
  }
});

export default router;
