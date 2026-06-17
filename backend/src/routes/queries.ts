import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Fetch active discrepancy notes/queries (Site RLS filtered for CRCs)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let result;
    if (req.user.role === 'DATA_ENTRY') {
      if (!req.user.site_id) {
        return res.status(400).json({ error: 'User does not have an assigned site' });
      }
      result = await pool.query(
        `SELECT q.*, f.form_type, f.event_name, p.id as patient_id, p.initials, p.site_id,
                u.name as created_by_name, ur.name as resolved_by_name
         FROM queries q
         JOIN clinical_forms f ON q.form_id = f.id
         JOIN patients p ON f.patient_id = p.id
         LEFT JOIN users u ON q.created_by_id = u.id
         LEFT JOIN users ur ON q.resolved_by_id = ur.id
         WHERE p.site_id = $1 ORDER BY q.created_at DESC`,
        [req.user.site_id]
      );
    } else {
      // Admins and Monitors can see all discrepancy queries
      result = await pool.query(
        `SELECT q.*, f.form_type, f.event_name, p.id as patient_id, p.initials, p.site_id,
                u.name as created_by_name, ur.name as resolved_by_name
         FROM queries q
         JOIN clinical_forms f ON q.form_id = f.id
         JOIN patients p ON f.patient_id = p.id
         LEFT JOIN users u ON q.created_by_id = u.id
         LEFT JOIN users ur ON q.resolved_by_id = ur.id
         ORDER BY q.created_at DESC`
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch discrepancy queries' });
  }
});

// Fetch queries linked to a specific Case Report Form (CRF)
router.get('/form/:formId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const formId = parseInt(req.params.formId, 10);

  if (isNaN(formId)) {
    return res.status(400).json({ error: 'Invalid form ID' });
  }

  try {
    // RLS: Check site boundaries before returning queries
    const formResult = await pool.query('SELECT * FROM clinical_forms WHERE id = $1', [formId]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    const form = formResult.rows[0];
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [form.patient_id]);
    const patient = patientResult.rows[0];

    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }

    const result = await pool.query(
      `SELECT q.*, u.name as created_by_name, ur.name as resolved_by_name
       FROM queries q
       LEFT JOIN users u ON q.created_by_id = u.id
       LEFT JOIN users ur ON q.resolved_by_id = ur.id
       WHERE q.form_id = $1 ORDER BY q.created_at ASC`,
      [formId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch form queries' });
  }
});

// Open a new discrepancy query (Monitor/CRA only)
router.post('/', authenticateToken, requireRoles(['MONITOR', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { form_id, field_name, description } = req.body;

  if (!form_id || !field_name || !description) {
    return res.status(400).json({ error: 'Form ID, field name, and query description are required' });
  }

  const formId = parseInt(form_id, 10);

  try {
    const formResult = await pool.query('SELECT * FROM clinical_forms WHERE id = $1', [formId]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Clinical form not found' });
    }

    const result = await pool.query(
      `INSERT INTO queries (form_id, field_name, description, created_by_id, status)
       VALUES ($1, $2, $3, $4, 'OPEN') RETURNING *`,
      [formId, field_name, description, req.user.id]
    );
    const newQuery = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_UPDATE',
        entityType: 'FORM',
        entityId: formId.toString(),
        newValue: { action: 'QUERY_OPEN', query: newQuery }
      },
      req
    );

    res.status(201).json(newQuery);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create discrepancy query' });
  }
});

// Resolve (CRC/DATA_ENTRY) or Close (CRA/MONITOR) a query
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const queryId = parseInt(req.params.id, 10);
  const { resolution, status } = req.body;

  if (!status || !['RESOLVED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (RESOLVED or CLOSED) is required' });
  }

  try {
    const queryResult = await pool.query('SELECT * FROM queries WHERE id = $1', [queryId]);
    if (queryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    const query = queryResult.rows[0];
    const formResult = await pool.query('SELECT * FROM clinical_forms WHERE id = $1', [query.form_id]);
    const form = formResult.rows[0];
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [form.patient_id]);
    const patient = patientResult.rows[0];

    // Enforce Site Boundaries for CRC
    if (req.user.role === 'DATA_ENTRY' && req.user.site_id !== patient.site_id) {
      return res.status(403).json({ error: 'Access denied: CRC site mismatch' });
    }

    // Role Checks
    if (status === 'RESOLVED') {
      if (req.user.role !== 'DATA_ENTRY' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only CRC data entry staff can submit a query resolution response' });
      }
      if (!resolution) {
        return res.status(400).json({ error: 'Resolution explanation text is required' });
      }

      const updateResult = await pool.query(
        `UPDATE queries 
         SET resolution = $1, status = 'RESOLVED', resolved_by_id = $2, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [resolution, req.user.id, queryId]
      );
      const resolvedQuery = updateResult.rows[0];

      // Audit log it
      await logAudit(
        req.user.id,
        req.user.email,
        req.user.name,
        {
          action: 'DATA_UPDATE',
          entityType: 'FORM',
          entityId: form.id.toString(),
          oldValue: query,
          newValue: resolvedQuery
        },
        req
      );

      return res.json(resolvedQuery);
    } 
    
    if (status === 'CLOSED') {
      if (req.user.role !== 'MONITOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only CRA Monitors can close / resolve discrepancy queries' });
      }

      const updateResult = await pool.query(
        `UPDATE queries 
         SET status = 'CLOSED', resolved_by_id = $1, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [req.user.id, queryId]
      );
      const closedQuery = updateResult.rows[0];

      // Audit log it
      await logAudit(
        req.user.id,
        req.user.email,
        req.user.name,
        {
          action: 'DATA_UPDATE',
          entityType: 'FORM',
          entityId: form.id.toString(),
          oldValue: query,
          newValue: closedQuery
        },
        req
      );

      return res.json(closedQuery);
    }

    res.status(400).json({ error: 'Invalid update action' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update discrepancy query' });
  }
});

export default router;
