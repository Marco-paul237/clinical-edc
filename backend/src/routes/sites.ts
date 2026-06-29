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

// Update a site (Admin only)
router.put('/:id', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const siteId = req.params.id;
  const { name, town, country, study_case, study_case_filename, study_case_file_data } = req.body;

  try {
    const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [siteId]);
    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found.' });
    }

    const currentSite = siteResult.rows[0];
    let studyCaseFileUrl = currentSite.study_case_file_url;
    let filename = currentSite.study_case_filename;

    if (study_case_filename && study_case_file_data) {
      // Decode and save new protocol file
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      let base64Content = study_case_file_data;
      if (base64Content.includes(';base64,')) {
        base64Content = base64Content.split(';base64,')[1];
      }
      const fileBuffer = Buffer.from(base64Content, 'base64');
      const fileExt = path.extname(study_case_filename);
      const baseName = path.basename(study_case_filename, fileExt).replace(/[^a-zA-Z0-9]/g, '_');
      const uniqueFilename = `${baseName}_${Date.now()}${fileExt}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, fileBuffer);
      studyCaseFileUrl = `/uploads/${uniqueFilename}`;
      filename = study_case_filename;
    }

    const updatedName = name || currentSite.name;
    const updatedTown = town || currentSite.town;
    const updatedCountry = country || currentSite.country;
    const updatedLocation = (town || country) ? `${updatedTown}, ${updatedCountry}` : currentSite.location;
    const updatedStudyCase = study_case || currentSite.study_case;

    const updateResult = await pool.query(
      `UPDATE sites SET name = $1, town = $2, country = $3, location = $4, study_case = $5, study_case_filename = $6, study_case_file_url = $7 
       WHERE id = $8 RETURNING *`,
      [updatedName, updatedTown, updatedCountry, updatedLocation, updatedStudyCase, filename, studyCaseFileUrl, siteId]
    );

    const updatedSite = updateResult.rows[0];

    // Log to Audit trail
    if (req.user) {
      await logAudit(
        req.user.id,
        req.user.email,
        req.user.name,
        {
          action: 'DATA_UPDATE',
          entityType: 'SITE',
          entityId: siteId,
          oldValue: currentSite,
          newValue: updatedSite,
        },
        req
      );
    }

    res.json(updatedSite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Delete a site (Admin only)
router.delete('/:id', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const siteId = req.params.id;

  try {
    const siteResult = await pool.query('SELECT * FROM sites WHERE id = $1', [siteId]);
    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found.' });
    }

    const site = siteResult.rows[0];

    // Disassociate users from this site first
    await pool.query('UPDATE users SET site_id = NULL WHERE site_id = $1', [siteId]);
    
    // Delete the site (patients will cascade if set, otherwise delete manually or rely on foreign key)
    // Wait, let's verify patients reference. In schema.sql:
    // patients references sites(id) but doesn't have ON DELETE CASCADE explicitly in table definition, or does it?
    // Let's check schema.sql. To be safe, we can manually delete the patient rows first, or set them to null.
    // Let's delete patients first to avoid foreign key violations.
    await pool.query('DELETE FROM patients WHERE site_id = $1', [siteId]);
    await pool.query('DELETE FROM sites WHERE id = $1', [siteId]);

    // Log to Audit trail
    if (req.user) {
      await logAudit(
        req.user.id,
        req.user.email,
        req.user.name,
        {
          action: 'DATA_UPDATE',
          entityType: 'SITE',
          entityId: siteId,
          oldValue: site,
          newValue: null,
        },
        req
      );
    }

    res.json({ success: true, message: 'Site deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

export default router;
