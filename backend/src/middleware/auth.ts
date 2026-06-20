import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import pool from '../db/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY';
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

  // Support local credentials session tokens (base64 encoded profiles)
  if (!token.includes('.')) {
    try {
      const decodedPayload = Buffer.from(token, 'base64').toString('utf-8');
      const localUser = JSON.parse(decodedPayload);
      
      if (!localUser.id || !localUser.role) {
        return res.status(403).json({ error: 'Invalid credentials token structure' });
      }

      // Check role constraints (excluding PATIENT)
      const allowedRoles = ['ADMIN', 'MONITOR', 'DATA_ENTRY'];
      if (!allowedRoles.includes(localUser.role)) {
        return res.status(403).json({ error: 'Forbidden: Invalid user role' });
      }

      req.user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role as 'ADMIN' | 'MONITOR' | 'DATA_ENTRY',
        site_id: localUser.site_id ? parseInt(localUser.site_id, 10) : null,
        patient_id: null
      };

      // Ensure user is in our database cache
      await syncUserToDb(req.user);
      return next();
    } catch (err) {
      return res.status(403).json({ error: 'Failed to parse local credentials token' });
    }
  }

  // Verify real Keycloak OIDC Token
  jwt.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded: any) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Invalid or expired OIDC access token' });
    }

    // Extract roles from realm_access
    const roles = decoded.realm_access?.roles || [];
    let mappedRole: 'ADMIN' | 'MONITOR' | 'DATA_ENTRY' = 'DATA_ENTRY';
    if (roles.includes('ADMIN')) mappedRole = 'ADMIN';
    else if (roles.includes('MONITOR')) mappedRole = 'MONITOR';
    else if (roles.includes('DATA_ENTRY')) mappedRole = 'DATA_ENTRY';

    // Extract site_id custom attribute
    const site_id = decoded.site_id ? parseInt(decoded.site_id, 10) : null;

    req.user = {
      id: decoded.sub,
      email: decoded.email || '',
      name: decoded.name || decoded.preferred_username || 'OIDC User',
      role: mappedRole,
      site_id,
      patient_id: null
    };

    // Auto-sync with local DB cache
    await syncUserToDb(req.user);
    next();
  });
};

// Check if user has one of the allowed roles
export const requireRoles = (allowedRoles: Array<'ADMIN' | 'MONITOR' | 'DATA_ENTRY'>) => {
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
