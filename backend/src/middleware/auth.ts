import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import pool from '../db/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY' | 'PATIENT';
    site_id?: number | null;
    patient_id?: string | null;
  };
}

const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8081';
const realm = process.env.KEYCLOAK_REALM || 'edc-realm';
const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;

const client = jwksRsa({
  jwksUri,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err || new Error('No signing key found'));
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

// Automatically sync user metadata from token into local DB cache
async function syncUserToDb(user: { id: string; email: string; name: string; role: string; site_id?: number | null }) {
  try {
    await pool.query(
      `INSERT INTO users (id, email, name, role, site_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE 
       SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, site_id = EXCLUDED.site_id`,
      [user.id, user.email, user.name, user.role, user.site_id || null]
    );
  } catch (err) {
    console.error('Failed to sync user to database cache:', err);
  }
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Support Mock IAM Mode
  if (process.env.USE_MOCK_IAM === 'true') {
    try {
      // For developer convenience, mock tokens can be standard base64 encoded JSON objects
      const decodedPayload = Buffer.from(token, 'base64').toString('utf-8');
      const mockUser = JSON.parse(decodedPayload);
      
      if (!mockUser.id || !mockUser.role) {
        return res.status(403).json({ error: 'Invalid mock token structure' });
      }

      req.user = {
        id: mockUser.id,
        email: mockUser.email || 'mock@trial.com',
        name: mockUser.name || 'Mock User',
        role: mockUser.role,
        site_id: mockUser.site_id ? parseInt(mockUser.site_id, 10) : null,
        patient_id: mockUser.patient_id || null
      };

      // Ensure user is in our database cache
      await syncUserToDb(req.user);
      return next();
    } catch (err) {
      // If it is not base64 JSON, try parsing as direct string identifier for ease of testing
      const testUsers: Record<string, any> = {
        'mock-admin': { id: 'mock-admin', email: 'admin@trial.com', name: 'System Admin', role: 'ADMIN', site_id: null },
        'mock-crc-1': { id: 'mock-crc-1', email: 'crc1@site1.org', name: 'John CRC Site 1', role: 'DATA_ENTRY', site_id: 1 },
        'mock-crc-2': { id: 'mock-crc-2', email: 'crc2@site2.org', name: 'Jane CRC Site 2', role: 'DATA_ENTRY', site_id: 2 },
        'mock-cra': { id: 'mock-cra', email: 'cra@sponsor.com', name: 'Alice CRA Monitor', role: 'MONITOR', site_id: null },
        'mock-patient-1': { id: 'mock-patient-1', email: 'patient1@home.com', name: 'Robert Patient 1', role: 'PATIENT', site_id: 1 }
      };

      if (testUsers[token]) {
        req.user = testUsers[token];
        await syncUserToDb(req.user!);
        return next();
      }

      return res.status(403).json({ error: 'Failed to parse mock authorization token' });
    }
  }

  // Verify real Keycloak OIDC Token
  jwt.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded: any) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Invalid or expired OIDC access token' });
    }

    // Extract roles from realm_access
    const roles = decoded.realm_access?.roles || [];
    let mappedRole: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY' | 'PATIENT' = 'PATIENT';
    if (roles.includes('ADMIN')) mappedRole = 'ADMIN';
    else if (roles.includes('MONITOR')) mappedRole = 'MONITOR';
    else if (roles.includes('DATA_ENTRY')) mappedRole = 'DATA_ENTRY';
    else if (roles.includes('PATIENT')) mappedRole = 'PATIENT';

    // Extract site_id and patient_id custom attributes
    const site_id = decoded.site_id ? parseInt(decoded.site_id, 10) : null;
    const patient_id = decoded.patient_id || null;

    req.user = {
      id: decoded.sub,
      email: decoded.email || '',
      name: decoded.name || decoded.preferred_username || 'OIDC User',
      role: mappedRole,
      site_id,
      patient_id
    };

    // Auto-sync with local DB cache
    await syncUserToDb(req.user);
    next();
  });
};

// Check if user has one of the allowed roles
export const requireRoles = (allowedRoles: Array<'ADMIN' | 'MONITOR' | 'DATA_ENTRY' | 'PATIENT'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }

    next();
  };
};
