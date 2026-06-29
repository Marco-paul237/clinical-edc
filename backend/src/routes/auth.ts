import { Router, Request, Response } from 'express';
import pool from '../db/db';
import { authenticateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all sites publicly for registration selection
router.get('/sites', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM sites ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Sign Up
router.post('/signup', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields (username, email, password) are required.' });
  }

  try {
    // Check if username (id) or email already exists
    const checkResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 OR email = $2',
      [username.toLowerCase().trim(), email.toLowerCase().trim()]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username or Email is already registered.' });
    }

    // Backdoor signup strictly registers ADMIN users with no site assignment
    const role = 'ADMIN';
    const siteId = null;

    // Human readable name from username
    const name = username.charAt(0).toUpperCase() + username.slice(1);

    // Insert user into database
    const insertResult = await pool.query(
      'INSERT INTO users (id, email, name, role, site_id, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [username.toLowerCase().trim(), email.toLowerCase().trim(), name, role, siteId, password]
    );

    const newUser = insertResult.rows[0];

    // Prepare profile representation without password
    const userProfile = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      site_id: newUser.site_id,
      patient_id: null
    };

    // Generate base64 mock token
    const jsonStr = JSON.stringify(userProfile);
    const token = Buffer.from(jsonStr, 'utf-8').toString('base64');

    res.status(201).json({ user: userProfile, token });
  } catch (err) {
    console.error('Sign up error:', err);
    res.status(500).json({ error: 'Internal server error during sign up.' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR id = $2',
      [email.toLowerCase().trim(), email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Simple password check (plaintext for mock/dev environment)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Prepare profile
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      site_id: user.site_id,
      patient_id: null
    };

    // Generate base64 mock token
    const jsonStr = JSON.stringify(userProfile);
    const token = Buffer.from(jsonStr, 'utf-8').toString('base64');

    res.json({ user: userProfile, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, site_id, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin add user (Admin only)
router.post('/users', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { username, email, password, role, site_id } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Username, email, password, and role are required.' });
  }

  const allowedRoles = ['ADMIN', 'MONITOR', 'DATA_ENTRY'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }

  try {
    const checkResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 OR email = $2',
      [username.toLowerCase().trim(), email.toLowerCase().trim()]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username or Email is already registered.' });
    }

    const siteId = site_id ? parseInt(site_id, 10) : null;
    const name = username.charAt(0).toUpperCase() + username.slice(1);

    const insertResult = await pool.query(
      'INSERT INTO users (id, email, name, role, site_id, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, site_id, created_at',
      [username.toLowerCase().trim(), email.toLowerCase().trim(), name, role, siteId, password]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error('Admin add user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Admin update user role & site (Admin only)
router.put('/users/:id/role', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;
  const { role, site_id } = req.body;

  const allowedRoles = ['ADMIN', 'MONITOR', 'DATA_ENTRY'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentRole = role || userResult.rows[0].role;
    const currentSiteId = site_id !== undefined ? (site_id ? parseInt(site_id, 10) : null) : userResult.rows[0].site_id;

    const updateResult = await pool.query(
      'UPDATE users SET role = $1, site_id = $2 WHERE id = $3 RETURNING id, email, name, role, site_id, created_at',
      [currentRole, currentSiteId, userId]
    );

    res.json(updateResult.rows[0]);
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

// Admin delete user (Admin only)
router.delete('/users/:id', authenticateToken, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.id;

  if (req.user?.id === userId) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

export default router;
