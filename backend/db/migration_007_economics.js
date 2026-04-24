// Migration 007: Economics & Shadow Ledger tables
// Per Alliance CRM Master Document Section 10
const pool = require('./connection');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Split Templates (normalized replacement for revenue_share_templates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS split_templates (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(100) NOT NULL,
        deal_path_type VARCHAR(50),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by_user_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Split Template Lines
    await client.query(`
      CREATE TABLE IF NOT EXISTS split_template_lines (
        id SERIAL PRIMARY KEY,
        template_id INT NOT NULL REFERENCES split_templates(id) ON DELETE CASCADE,
        role_type VARCHAR(100) NOT NULL,
        share_percent DECIMAL(5,2) NOT NULL,
        share_basis VARCHAR(100) DEFAULT 'total_value',
        notes TEXT
      )
    `);

    // 3. Economic Entries (header for both commercial and shadow)
    await client.query(`
      CREATE TABLE IF NOT EXISTS economic_entries (
        id SERIAL PRIMARY KEY,
        opportunity_id INT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        entry_type VARCHAR(50) NOT NULL,
        lifecycle_stage VARCHAR(50) NOT NULL DEFAULT 'draft',
        template_id INT REFERENCES split_templates(id),
        total_basis_amount DECIMAL(15,2),
        basis_type VARCHAR(50) DEFAULT 'total_value',
        currency VARCHAR(10) DEFAULT 'USD',
        effective_date DATE,
        approved_by_user_id INT REFERENCES users(id),
        approved_at TIMESTAMP,
        notes TEXT,
        created_by_user_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_economic_entries_opp ON economic_entries(opportunity_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_economic_entries_stage ON economic_entries(lifecycle_stage)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_economic_entries_type ON economic_entries(entry_type)`);

    // 4. Commercial Share Entries (per-beneficiary split lines)
    await client.query(`
      CREATE TABLE IF NOT EXISTS commercial_share_entries (
        id SERIAL PRIMARY KEY,
        economic_entry_id INT NOT NULL REFERENCES economic_entries(id) ON DELETE CASCADE,
        beneficiary_user_id INT REFERENCES users(id),
        beneficiary_entity_id INT REFERENCES partner_entities(id),
        role_type VARCHAR(100),
        share_percent DECIMAL(5,2),
        calculated_amount DECIMAL(15,2),
        override_amount DECIMAL(15,2),
        final_amount DECIMAL(15,2),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commercial_shares_entry ON commercial_share_entries(economic_entry_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commercial_shares_user ON commercial_share_entries(beneficiary_user_id)`);

    // 5. Shadow Ledger Entries
    await client.query(`
      CREATE TABLE IF NOT EXISTS shadow_ledger_entries (
        id SERIAL PRIMARY KEY,
        economic_entry_id INT NOT NULL REFERENCES economic_entries(id) ON DELETE CASCADE,
        contributor_user_id INT NOT NULL REFERENCES users(id),
        contribution_type VARCHAR(100),
        description TEXT,
        estimated_value DECIMAL(15,2),
        actual_value DECIMAL(15,2),
        deserved_amount DECIMAL(15,2),
        lifecycle_stage VARCHAR(50) DEFAULT 'planned',
        evidence_summary TEXT,
        reviewed_by_user_id INT REFERENCES users(id),
        reviewed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shadow_ledger_entry ON shadow_ledger_entries(economic_entry_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shadow_ledger_user ON shadow_ledger_entries(contributor_user_id)`);

    // 6. Economic Entry Stage History (audit trail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS economic_entry_stage_history (
        id SERIAL PRIMARY KEY,
        economic_entry_id INT NOT NULL REFERENCES economic_entries(id) ON DELETE CASCADE,
        from_stage VARCHAR(50),
        to_stage VARCHAR(50) NOT NULL,
        changed_by_user_id INT REFERENCES users(id),
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stage_history_entry ON economic_entry_stage_history(economic_entry_id)`);

    // 7. Contribution Evidence
    await client.query(`
      CREATE TABLE IF NOT EXISTS contribution_evidence (
        id SERIAL PRIMARY KEY,
        shadow_entry_id INT NOT NULL REFERENCES shadow_ledger_entries(id) ON DELETE CASCADE,
        evidence_type VARCHAR(50),
        title VARCHAR(255),
        document_url TEXT,
        description TEXT,
        submitted_by_user_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 8. Payout Transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS payout_transactions (
        id SERIAL PRIMARY KEY,
        commercial_share_id INT REFERENCES commercial_share_entries(id),
        shadow_entry_id INT REFERENCES shadow_ledger_entries(id),
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(50),
        payment_reference VARCHAR(255),
        payment_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        processed_by_user_id INT REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payout_commercial ON payout_transactions(commercial_share_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payout_shadow ON payout_transactions(shadow_entry_id)`);

    // 9. Approval Workflows (general-purpose, polymorphic)
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id SERIAL PRIMARY KEY,
        related_type VARCHAR(100) NOT NULL,
        related_id INT NOT NULL,
        workflow_type VARCHAR(50) NOT NULL,
        current_step INT DEFAULT 1,
        total_steps INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        requested_by_user_id INT REFERENCES users(id),
        assigned_to_user_id INT REFERENCES users(id),
        approved_by_user_id INT REFERENCES users(id),
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_related ON approval_workflows(related_type, related_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_workflows(status)`);

    // Seed default split templates
    const templates = [
      { name: 'Referral Standard', path: 'referral', desc: 'Standard split for referral deals', lines: [
        { role: 'source_owner', pct: 10, basis: 'total_value' },
        { role: 'deal_owner', pct: 15, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
      { name: 'Co-Sell Standard', path: 'co-sell', desc: 'Standard split for co-sell deals', lines: [
        { role: 'source_owner', pct: 15, basis: 'total_value' },
        { role: 'deal_owner', pct: 20, basis: 'total_value' },
        { role: 'technical_partner', pct: 10, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
      { name: 'Reseller Standard', path: 'reseller', desc: 'Standard split for reseller deals', lines: [
        { role: 'deal_owner', pct: 25, basis: 'total_value' },
        { role: 'product_owner', pct: 15, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
      { name: 'Implementation Standard', path: 'implementation', desc: 'Standard split for implementation deals', lines: [
        { role: 'delivery_owner', pct: 20, basis: 'total_value' },
        { role: 'technical_partner', pct: 15, basis: 'total_value' },
        { role: 'deal_owner', pct: 10, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
      { name: 'White-Label Distribution', path: 'white-label-distribution', desc: 'Split for white-label distribution', lines: [
        { role: 'product_owner', pct: 30, basis: 'total_value' },
        { role: 'deal_owner', pct: 15, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
      { name: 'Advisory Only', path: 'advisory-only', desc: 'Split for advisory engagements', lines: [
        { role: 'deal_owner', pct: 30, basis: 'total_value' },
        { role: 'source_owner', pct: 10, basis: 'total_value' },
        { role: 'ops_pool', pct: 5, basis: 'total_value' },
      ]},
    ];

    for (const t of templates) {
      const existing = await client.query('SELECT id FROM split_templates WHERE template_name = $1', [t.name]);
      if (existing.rows.length === 0) {
        const res = await client.query(
          `INSERT INTO split_templates (template_name, deal_path_type, description, created_by_user_id) VALUES ($1, $2, $3, 1) RETURNING id`,
          [t.name, t.path, t.desc]
        );
        for (const line of t.lines) {
          await client.query(
            `INSERT INTO split_template_lines (template_id, role_type, share_percent, share_basis) VALUES ($1, $2, $3, $4)`,
            [res.rows[0].id, line.role, line.pct, line.basis]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Migration 007: Economics & Shadow Ledger tables created with seed templates');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 007 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
