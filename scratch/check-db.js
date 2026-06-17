const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/edc',
});

async function run() {
  try {
    console.log('Querying sites...');
    const sitesRes = await pool.query('SELECT * FROM sites');
    console.log('Sites:', sitesRes.rows);

    console.log('Querying patients...');
    const patientsRes = await pool.query('SELECT * FROM patients');
    console.log('Patients:', patientsRes.rows);

    console.log('Querying users...');
    const usersRes = await pool.query('SELECT id, email, role, site_id FROM users');
    console.log('Users:', usersRes.rows);
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
