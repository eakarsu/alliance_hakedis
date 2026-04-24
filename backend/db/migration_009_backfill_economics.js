/**
 * Migration 009: Backfill economics from existing opportunity_revenue_shares
 * Creates economic_entries + commercial_share_entries from revenue share data
 */
const pool = require('./connection');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if both tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'opportunity_revenue_shares') AS has_shares,
             EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'economic_entries') AS has_econ
    `);

    if (!tableCheck.rows[0].has_shares || !tableCheck.rows[0].has_econ) {
      console.log('Migration 009: Required tables not found, skipping backfill');
      await client.query('COMMIT');
      return;
    }

    // Get all revenue shares grouped by opportunity (skip already backfilled)
    const shares = await client.query(`
      SELECT ors.*, o.opportunity_name, o.estimated_total_value
      FROM opportunity_revenue_shares ors
      JOIN opportunities o ON o.id = ors.opportunity_id
      WHERE NOT EXISTS (
        SELECT 1 FROM economic_entries ee
        WHERE ee.opportunity_id = ors.opportunity_id
        AND ee.entry_type = 'commercial'
      )
      ORDER BY ors.opportunity_id
    `);

    if (shares.rows.length === 0) {
      console.log('Migration 009: No revenue shares to backfill (already done or none exist)');
      await client.query('COMMIT');
      return;
    }

    // Group by opportunity
    const byOpp = {};
    for (const share of shares.rows) {
      if (!byOpp[share.opportunity_id]) byOpp[share.opportunity_id] = [];
      byOpp[share.opportunity_id].push(share);
    }

    let entryCount = 0;
    let shareCount = 0;

    for (const [oppId, oppShares] of Object.entries(byOpp)) {
      const firstShare = oppShares[0];

      // Map payout_status to lifecycle_stage
      let lifecycleStage = 'draft';
      if (firstShare.payout_status === 'paid') lifecycleStage = 'paid';
      else if (firstShare.payout_status === 'approved') lifecycleStage = 'approved';
      else if (firstShare.payout_status === 'pending') lifecycleStage = 'proposed';

      const basisAmount = parseFloat(firstShare.estimated_total_value) || 0;

      // Create economic_entry (using actual column names from migration_007)
      const entryResult = await client.query(
        `INSERT INTO economic_entries (opportunity_id, entry_type, lifecycle_stage, total_basis_amount, basis_type, currency, created_by_user_id)
         VALUES ($1, 'commercial', $2, $3, 'total_value', 'USD', 1)
         RETURNING id`,
        [oppId, lifecycleStage, basisAmount]
      );
      entryCount++;
      const entryId = entryResult.rows[0].id;

      // Create commercial_share_entries
      for (const share of oppShares) {
        const calcAmount = parseFloat(share.calc_amount) || (basisAmount * parseFloat(share.share_percent || 0) / 100);
        await client.query(
          `INSERT INTO commercial_share_entries (economic_entry_id, beneficiary_user_id, beneficiary_entity_id, role_type, share_percent, calculated_amount, final_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            entryId,
            share.beneficiary_user_id,
            share.beneficiary_entity_id,
            share.share_type || 'deal_owner',
            share.share_percent || 0,
            calcAmount,
            calcAmount,
            lifecycleStage === 'paid' ? 'paid' : 'pending',
          ]
        );
        shareCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`Migration 009: Backfilled ${entryCount} economic entries with ${shareCount} share lines`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 009 failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
