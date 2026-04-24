// Migration 006: Normalize lead statuses per Alliance CRM Master Document Section 9.2
// Required: new, reviewing, qualified, needs_sponsor, blocked, rejected, converted
const pool = require('./connection');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Map old statuses to new ones
    await client.query(`UPDATE leads SET status = 'reviewing' WHERE status IN ('contacted', 'nurturing')`);
    await client.query(`UPDATE leads SET status = 'rejected' WHERE status IN ('disqualified', 'lost')`);
    await client.query(`UPDATE leads SET status = 'qualified' WHERE status = 'proposal'`);
    // 'new', 'qualified', 'converted' are already valid

    await client.query('COMMIT');
    console.log('Migration 006: Lead statuses normalized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 006 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
