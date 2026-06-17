import { Router, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Process synchronization batch from an offline Edge Node
router.post('/sync', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { forms, auditLogs } = req.body;

  if (!Array.isArray(forms) || !Array.isArray(auditLogs)) {
    return res.status(400).json({ error: 'Sync payload must contain forms and auditLogs arrays' });
  }

  const syncResults = {
    syncedFormsCount: 0,
    syncedLogsCount: 0,
    conflictsResolvedCount: 0,
    ignoredCount: 0
  };

  try {
    // Process offline forms
    for (const edgeForm of forms) {
      const { patient_id, event_name, form_type, data, created_at, updated_at } = edgeForm;
      const edgeUpdatedAt = new Date(updated_at || created_at).getTime();

      // Check if a form already exists for this event and type (to prevent duplication)
      const existingResult = await pool.query(
        'SELECT * FROM clinical_forms WHERE patient_id = $1 AND event_name = $2 AND form_type = $3',
        [patient_id, event_name, form_type]
      );

      if (existingResult.rows.length > 0) {
        // Conflict resolution: Check timestamps
        const cloudForm = existingResult.rows[0];
        const cloudUpdatedAt = new Date(cloudForm.updated_at || cloudForm.created_at).getTime();

        if (edgeUpdatedAt > cloudUpdatedAt) {
          // Edge is newer: overwrite cloud data
          await pool.query(
            `UPDATE clinical_forms 
             SET data = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify(data), cloudForm.id]
          );
          syncResults.conflictsResolvedCount++;
          syncResults.syncedFormsCount++;

          // Log conflict resolution to cloud audit trail
          await logAudit(
            req.user.id,
            req.user.email,
            req.user.name,
            {
              action: 'DATA_UPDATE',
              entityType: 'FORM',
              entityId: cloudForm.id.toString(),
              oldValue: cloudForm,
              newValue: { ...cloudForm, data, updated_at: new Date() }
            },
            req
          );
        } else {
          // Cloud is newer: ignore edge form
          syncResults.ignoredCount++;
        }
      } else {
        // Insert new clinical form
        const insertResult = await pool.query(
          `INSERT INTO clinical_forms (patient_id, event_name, form_type, entered_by_id, data, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            patient_id,
            event_name,
            form_type,
            req.user.id,
            JSON.stringify(data),
            created_at ? new Date(created_at) : new Date(),
            updated_at ? new Date(updated_at) : new Date()
          ]
        );
        syncResults.syncedFormsCount++;

        // Audit log the newly synced form
        const newForm = insertResult.rows[0];
        await logAudit(
          req.user.id,
          req.user.email,
          req.user.name,
          {
            action: 'DATA_ENTRY',
            entityType: 'FORM',
            entityId: newForm.id.toString(),
            newValue: newForm
          },
          req
        );
      }
    }

    // Process offline audit logs
    for (const log of auditLogs) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, user_email, user_name, action, entity_type, entity_id, old_value, new_value, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          log.user_id || req.user.id,
          log.user_email || req.user.email,
          log.user_name || req.user.name,
          `${log.action}_OFFLINE_SYNC`,
          log.entity_type,
          log.entity_id,
          log.old_value ? JSON.stringify(log.old_value) : null,
          log.new_value ? JSON.stringify(log.new_value) : null,
          log.timestamp ? new Date(log.timestamp) : new Date()
        ]
      );
      syncResults.syncedLogsCount++;
    }

    res.json({
      message: 'Synchronization batch processed successfully.',
      results: syncResults
    });
  } catch (err) {
    console.error('Edge synchronization failed:', err);
    res.status(500).json({ error: 'Edge synchronization pipeline failed' });
  }
});

export default router;
