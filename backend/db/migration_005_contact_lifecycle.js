// Migration 005: Add contact lifecycle_state per Alliance CRM Master Document Section 9.1
const pool = require('./connection');

async function run() {
  try {
    await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(50) DEFAULT 'new'`);
    // Valid values: new, known, qualified_relationship, active_prospect, customer, partner, dormant, restricted
    console.log('Migration 005: Contact lifecycle_state column added');
  } catch (err) {
    console.error('Migration 005 failed:', err);
    throw err;
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
