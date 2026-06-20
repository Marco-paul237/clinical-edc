import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';
import fs from 'fs';
import path from 'path';

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
  const { name, town, country, study_case, study_case_filename, study_case_file_data } = req.body;

  if (!name || !town || !country || !study_case || !study_case_filename || !study_case_file_data) {
    return res.status(400).json({ error: 'Name, town, country, study case, and protocol document are required' });
  }

  try {
    // 1. Process and save the protocol file
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Extract raw base64 content
    let base64Content = study_case_file_data;
    if (base64Content.includes(';base64,')) {
      base64Content = base64Content.split(';base64,')[1];
    }
    const fileBuffer = Buffer.from(base64Content, 'base64');

    // Create a safe, unique filename
    const fileExt = path.extname(study_case_filename);
    const baseName = path.basename(study_case_filename, fileExt).replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueFilename = `${baseName}_${Date.now()}${fileExt}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    fs.writeFileSync(filePath, fileBuffer);
    const studyCaseFileUrl = `/uploads/${uniqueFilename}`;

    // 2. Insert site into database
    const result = await pool.query(
      `INSERT INTO sites (name, town, country, location, study_case, study_case_filename, study_case_file_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, town, country, `${town}, ${country}`, study_case, study_case_filename, studyCaseFileUrl]
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
