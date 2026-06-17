import { Router, Request, Response } from 'express';
import pool from '../db/db';

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
  const { username, email, password, role, site_id, new_site_name, new_site_location } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields (username, email, password, role) are required.' });
  }

  const allowedRoles = ['ADMIN', 'MONITOR', 'DATA_ENTRY', 'PATIENT'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
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

    // Set site_id dynamically
    let siteId: number | null = null;
    if (new_site_name && new_site_location) {
      const siteResult = await pool.query(
        'INSERT INTO sites (name, location) VALUES ($1, $2) RETURNING *',
        [new_site_name.trim(), new_site_location.trim()]
      );
      siteId = siteResult.rows[0].id;
    } else if (site_id) {
      siteId = parseInt(site_id, 10);
    }

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
      patient_id: newUser.role === 'PATIENT' ? '1' : null
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
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
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
      patient_id: user.role === 'PATIENT' ? '1' : null
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

export default router;
