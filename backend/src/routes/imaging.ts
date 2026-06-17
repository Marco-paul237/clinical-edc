import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Get imaging scans for a patient
router.get('/patient/:patientId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const patientId = parseInt(req.params.patientId, 10);

  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM imaging_scans WHERE patient_id = $1 ORDER BY scan_date DESC',
      [patientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch imaging scans' });
  }
});

// De-identify a DICOM scan (Simulates stripping PHI metadata)
router.post('/deidentify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { scan_id } = req.body;

  if (!scan_id) {
    return res.status(400).json({ error: 'Scan ID is required' });
  }

  try {
    const scanId = parseInt(scan_id, 10);
    const scanResult = await pool.query('SELECT * FROM imaging_scans WHERE id = $1', [scanId]);
    if (scanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Imaging scan not found' });
    }

    const scan = scanResult.rows[0];

    // Simulate de-identification by deleting sensitive PHI headers
    const originalMetadata = { ...scan.metadata };
    const cleanedMetadata = { ...scan.metadata };
    delete cleanedMetadata.phi_patient_name;
    delete cleanedMetadata.phi_patient_id;
    cleanedMetadata.deidentified = true;
    cleanedMetadata.deidentified_at = new Date().toISOString();
    cleanedMetadata.deidentified_by = req.user.name;

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_UPDATE',
        entityType: 'FORM', // Relate to patient profile / forms area
        entityId: `SCAN-${scanId}`,
        oldValue: originalMetadata,
        newValue: cleanedMetadata
      },
      req
    );

    res.json({
      message: 'PHI metadata headers stripped successfully.',
      original: originalMetadata,
      deidentified: cleanedMetadata
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to de-identify scan' });
  }
});

// Run AI interpretation / segmentation on a de-identified scan
router.post('/ai-segment', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { scan_id } = req.body;

  if (!scan_id) {
    return res.status(400).json({ error: 'Scan ID is required' });
  }

  try {
    const scanId = parseInt(scan_id, 10);
    const scanResult = await pool.query('SELECT * FROM imaging_scans WHERE id = $1', [scanId]);
    if (scanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Imaging scan not found' });
    }

    const scan = scanResult.rows[0];

    // Simulate drawing segmentation boundaries & computing dimensions
    const segmentationResults = {
      scan_id: scanId,
      body_part: scan.metadata.body_part || 'BRAIN',
      lesion_volume_cc: scan.metadata.suggested_volume_cc || 5.8,
      lesion_max_diameter_mm: scan.metadata.suggested_max_diameter_mm || 22.4,
      ai_confidence: 0.942,
      segmented_slices: [3, 4, 5, 6, 7],
      boundingBox: { x: 142, y: 98, width: 44, height: 38 }
    };

    res.json(segmentationResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI interpretation pipeline failed' });
  }
});

// Import / upload a new medical scan
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { patient_id, scan_type, scan_date, slice_count, metadata, raw_image_url } = req.body;

  if (!patient_id || !scan_type || !scan_date || !slice_count || !metadata) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const patientId = parseInt(patient_id, 10);
    const sliceCount = parseInt(slice_count, 10);
    
    // Check if patient exists
    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    const isTumor = parsedMetadata.tumor_detected === true || parsedMetadata.tumor_detected === 'true';

    // Determine simulated raw_image_url
    let rawImageUrl = raw_image_url || 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600'; // Default MRI
    if (!raw_image_url) {
      if (scan_type.includes('X-Ray') || scan_type.includes('Radiography')) {
        rawImageUrl = 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=600';
      } else if (scan_type.includes('CT')) {
        rawImageUrl = 'https://images.unsplash.com/photo-1581090122319-8fab9528e3d4?auto=format&fit=crop&q=80&w=600';
      }
    }

    // Determine simulated AI analysis draft report (system_report)
    let systemReport = '';
    if (scan_type.includes('X-Ray') || scan_type.includes('Radiography')) {
      if (isTumor) {
        systemReport = `Automated AI Interpretation - Chest X-Ray:\n- Lungs: Detected a well-circumscribed lung nodule/opacity in the right middle zone measuring approximately ${parsedMetadata.suggested_max_diameter_mm || 12}mm.\n- Heart: Normal cardiac size and configuration.\n- Bones: Bony thorax appears intact.\n- Conclusion: Right lung nodule/opacity detected. AI confidence is 94.2%. Recommend clinical correlation.`;
      } else {
        systemReport = `Automated AI Interpretation - Chest X-Ray:\n- Lungs: Both lungs are clear. No evidence of consolidations, pleural effusions, or masses.\n- Heart: Normal cardiac size and silhouette.\n- Bones: Visualized bones are intact.\n- Conclusion: Normal radiographic findings. AI confidence is 98.7%.`;
      }
    } else if (scan_type.includes('CT')) {
      if (isTumor) {
        systemReport = `Automated AI Interpretation - Abdominal CT:\n- Liver: Detected a focal hypoattenuating lesion in Segment IV measuring approximately ${parsedMetadata.suggested_max_diameter_mm || 15}mm, volume ${parsedMetadata.suggested_volume_cc || 4.2}cc.\n- Kidneys: Normal bilateral kidney outline.\n- Conclusion: Segment IV hepatic lesion detected. AI confidence is 91.5%. Recommend MRI characterization.`;
      } else {
        systemReport = `Automated AI Interpretation - Abdominal CT:\n- Organs: Visualized abdominal viscera are within normal morphological limits.\n- Conclusion: No acute abdominal abnormalities detected. AI confidence is 97.2%.`;
      }
    } else {
      // MRI
      if (isTumor) {
        systemReport = `Automated AI Interpretation - Brain MRI:\n- Ventricles: Symmetrical and normal size.\n- Parenchyma: Detected a hyperintense T2/FLAIR lesion in the left temporal lobe measuring approximately ${parsedMetadata.suggested_max_diameter_mm || 22.4}mm, volume ${parsedMetadata.suggested_volume_cc || 5.8}cc.\n- Conclusion: Left temporal lobe hyperintense lesion. AI confidence is 94.2%. Differential includes low-grade glioma.`;
      } else {
        systemReport = `Automated AI Interpretation - Brain MRI:\n- Parenchyma: Brain parenchyma shows normal signal intensity throughout. No focal lesions.\n- Ventricles: Normal size and position.\n- Conclusion: Normal brain MRI study. AI confidence is 98.5%.`;
      }
    }

    const result = await pool.query(
      'INSERT INTO imaging_scans (patient_id, scan_type, scan_date, slice_count, metadata, raw_image_url, system_report, validated_report) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [patientId, scan_type, scan_date, sliceCount, parsedMetadata, rawImageUrl, systemReport, null]
    );

    const newScan = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_ENTRY',
        entityType: 'FORM', // Relate to patient profile
        entityId: `SCAN-${newScan.id}`,
        oldValue: null,
        newValue: newScan
      },
      req
    );

    res.status(201).json(newScan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload/import imaging scan' });
  }
});

// Validate & sign-off clinical findings report (Investigator role check)
router.post('/:scanId/validate', authenticateToken, requireRoles(['DATA_ENTRY', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const scanId = parseInt(req.params.scanId, 10);
  const { validated_report, signature_hash } = req.body;

  if (isNaN(scanId)) {
    return res.status(400).json({ error: 'Invalid scan ID' });
  }

  if (!validated_report || !signature_hash) {
    return res.status(400).json({ error: 'Validated report content and signature hash are required.' });
  }

  try {
    // Check if the scan exists
    const scanResult = await pool.query('SELECT * FROM imaging_scans WHERE id = $1', [scanId]);
    if (scanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Imaging scan not found' });
    }

    const scan = scanResult.rows[0];
    if (scan.is_validated) {
      return res.status(400).json({ error: 'This imaging scan report has already been validated and electronically sealed.' });
    }

    const validatedAt = new Date();
    const result = await pool.query(
      'UPDATE imaging_scans SET validated_report = $1, is_validated = TRUE, validated_by_id = $2, validated_at = $3, signature_hash = $4 WHERE id = $5 RETURNING *',
      [validated_report, req.user.id, validatedAt, signature_hash, scanId]
    );

    const updatedScan = result.rows[0];

    // Log to Audit Trail
    await logAudit(
      req.user.id,
      req.user.email,
      req.user.name,
      {
        action: 'DATA_UPDATE',
        entityType: 'FORM',
        entityId: `SCAN-${scanId}`,
        oldValue: { validated_report: scan.validated_report, is_validated: scan.is_validated, signature_hash: scan.signature_hash },
        newValue: { validated_report: updatedScan.validated_report, is_validated: updatedScan.is_validated, signature_hash: updatedScan.signature_hash, validated_at: validatedAt, validated_by_name: req.user.name }
      },
      req
    );

    res.json(updatedScan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to validate imaging scan report' });
  }
});

export default router;
