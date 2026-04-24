/**
 * Migration 010: Create meeting_notes and advisory_requests tables
 */
const pool = require('./connection');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Meeting Notes
    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        meeting_date TIMESTAMP DEFAULT NOW(),
        attendees TEXT,
        summary TEXT,
        action_items TEXT,
        related_type VARCHAR(100),
        related_id INTEGER,
        visibility_level VARCHAR(50) DEFAULT 'internal',
        created_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Advisory Requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS advisory_requests (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        requested_by_user_id INTEGER REFERENCES users(id),
        assigned_to_user_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        related_type VARCHAR(100),
        related_id INTEGER,
        response TEXT,
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('Migration 010: Created meeting_notes and advisory_requests tables');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 010 failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
