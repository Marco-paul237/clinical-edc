import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Get all sites
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM sites ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Create a new site (Admin only)
router.post('/', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { name, location } = req.body;

  if (!name || !location) {
    return res.status(400).json({ error: 'Name and location are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING *',
      [name, location]
    );
    const newSite = result.rows[0];

    // Log to Audit trail
    if (req.user) {
      await logAudit(
        req.user.id,
        req.user.email,
        req.user.name,
        {
          action: 'DATA_ENTRY',
          entityType: 'SITE',
          entityId: newSite.id.toString(),
          newValue: newSite,
        },
        req
      );
    }

    res.status(201).json(newSite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

export default router;
