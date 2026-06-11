import { Request } from 'express';
import pool from '../db/db';

export interface AuditDetails {
  action: 'LOGIN' | 'DATA_ENTRY' | 'DATA_UPDATE' | 'DATA_FREEZE' | 'EXPORT' | 'CONSENT_SIGN';
  entityType: 'PATIENT' | 'FORM' | 'USER' | 'SITE' | 'SESSION';
  entityId: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
}

export const logAudit = async (
  userId: string,
  userEmail: string,
  userName: string,
  details: AuditDetails,
  req?: Request
) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null : null;
    const userAgent = req ? req.headers['user-agent'] || null : null;

    await pool.query(
      `INSERT INTO audit_logs (user_id, user_email, user_name, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        userEmail,
        userName,
        details.action,
        details.entityType,
        details.entityId,
        details.oldValue ? JSON.stringify(details.oldValue) : null,
        details.newValue ? JSON.stringify(details.newValue) : null,
        ipAddress,
        userAgent,
      ]
    );
    console.log(`[AUDIT] Action: ${details.action} | Entity: ${details.entityType} (${details.entityId}) | By: ${userEmail}`);
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};
