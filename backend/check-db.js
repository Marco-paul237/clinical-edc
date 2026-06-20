const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/edc',
});

async function run() {
  try {
    console.log('Testing insert into sites...');
    const insertRes = await pool.query(
      'INSERT INTO sites (name, town, country, location) VALUES ($1, $2, $3, $4) RETURNING *',
      ['Test Clinic', 'Test Town', 'Test Country', 'Test Town, Test Country']
    );
    console.log('Insert result:', insertRes.rows);

    console.log('Querying sites...');
    const sitesRes = await pool.query('SELECT * FROM sites');
    console.log('Sites:', sitesRes.rows);

    // Clean up
    await pool.query('DELETE FROM sites WHERE name = $1', ['Test Clinic']);
  } catch (err) {
    console.error('Database query error:', err);
  } finally {
    await pool.end();
  }
}

run();
