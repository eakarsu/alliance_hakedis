/**
 * Migration 008: Attachments table (Section 7)
 * Polymorphic file storage linked to any entity via related_type/related_id
 */
const pool = require('./connection');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        related_type VARCHAR(50) NOT NULL,
        related_id INTEGER NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        storage_path VARCHAR(1000) NOT NULL,
        uploaded_by_user_id INTEGER REFERENCES users(id),
        visibility_level VARCHAR(50) DEFAULT 'team',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_related
        ON attachments(related_type, related_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by
        ON attachments(uploaded_by_user_id);
    `);

    await client.query('COMMIT');
    console.log('Migration 008: Attachments table created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 008 failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
