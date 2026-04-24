// Migration 003: Expand Main Sales Pipeline stages to 13 per Alliance CRM Master Document Section 9.3
const pool = require('./connection');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update existing stages in Main Sales Pipeline (pipeline_id=1)
    // Current: 1=Qualification, 2=Discovery, 3=Proposal, 4=Negotiation, 5=Closed Won, 6=Closed Lost

    // Rename and reorder existing stages
    await client.query(`UPDATE stages SET stage_name = 'Registered', stage_order = 1, probability_default = 5 WHERE pipeline_id = 1 AND stage_order = 1`);
    // Discovery stays as stage_order 2
    await client.query(`UPDATE stages SET stage_order = 2, probability_default = 10 WHERE pipeline_id = 1 AND stage_name = 'Discovery'`);
    // Rename Proposal -> Qualified
    await client.query(`UPDATE stages SET stage_name = 'Qualified', stage_order = 3, probability_default = 20 WHERE pipeline_id = 1 AND stage_order = 3`);
    // Rename Negotiation -> Commercial Negotiation, move to order 8
    await client.query(`UPDATE stages SET stage_name = 'Commercial Negotiation', stage_order = 8, probability_default = 70 WHERE pipeline_id = 1 AND stage_order = 4`);
    // Closed Won moves to order 11
    await client.query(`UPDATE stages SET stage_order = 11, probability_default = 100 WHERE pipeline_id = 1 AND is_closed_won = true`);
    // Closed Lost moves to order 12
    await client.query(`UPDATE stages SET stage_order = 12, probability_default = 0 WHERE pipeline_id = 1 AND is_closed_lost = true`);

    // Insert new stages for Main Sales Pipeline
    const newStages = [
      { name: 'Solution Match', order: 4, prob: 30 },
      { name: 'Demo / Workshop', order: 5, prob: 40 },
      { name: 'Proposal Drafting', order: 6, prob: 50 },
      { name: 'Proposal Sent', order: 7, prob: 60 },
      { name: 'Legal / Compliance Review', order: 9, prob: 80 },
      { name: 'Verbal Commit', order: 10, prob: 90 },
      { name: 'On Hold', order: 13, prob: 0 },
    ];

    for (const s of newStages) {
      await client.query(
        `INSERT INTO stages (pipeline_id, stage_name, stage_order, is_closed_won, is_closed_lost, probability_default)
         VALUES (1, $1, $2, false, false, $3)
         ON CONFLICT DO NOTHING`,
        [s.name, s.order, s.prob]
      );
    }

    await client.query('COMMIT');
    console.log('Migration 003: Stages expanded to 13 for Main Sales Pipeline');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 003 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
