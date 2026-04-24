// Migration 004: Expand deal paths per Alliance CRM Master Document Section 9.4
const pool = require('./connection');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove duplicate deal paths (keep lowest id for each name)
    await client.query(`
      DELETE FROM deal_paths WHERE id NOT IN (
        SELECT MIN(id) FROM deal_paths GROUP BY LOWER(path_name)
      )
    `);

    // Add unique constraint if not exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_paths_path_name_key') THEN
          ALTER TABLE deal_paths ADD CONSTRAINT deal_paths_path_name_key UNIQUE (path_name);
        END IF;
      END $$;
    `);

    // Rename existing paths to match spec
    await client.query(`UPDATE deal_paths SET path_name = 'advisory-only', description = 'Strategic advisory and consulting engagement' WHERE LOWER(path_name) IN ('advisory', 'advisory-only')`);
    await client.query(`UPDATE deal_paths SET path_name = 'white-label-distribution', description = 'White-label product distribution through partner channels' WHERE LOWER(path_name) IN ('white-label', 'white-label-distribution')`);

    // Insert missing deal paths
    const newPaths = [
      ['internal-incubation', 'Internal product/service incubation within the alliance'],
      ['partner-enablement', 'Enabling partner capabilities through training, tools, or integration'],
    ];

    for (const [name, desc] of newPaths) {
      await client.query(
        `INSERT INTO deal_paths (path_name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [name, desc]
      );
    }

    // Ensure all 8 required paths exist (insert if missing due to inconsistent seeds)
    const requiredPaths = [
      ['referral', 'Lead sourced through referral partner'],
      ['co-sell', 'Joint selling with shared responsibilities'],
      ['reseller', 'Partner resells alliance products/services'],
      ['implementation', 'Alliance implements partner product at client'],
    ];
    for (const [name, desc] of requiredPaths) {
      await client.query(
        `INSERT INTO deal_paths (path_name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [name, desc]
      );
    }

    await client.query('COMMIT');
    console.log('Migration 004: Deal paths expanded to 8');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 004 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
