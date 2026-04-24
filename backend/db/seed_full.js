const pool = require('./connection');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ============================================================
    // 1. ADD MORE ORGANIZATIONS (need more for contacts linkage)
    // ============================================================
    const orgNames = [
      'Prague Cloud Lab', 'Dublin FinServe', 'Stockholm GreenTech', 'Rome Smart City',
      'Tokyo Bridge Corp', 'Bucharest DataWorks', 'Helsinki Cloud', 'Istanbul Commerce Hub',
      'Madrid AI Ventures', 'Oslo Maritime Digital', 'Copenhagen IoT Labs', 'Athens Shipping Tech',
      'Budapest Health Systems', 'Bratislava CyberSec', 'Tallinn GovTech', 'Riga AutomationX',
      'Zagreb Analytics', 'Ljubljana Smart Grid', 'Sarajevo EduConnect', 'Tbilisi FinBridge',
      'Baku Energy Digital', 'Minsk SoftHouse', 'Chisinau AgriTech', 'Skopje TeleHealth',
      'Podgorica TourTech', 'Tirana DataVault', 'Nicosia Maritime AI', 'Malta Gaming Systems',
      'Luxembourg BankTech', 'Reykjavik Geothermal AI', 'Valletta TradeHub', 'Monaco LuxuryTech',
      'Andorra RetailSmart', 'San Marino ArchiveCloud', 'Vaduz WealthTech', 'Edinburgh InsurTech',
      'Manchester HealthAI', 'Liverpool LogiChain', 'Birmingham CyberGuard', 'Leeds EduPlatform',
      'Bristol CleanEnergy', 'Cardiff DataMine', 'Glasgow FinOps', 'Belfast SecurityNet',
      'Cork SaaS Solutions', 'Galway BioTech', 'Limerick RetailAI', 'Waterford DevOps',
    ];

    const newOrgIds = [];
    for (let i = 0; i < orgNames.length; i++) {
      const ownerUserId = (i % 8) + 1;
      const res = await client.query(
        `INSERT INTO organizations (org_name, owner_user_id, org_type, country, created_at)
         VALUES ($1, $2, $3, $4, NOW() - interval '${Math.floor(Math.random() * 180)} days')
         ON CONFLICT DO NOTHING RETURNING id`,
        [orgNames[i], ownerUserId, ['customer', 'partner', 'prospect', 'vendor'][i % 4], ['Germany', 'USA', 'UK', 'Turkey'][i % 4]]
      );
      if (res.rows.length) newOrgIds.push(res.rows[0].id);
    }
    console.log(`Added ${newOrgIds.length} organizations`);

    // ============================================================
    // 2. ADD CONTACTS - 15+ per user for users 4,5,6,7 + extras for 1,2,3
    // ============================================================
    const firstNames = ['Alex', 'Sofia', 'Liam', 'Emma', 'Noah', 'Mia', 'Lucas', 'Olivia', 'Ethan', 'Ava', 'Mason', 'Isabella', 'Logan', 'Sophia', 'Jacob', 'Charlotte', 'Oliver', 'Amelia', 'Daniel', 'Harper'];
    const lastNames = ['Anderson', 'Chen', 'Kumar', 'Mueller', 'Santos', 'Kim', 'Nakamura', 'Petrov', 'Garcia', 'Williams', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Moore', 'Clark', 'Lewis', 'Hall', 'Young', 'King'];

    const allOrgs = await client.query('SELECT id FROM organizations ORDER BY id');
    const orgIds = allOrgs.rows.map(r => r.id);

    let contactCount = 0;
    for (let userId = 1; userId <= 8; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM contacts WHERE owner_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const fn = firstNames[(userId * 7 + i) % firstNames.length];
        const ln = lastNames[(userId * 3 + i) % lastNames.length];
        const orgId = orgIds[(userId * 5 + i) % orgIds.length];
        await client.query(
          `INSERT INTO contacts (first_name, last_name, email, phone, organization_id, owner_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - interval '${Math.floor(Math.random() * 90)} days')`,
          [fn, ln, `${fn.toLowerCase()}.${ln.toLowerCase()}${userId}${i}@example.com`, `+1-555-${String(1000 + userId * 100 + i).slice(-4)}`, orgId, userId]
        );
        contactCount++;
      }
    }
    console.log(`Added ${contactCount} contacts`);

    // ============================================================
    // 3. ADD LEADS - referral leads per user + regular leads
    // ============================================================
    const leadNames = [
      'Cloud Migration Assessment', 'AI Integration Project', 'Digital Transformation',
      'CRM Implementation', 'Data Analytics Platform', 'Cybersecurity Audit',
      'ERP Modernization', 'Mobile App Development', 'IoT Sensor Network',
      'Blockchain Integration', 'Machine Learning Pipeline', 'DevOps Automation',
      'API Gateway Setup', 'Microservices Migration', 'Edge Computing Solution',
      'Smart Office Platform', 'Supply Chain Optimization', 'Customer 360 View',
      'Predictive Maintenance', 'Digital Twin Platform',
    ];
    const verticals = ['technology', 'finance', 'healthcare', 'manufacturing', 'retail', 'energy', 'government', 'education'];
    const needTypes = ['product', 'consulting', 'implementation', 'support', 'integration', 'training'];
    const statuses = ['new', 'reviewing', 'qualified', 'needs_sponsor', 'blocked', 'rejected', 'converted'];
    const geos = ['US', 'EU', 'UK', 'APAC', 'EMEA', 'LATAM'];

    let leadCount = 0;
    // For each user, ensure 16 referral leads (source_type='referral')
    for (let userId = 1; userId <= 7; userId++) {
      const existing = await client.query("SELECT COUNT(*) FROM leads WHERE source_owner_user_id = $1 AND source_type = 'referral'", [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const name = `${leadNames[(userId * 3 + i) % leadNames.length]} #${userId}-${i + 1}`;
        const orgId = orgIds[(userId * 4 + i) % orgIds.length];
        const conflictFlag = (i % 5 === 0); // every 5th has conflict
        await client.query(
          `INSERT INTO leads (lead_name, source_type, source_owner_user_id, sponsor_user_id, organization_id, geography, vertical, need_type, estimated_value, visibility_level, status, conflict_flag, created_at, updated_at)
           VALUES ($1, 'referral', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - interval '${Math.floor(Math.random() * 120)} days', NOW() - interval '${Math.floor(Math.random() * 30)} days')`,
          [
            name, userId, ((userId % 7) + 1), orgId,
            geos[i % geos.length], verticals[i % verticals.length], needTypes[i % needTypes.length],
            Math.floor(Math.random() * 500000) + 10000,
            ['internal', 'partner', 'public'][i % 3], statuses[i % statuses.length],
            conflictFlag,
          ]
        );
        leadCount++;
      }
    }
    // Also add some non-referral leads for full-access users
    for (let userId = 1; userId <= 3; userId++) {
      const existing = await client.query("SELECT COUNT(*) FROM leads WHERE source_owner_user_id = $1", [userId]);
      const totalNeed = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < totalNeed; i++) {
        const name = `Direct Lead ${userId}-${i + 1}`;
        await client.query(
          `INSERT INTO leads (lead_name, source_type, source_owner_user_id, organization_id, geography, vertical, need_type, estimated_value, visibility_level, status, conflict_flag, created_at, updated_at)
           VALUES ($1, 'direct', $2, $3, $4, $5, $6, $7, 'internal', $8, $9, NOW() - interval '${Math.floor(Math.random() * 90)} days', NOW())`,
          [
            name, userId, orgIds[(userId * 3 + i) % orgIds.length],
            geos[i % geos.length], verticals[i % verticals.length], needTypes[i % needTypes.length],
            Math.floor(Math.random() * 300000) + 5000, statuses[i % statuses.length],
            (i % 4 === 0),
          ]
        );
        leadCount++;
      }
    }
    console.log(`Added ${leadCount} leads`);

    // Add lead_assignments for partner users
    const allLeads = await client.query('SELECT id, source_owner_user_id FROM leads ORDER BY id');
    let assignCount = 0;
    for (let userId = 4; userId <= 7; userId++) {
      const existingAssigns = await client.query('SELECT COUNT(*) FROM lead_assignments WHERE assigned_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existingAssigns.rows[0].count));
      const otherLeads = allLeads.rows.filter(l => l.source_owner_user_id !== userId);
      for (let i = 0; i < need && i < otherLeads.length; i++) {
        try {
          await client.query(
            'INSERT INTO lead_assignments (lead_id, assigned_user_id, assignment_type, assigned_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING',
            [otherLeads[(userId * 3 + i) % otherLeads.length].id, userId, ['primary', 'secondary', 'support'][i % 3]]
          );
          assignCount++;
        } catch (e) { /* skip duplicates */ }
      }
    }
    console.log(`Added ${assignCount} lead assignments`);

    // ============================================================
    // 4. ADD OPPORTUNITIES - 16+ per user
    // ============================================================
    const oppNames = [
      'Enterprise CRM Rollout', 'AI-Powered Analytics', 'Cloud Infrastructure',
      'Digital Workplace Suite', 'Cybersecurity Platform', 'Data Lake Implementation',
      'Mobile Commerce App', 'IoT Fleet Management', 'Blockchain Supply Chain',
      'ML Fraud Detection', 'API Marketplace', 'Microservices Platform',
      'Edge AI Deployment', 'Smart Building System', 'Supply Chain Analytics',
      'Customer Data Platform', 'Predictive Quality', 'Digital Health Portal',
      'FinTech Integration', 'GovTech Platform',
    ];
    const dealTypes = ['new_business', 'expansion', 'renewal', 'upsell'];

    let oppCount = 0;
    for (let userId = 1; userId <= 7; userId++) {
      const existing = await client.query(
        `SELECT COUNT(*) FROM opportunities WHERE deal_owner_user_id = $1 OR source_owner_user_id = $1 OR sponsor_user_id = $1`,
        [userId]
      );
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const name = `${oppNames[(userId * 4 + i) % oppNames.length]} - ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi'][i % 16]} ${userId}`;
        const orgId = orgIds[(userId * 2 + i) % orgIds.length];
        const stageId = (i % 6) + 1; // stages 1-6
        const conflictFlag = (i % 6 === 0);
        const totalValue = Math.floor(Math.random() * 900000) + 50000;
        const sourceOwner = userId;
        const dealOwner = userId;
        const sponsor = ((userId + i) % 7) + 1;

        await client.query(
          `INSERT INTO opportunities (opportunity_name, account_org_id, deal_owner_user_id, source_owner_user_id, sponsor_user_id, pipeline_id, stage_id, deal_type, estimated_total_value, recurring_value, one_time_value, expected_close_date, visibility_level, compliance_review_status, win_probability, conflict_flag, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW() - interval '${Math.floor(Math.random() * 150)} days', NOW() - interval '${Math.floor(Math.random() * 10)} days')`,
          [
            name, orgId, dealOwner, sourceOwner, sponsor,
            stageId, dealTypes[i % dealTypes.length],
            totalValue, Math.floor(totalValue * 0.6), Math.floor(totalValue * 0.4),
            new Date(Date.now() + (30 + i * 15) * 86400000).toISOString().split('T')[0],
            ['internal', 'partner', 'public'][i % 3],
            ['pending', 'approved', 'flagged'][i % 3],
            Math.floor(Math.random() * 80) + 10,
            conflictFlag,
            `Opportunity for ${orgNames[i % orgNames.length] || 'client'} engagement`,
          ]
        );
        oppCount++;
      }
    }
    console.log(`Added ${oppCount} opportunities`);

    // Add opportunity_roles for partner users to see more opps
    const allOpps = await client.query('SELECT id, deal_owner_user_id FROM opportunities ORDER BY id');
    let roleCount = 0;
    for (let userId = 4; userId <= 7; userId++) {
      const existingRoles = await client.query('SELECT opportunity_id FROM opportunity_roles WHERE user_id = $1', [userId]);
      const existingOppIds = new Set(existingRoles.rows.map(r => r.opportunity_id));
      const otherOpps = allOpps.rows.filter(o => o.deal_owner_user_id !== userId && !existingOppIds.has(o.id));
      const need = Math.max(0, 5); // add 5 extra opp roles per partner user
      for (let i = 0; i < need && i < otherOpps.length; i++) {
        try {
          await client.query(
            `INSERT INTO opportunity_roles (opportunity_id, user_id, role_in_opportunity, assigned_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
            [otherOpps[i].id, userId, ['technical_partner', 'delivery_manager', 'solution_architect', 'business_sponsor'][i % 4]]
          );
          roleCount++;
        } catch (e) { /* skip */ }
      }
    }
    console.log(`Added ${roleCount} opportunity roles`);

    // ============================================================
    // 5. ADD PROPOSALS linked to user opportunities
    // ============================================================
    const allOppsNow = await client.query('SELECT id, deal_owner_user_id, estimated_total_value FROM opportunities ORDER BY id');
    let proposalCount = 0;
    for (let userId = 1; userId <= 7; userId++) {
      const userOpps = allOppsNow.rows.filter(o => o.deal_owner_user_id === userId);
      // Each opp gets 1-2 proposals
      for (let j = 0; j < userOpps.length; j++) {
        const existing = await client.query('SELECT COUNT(*) FROM proposals WHERE opportunity_id = $1', [userOpps[j].id]);
        if (parseInt(existing.rows[0].count) > 0) continue;
        const val = parseInt(userOpps[j].estimated_total_value) || 100000;
        await client.query(
          `INSERT INTO proposals (opportunity_id, proposal_number, proposal_date, currency, one_time_amount, recurring_amount, implementation_amount, support_amount, discount_amount, approval_status, created_at)
           VALUES ($1, $2, NOW() - interval '${Math.floor(Math.random() * 60)} days', 'USD', $3, $4, $5, $6, $7, $8, NOW() - interval '${Math.floor(Math.random() * 60)} days')`,
          [
            userOpps[j].id,
            `PROP-${String(1000 + userOpps[j].id).slice(-4)}-${j + 1}`,
            Math.floor(val * 0.3), Math.floor(val * 0.5), Math.floor(val * 0.15),
            Math.floor(val * 0.05), Math.floor(val * 0.02),
            ['draft', 'submitted', 'approved', 'rejected'][j % 4],
          ]
        );
        proposalCount++;
      }
    }
    console.log(`Added ${proposalCount} proposals`);

    // ============================================================
    // 6. ADD REVENUE SHARES (payout-summary) - 16+ per partner user
    // ============================================================
    let revenueCount = 0;
    for (let userId = 4; userId <= 7; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM opportunity_revenue_shares WHERE beneficiary_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      const userOpps2 = allOppsNow.rows;
      for (let i = 0; i < need; i++) {
        const opp = userOpps2[(userId * 3 + i) % userOpps2.length];
        const val = parseInt(opp.estimated_total_value) || 100000;
        const sharePercent = [5, 10, 15, 20, 25][i % 5];
        await client.query(
          `INSERT INTO opportunity_revenue_shares (opportunity_id, beneficiary_user_id, beneficiary_entity_id, share_type, share_percent, share_basis, calc_amount, payout_status, due_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            opp.id, userId,
            (i % 5) + 1, // partner entity 1-5
            ['referral_fee', 'commission', 'delivery_share', 'reseller_margin'][i % 4],
            sharePercent, ['total_value', 'recurring_value', 'one_time_value'][i % 3],
            Math.floor(val * sharePercent / 100),
            ['pending', 'approved', 'paid', 'scheduled'][i % 4],
            new Date(Date.now() + (i * 30) * 86400000).toISOString().split('T')[0],
            `Revenue share for partner contribution on ${opp.id}`,
          ]
        );
        revenueCount++;
      }
    }
    // Also ensure full-access users have some
    for (let userId = 1; userId <= 3; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM opportunity_revenue_shares WHERE beneficiary_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const opp = allOppsNow.rows[(userId * 5 + i) % allOppsNow.rows.length];
        const val = parseInt(opp.estimated_total_value) || 100000;
        await client.query(
          `INSERT INTO opportunity_revenue_shares (opportunity_id, beneficiary_user_id, share_type, share_percent, share_basis, calc_amount, payout_status, due_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            opp.id, userId,
            ['referral_fee', 'commission', 'delivery_share'][i % 3],
            [10, 15, 20][i % 3], 'total_value',
            Math.floor(val * 0.1),
            ['pending', 'approved', 'paid'][i % 3],
            new Date(Date.now() + (i * 30) * 86400000).toISOString().split('T')[0],
            `Revenue share for user ${userId}`,
          ]
        );
        revenueCount++;
      }
    }
    console.log(`Added ${revenueCount} revenue shares`);

    // ============================================================
    // 7. ADD ACTIVITIES - 16+ (non-private visible to partners)
    // ============================================================
    const activityTypes = ['call', 'email', 'meeting', 'note', 'task', 'demo', 'presentation'];
    const summaries = [
      'Follow-up call with client', 'Sent proposal via email', 'Product demo session',
      'Requirements gathering meeting', 'Technical architecture review', 'Contract negotiation',
      'Partnership discussion', 'Quarterly business review', 'Onboarding kickoff',
      'Security assessment review', 'Integration planning session', 'Budget approval meeting',
      'Stakeholder alignment call', 'Implementation timeline review', 'Customer success check-in',
      'Training session completed', 'Data migration planning', 'Go-live preparation meeting',
    ];

    let activityCount = 0;
    for (let userId = 1; userId <= 7; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM activities WHERE owner_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const relatedTypes = ['opportunity', 'lead', 'contact', 'organization'];
        await client.query(
          `INSERT INTO activities (related_type, related_id, activity_type, owner_user_id, activity_date, summary, next_step, private_flag, created_at)
           VALUES ($1, $2, $3, $4, NOW() - interval '${Math.floor(Math.random() * 60)} days', $5, $6, $7, NOW() - interval '${Math.floor(Math.random() * 60)} days')`,
          [
            relatedTypes[i % relatedTypes.length],
            (i % 10) + 1,
            activityTypes[i % activityTypes.length],
            userId,
            `${summaries[i % summaries.length]} - ${['Phase 1', 'Phase 2', 'Sprint Review', 'Planning'][i % 4]}`,
            `Schedule follow-up for ${['next week', 'next month', 'Q2', 'Q3'][i % 4]}`,
            false, // all non-private so partners can see
          ]
        );
        activityCount++;
      }
    }
    console.log(`Added ${activityCount} activities`);

    // ============================================================
    // 8. LINK OPPORTUNITIES TO DEAL PATHS
    // ============================================================
    const dealPaths = await client.query('SELECT id FROM deal_paths ORDER BY id');
    const finalOpps = await client.query('SELECT id FROM opportunities ORDER BY id');
    let pathLinkCount = 0;
    for (let i = 0; i < finalOpps.rows.length; i++) {
      const pathId = dealPaths.rows[i % dealPaths.rows.length].id;
      try {
        await client.query(
          'INSERT INTO opportunity_paths (opportunity_id, deal_path_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [finalOpps.rows[i].id, pathId]
        );
        pathLinkCount++;
      } catch (e) { /* skip duplicates */ }
    }
    console.log(`Added ${pathLinkCount} opportunity-path links`);

    // ============================================================
    // 9. SET PRODUCTS owner_user_id for partner users
    // ============================================================
    const products = await client.query('SELECT id FROM products ORDER BY id');
    let prodUpdateCount = 0;
    for (let userId = 4; userId <= 7; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM products WHERE owner_user_id = $1', [userId]);
      if (parseInt(existing.rows[0].count) < 16) {
        // Assign some products to this user
        const startIdx = (userId - 4) * 4;
        for (let i = startIdx; i < startIdx + 16 && i < products.rows.length; i++) {
          await client.query('UPDATE products SET owner_user_id = $1 WHERE id = $2 AND (owner_user_id IS NULL OR owner_user_id = 1)', [userId, products.rows[i].id]);
          prodUpdateCount++;
        }
      }
    }
    console.log(`Updated ${prodUpdateCount} product owners`);

    // ============================================================
    // 10. ADD MORE AGREEMENTS
    // ============================================================
    let agreementCount = 0;
    const existingAgreements = await client.query('SELECT COUNT(*) FROM agreements');
    const needAgreements = Math.max(0, 20 - parseInt(existingAgreements.rows[0].count));
    for (let i = 0; i < needAgreements; i++) {
      await client.query(
        `INSERT INTO agreements (agreement_type, related_type, related_id, party_1, party_2, start_date, end_date, status, governing_law, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          ['nda', 'msa', 'sow', 'partnership', 'reseller', 'licensing'][i % 6],
          ['opportunity', 'partner_entity'][i % 2],
          (i % 10) + 1,
          'Alliance Ecosystem',
          orgNames[i % orgNames.length],
          new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
          new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
          ['draft', 'active', 'pending_review', 'signed', 'expired'][i % 5],
          ['US', 'EU', 'UK', 'Turkish'][i % 4],
          `Agreement for ${orgNames[i % orgNames.length]} partnership`,
        ]
      );
      agreementCount++;
    }
    console.log(`Added ${agreementCount} agreements`);

    // ============================================================
    // 11. ENSURE ENOUGH CONFLICT-FLAGGED ITEMS (for conflict queue)
    // ============================================================
    const conflictLeads = await client.query('SELECT COUNT(*) FROM leads WHERE conflict_flag = true');
    const conflictOpps = await client.query('SELECT COUNT(*) FROM opportunities WHERE conflict_flag = true');
    const totalConflicts = parseInt(conflictLeads.rows[0].count) + parseInt(conflictOpps.rows[0].count);
    console.log(`Total conflict items: ${totalConflicts} (leads: ${conflictLeads.rows[0].count}, opps: ${conflictOpps.rows[0].count})`);

    // If still under 16, flag more
    if (totalConflicts < 16) {
      const toFlag = 16 - totalConflicts;
      await client.query(`UPDATE leads SET conflict_flag = true WHERE id IN (SELECT id FROM leads WHERE conflict_flag = false ORDER BY id LIMIT ${Math.ceil(toFlag / 2)})`);
      await client.query(`UPDATE opportunities SET conflict_flag = true WHERE id IN (SELECT id FROM opportunities WHERE conflict_flag = false ORDER BY id LIMIT ${Math.ceil(toFlag / 2)})`);
      console.log(`Flagged ${toFlag} more items for conflict queue`);
    }

    // ============================================================
    // 12. ADD MORE ORGANIZATIONS owned by each user to reach 16+
    // ============================================================
    for (let userId = 1; userId <= 7; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM organizations WHERE owner_user_id = $1', [userId]);
      const need = Math.max(0, 16 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const name = `${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi'][i % 16]} ${['Corp', 'Inc', 'Ltd', 'GmbH', 'SA'][i % 5]} U${userId}`;
        await client.query(
          `INSERT INTO organizations (org_name, owner_user_id, org_type, country, created_at) VALUES ($1, $2, $3, $4, NOW() - interval '${Math.floor(Math.random() * 120)} days')`,
          [name, userId, ['customer', 'partner', 'prospect'][i % 3], ['USA', 'Germany', 'UK', 'Turkey'][i % 4]]
        );
      }
      if (need > 0) console.log(`Added ${need} orgs for user ${userId}`);
    }

    // ============================================================
    // 13. ADD MORE PRODUCTS - 15+ total
    // ============================================================
    const productNames = [
      'CloudSync Enterprise', 'DataVault Pro', 'AI Assistant Suite', 'SecureGate Platform',
      'IoT Hub Manager', 'Analytics Dashboard', 'WorkFlow Automator', 'API Gateway Pro',
      'Mobile Commerce SDK', 'Digital Twin Engine', 'Compliance Tracker', 'Customer 360',
      'Fraud Detection ML', 'Smart Inventory', 'Edge Computing Kit', 'DevOps Pipeline',
      'Health Portal SaaS', 'FinTech Bridge', 'GovTech Suite', 'EduLearn Platform',
      'Supply Chain AI', 'HR Analytics Pro', 'Green Energy Monitor', 'Retail POS Cloud',
      'Logistics Optimizer',
    ];
    const existingProducts = await client.query('SELECT COUNT(*) FROM products');
    const needProducts = Math.max(0, 25 - parseInt(existingProducts.rows[0].count));
    let productCount = 0;
    for (let i = 0; i < needProducts; i++) {
      const ownerUserId = (i % 7) + 1;
      const entityId = (i % 5) + 1;
      await client.query(
        `INSERT INTO products (product_name, category, owner_entity_id, owner_user_id, maturity_level, demo_available, recurring_model, white_label_possible, reseller_possible, implementation_required, compliance_risk_level, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW() - interval '${Math.floor(Math.random() * 180)} days')`,
        [
          productNames[i % productNames.length],
          ['platform', 'product', 'service', 'sdk', 'saas'][i % 5],
          entityId, ownerUserId,
          ['concept', 'mvp', 'growth', 'mature', 'sunset'][i % 5],
          i % 2 === 0, // demo_available
          i % 3 !== 2, // recurring_model
          i % 4 === 0, // white_label
          i % 3 === 0, // reseller
          i % 2 === 1, // implementation_required
          ['low', 'medium', 'high'][i % 3],
          'active',
          `${productNames[i % productNames.length]} - alliance product offering`,
        ]
      );
      productCount++;
    }
    console.log(`Added ${productCount} products`);

    // ============================================================
    // 14. ADD MORE PROJECTS - 15+ total
    // ============================================================
    const projectNames = [
      'CRM Integration Phase 2', 'AI Chatbot Rollout', 'Cloud Migration Wave 1',
      'FinTech Platform Build', 'Government Portal MVP', 'Data Lake Setup',
      'Mobile App v2', 'IoT Dashboard', 'Security Hardening',
      'ERP Integration', 'Customer Portal', 'Analytics Engine',
      'API Marketplace', 'Digital Onboarding', 'Compliance Automation',
      'Smart Factory Pilot', 'Health Portal Alpha', 'Supply Chain Tracker',
      'Partner Portal Build', 'Edge Deployment',
    ];
    const existingProjects = await client.query('SELECT COUNT(*) FROM projects');
    const needProjects = Math.max(0, 20 - parseInt(existingProjects.rows[0].count));
    let projectCount = 0;
    const allOppsForProj = await client.query('SELECT id FROM opportunities ORDER BY id');
    for (let i = 0; i < needProjects; i++) {
      const ownerUserId = (i % 7) + 1;
      const deliveryUserId = ((i + 1) % 7) + 1;
      const techLeadUserId = ((i + 2) % 7) + 1;
      const oppId = allOppsForProj.rows.length > 0 ? allOppsForProj.rows[i % allOppsForProj.rows.length].id : null;
      await client.query(
        `INSERT INTO projects (project_name, opportunity_id, project_owner_user_id, delivery_manager_user_id, technical_lead_user_id, start_date, target_end_date, status, budget, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - interval '${Math.floor(Math.random() * 90)} days')`,
        [
          projectNames[i % projectNames.length],
          oppId,
          ownerUserId, deliveryUserId, techLeadUserId,
          new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
          new Date(Date.now() + (90 + i * 30) * 86400000).toISOString().split('T')[0],
          ['planning', 'active', 'in_progress', 'on_hold', 'completed'][i % 5],
          Math.floor(Math.random() * 500000) + 50000,
          `${projectNames[i % projectNames.length]} delivery project`,
        ]
      );
      projectCount++;
    }
    console.log(`Added ${projectCount} projects`);

    // ============================================================
    // 15. ADD MORE RISKS - 15+ total
    // ============================================================
    const riskTypes = ['compliance', 'financial', 'operational', 'technical', 'legal', 'security', 'reputational'];
    const riskNotes = [
      'Requires legal review before proceeding', 'Budget overrun risk identified',
      'Timeline risk due to resource constraints', 'Technical complexity higher than expected',
      'Data privacy compliance gap identified', 'Security vulnerability assessment needed',
      'Integration risk with legacy systems', 'Vendor lock-in concern',
      'Regulatory change may impact scope', 'Market conditions shifting',
      'Key resource availability risk', 'Partner dependency concern',
      'Currency exchange rate volatility', 'IP ownership needs clarification',
      'Performance SLA at risk', 'Customer satisfaction declining',
    ];
    const existingRisks = await client.query('SELECT COUNT(*) FROM risks');
    const needRisks = Math.max(0, 20 - parseInt(existingRisks.rows[0].count));
    let riskCount = 0;
    for (let i = 0; i < needRisks; i++) {
      const ownerUserId = (i % 7) + 1;
      await client.query(
        `INSERT INTO risks (related_type, related_id, risk_type, severity, status, owner_user_id, mitigation_notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - interval '${Math.floor(Math.random() * 60)} days')`,
        [
          ['opportunity', 'project', 'partner_entity', 'product'][i % 4],
          (i % 10) + 1,
          riskTypes[i % riskTypes.length],
          ['low', 'medium', 'high', 'critical'][i % 4],
          ['open', 'in_progress', 'mitigated', 'resolved', 'monitoring'][i % 5],
          ownerUserId,
          riskNotes[i % riskNotes.length],
        ]
      );
      riskCount++;
    }
    console.log(`Added ${riskCount} risks`);

    // ============================================================
    // 16. ADD MORE KPI CONTRIBUTIONS - 15+ total
    // ============================================================
    const kpiTypes = ['sourcing', 'technical', 'channel', 'delivery', 'product', 'advisory', 'integration'];
    const metricNames = ['leads_sourced', 'deals_influenced', 'technical_reviews', 'demos_delivered', 'projects_managed', 'revenue_generated', 'referrals_made', 'proposals_written', 'integrations_completed', 'training_sessions'];
    const existingKpi = await client.query('SELECT COUNT(*) FROM kpi_contributions');
    const needKpi = Math.max(0, 30 - parseInt(existingKpi.rows[0].count));
    let kpiCount = 0;
    for (let i = 0; i < needKpi; i++) {
      const userId = (i % 7) + 1;
      await client.query(
        `INSERT INTO kpi_contributions (user_id, contribution_type, related_type, related_id, metric_name, metric_value, period_start, period_end, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - interval '${Math.floor(Math.random() * 90)} days')`,
        [
          userId,
          kpiTypes[i % kpiTypes.length],
          ['lead', 'opportunity', 'project', 'product'][i % 4],
          (i % 10) + 1,
          metricNames[i % metricNames.length],
          Math.floor(Math.random() * 10) + 1,
          new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
          new Date(Date.now()).toISOString().split('T')[0],
          `KPI contribution for ${kpiTypes[i % kpiTypes.length]}`,
        ]
      );
      kpiCount++;
    }
    console.log(`Added ${kpiCount} KPI contributions`);

    // ============================================================
    // 17. ADD MORE COMPLIANCE REVIEWS - 15+ total
    // ============================================================
    const existingCompliance = await client.query('SELECT COUNT(*) FROM compliance_reviews');
    const needCompliance = Math.max(0, 20 - parseInt(existingCompliance.rows[0].count));
    let complianceCount = 0;
    for (let i = 0; i < needCompliance; i++) {
      const reviewerUserId = (i % 3) + 1; // users 1-3 are reviewers
      await client.query(
        `INSERT INTO compliance_reviews (related_type, related_id, personal_data_flag, recording_flag, eu_data_flag, dpa_required_flag, security_review_flag, ip_license_required_flag, reviewer_user_id, review_status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - interval '${Math.floor(Math.random() * 60)} days')`,
        [
          ['opportunity', 'project', 'product', 'agreement'][i % 4],
          (i % 10) + 1,
          i % 2 === 0, i % 3 === 0, i % 2 === 1,
          i % 4 === 0, i % 3 === 1, i % 5 === 0,
          reviewerUserId,
          ['pending', 'in_review', 'approved', 'flagged', 'rejected'][i % 5],
          `Compliance review for ${['opportunity', 'project', 'product', 'agreement'][i % 4]} #${(i % 10) + 1}`,
        ]
      );
      complianceCount++;
    }
    console.log(`Added ${complianceCount} compliance reviews`);

    // ============================================================
    // 18. ADD MORE SHARED ITEMS for restricted user (user 8)
    // ============================================================
    const existingShared = await client.query('SELECT COUNT(*) FROM shared_items WHERE shared_with_user_id = 8');
    const needShared = Math.max(0, 15 - parseInt(existingShared.rows[0].count));
    let sharedCount = 0;
    const entityTypes = ['opportunity', 'product', 'project', 'agreement', 'lead'];
    for (let i = 0; i < needShared; i++) {
      const sharedByUserId = (i % 3) + 1;
      try {
        await client.query(
          `INSERT INTO shared_items (shared_with_user_id, shared_by_user_id, entity_type, entity_id, access_level, notes, shared_at)
           VALUES (8, $1, $2, $3, $4, $5, NOW() - interval '${Math.floor(Math.random() * 30)} days')`,
          [
            sharedByUserId,
            entityTypes[i % entityTypes.length],
            (i % 10) + 1,
            ['view', 'comment', 'edit'][i % 3],
            `Shared ${entityTypes[i % entityTypes.length]} for external review`,
          ]
        );
        sharedCount++;
      } catch (e) { /* skip */ }
    }
    // Also share items with user 7 (us_market_bridge)
    for (let i = 0; i < 10; i++) {
      try {
        await client.query(
          `INSERT INTO shared_items (shared_with_user_id, shared_by_user_id, entity_type, entity_id, access_level, notes, shared_at)
           VALUES (7, $1, $2, $3, 'view', $4, NOW() - interval '${Math.floor(Math.random() * 30)} days')`,
          [
            (i % 3) + 1,
            entityTypes[i % entityTypes.length],
            (i % 10) + 1,
            `Shared for US market coordination`,
          ]
        );
        sharedCount++;
      } catch (e) { /* skip */ }
    }
    console.log(`Added ${sharedCount} shared items`);

    // ============================================================
    // 19. ADD MORE PARTNER ENTITIES - 15+ total
    // ============================================================
    const partnerNames = [
      'Athens Analytics Partners', 'Berlin Integration Hub', 'Copenhagen Cloud Services',
      'Dublin DevOps Group', 'Edinburgh Enterprise', 'Frankfurt FinServe',
      'Geneva Global Tech', 'Helsinki Health Systems', 'Istanbul Innovation Lab',
      'Jakarta Digital Bridge', 'Kuala Lumpur SaaS', 'Lisbon Logic Systems',
      'Mumbai Market Solutions', 'New York NextGen', 'Oslo Operations',
    ];
    const existingPartners = await client.query('SELECT COUNT(*) FROM partner_entities');
    const needPartners = Math.max(0, 15 - parseInt(existingPartners.rows[0].count));
    let partnerCount = 0;
    for (let i = 0; i < needPartners; i++) {
      await client.query(
        `INSERT INTO partner_entities (entity_name, entity_type, billing_capability, active_status, geography, contact_email, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - interval '${Math.floor(Math.random() * 120)} days')`,
        [
          partnerNames[i % partnerNames.length],
          ['channel_partner', 'product_partner', 'consulting_partner', 'technology_partner', 'reseller'][i % 5],
          ['full', 'reseller', 'product', 'licensing', 'consulting'][i % 5],
          true,
          ['Europe', 'US', 'Asia', 'Global', 'EMEA'][i % 5],
          `contact@${partnerNames[i % partnerNames.length].toLowerCase().replace(/\s+/g, '')}.com`,
          `${partnerNames[i % partnerNames.length]} - alliance partner`,
        ]
      );
      partnerCount++;
    }
    console.log(`Added ${partnerCount} partner entities`);

    // ============================================================
    // 20. ADD VISIBILITY REQUESTS - 15+ total
    // ============================================================
    const existingVisibility = await client.query('SELECT COUNT(*) FROM visibility_requests');
    const needVisibility = Math.max(0, 15 - parseInt(existingVisibility.rows[0].count));
    let visibilityCount = 0;
    for (let i = 0; i < needVisibility; i++) {
      const requestedByUserId = (i % 7) + 1;
      const vrStatus = ['pending', 'approved', 'rejected'][i % 3];
      const isReviewed = vrStatus !== 'pending';
      await client.query(
        `INSERT INTO visibility_requests (requested_by_user_id, entity_type, entity_id, current_visibility, requested_visibility, reason, status, reviewed_by_user_id, reviewed_at, review_notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - interval '${Math.floor(Math.random() * 30)} days')`,
        [
          requestedByUserId,
          ['lead', 'opportunity'][i % 2],
          (i % 10) + 1,
          ['restricted', 'private', 'team'][i % 3],
          ['team', 'internal', 'public'][i % 3],
          `Need broader visibility for ${['collaboration', 'reporting', 'partner coordination', 'compliance review'][i % 4]}`,
          vrStatus,
          isReviewed ? 1 : null, // Fetih (founding_orchestrator) as reviewer
          isReviewed ? new Date(Date.now() - Math.random() * 15 * 86400000) : null,
          isReviewed ? `${vrStatus === 'approved' ? 'Approved' : 'Denied'}: ${['Meets compliance requirements', 'Partner needs access for delivery', 'Visibility level appropriate', 'Restricted for confidentiality'][i % 4]}` : null,
        ]
      );
      visibilityCount++;
    }
    console.log(`Added ${visibilityCount} visibility requests`);

    // ============================================================
    // 22. ADD ECONOMICS SEED DATA - entries, shares, shadow contributions
    // ============================================================
    const existingEconEntries = await client.query('SELECT COUNT(*) FROM economic_entries');
    if (parseInt(existingEconEntries.rows[0].count) < 15) {
      const allOppsEcon = await client.query('SELECT id, estimated_total_value, deal_owner_user_id, source_owner_user_id, sponsor_user_id FROM opportunities ORDER BY id LIMIT 20');
      const templates = await client.query('SELECT id, deal_path_type FROM split_templates ORDER BY id');
      let econCount = 0;
      const lifecycleStages = ['draft', 'proposed', 'reviewed', 'approved', 'accrued', 'payable'];

      for (let i = 0; i < Math.min(20, allOppsEcon.rows.length); i++) {
        const opp = allOppsEcon.rows[i];
        const tmpl = templates.rows.length > 0 ? templates.rows[i % templates.rows.length] : null;
        const basisAmount = parseFloat(opp.estimated_total_value) || 100000;
        const stage = lifecycleStages[i % lifecycleStages.length];

        // Create economic entry
        const entryRes = await client.query(
          `INSERT INTO economic_entries (opportunity_id, entry_type, lifecycle_stage, template_id, total_basis_amount, basis_type, currency, effective_date, notes, created_by_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'USD', NOW(), $7, $8, NOW() - interval '${Math.floor(Math.random() * 60)} days')
           RETURNING id`,
          [
            opp.id,
            i % 2 === 0 ? 'commercial' : 'shadow',
            stage,
            tmpl ? tmpl.id : null,
            basisAmount,
            ['total_value', 'recurring_value', 'one_time_value'][i % 3],
            `Economic entry for opportunity ${opp.id}`,
            opp.deal_owner_user_id || 1,
          ]
        );
        const entryId = entryRes.rows[0].id;

        // Add commercial share entries (2-3 per entry)
        const shareUsers = [opp.deal_owner_user_id, opp.source_owner_user_id, opp.sponsor_user_id].filter(Boolean);
        const shareRoles = ['deal_owner', 'source_owner', 'sponsor', 'technical_partner', 'delivery_owner'];
        for (let j = 0; j < shareUsers.length; j++) {
          const sharePct = [15, 10, 5, 20, 25][j % 5];
          const calcAmount = Math.floor(basisAmount * sharePct / 100);
          await client.query(
            `INSERT INTO commercial_share_entries (economic_entry_id, beneficiary_user_id, role_type, share_percent, calculated_amount, final_amount, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              entryId, shareUsers[j], shareRoles[j % shareRoles.length],
              sharePct, calcAmount, calcAmount,
              ['pending', 'approved', 'paid'][j % 3],
              `Share for user ${shareUsers[j]}`,
            ]
          );
        }

        // Add shadow ledger entries (1-2 per entry)
        for (let k = 0; k < 2; k++) {
          const contributorId = ((i + k) % 7) + 1;
          const estValue = Math.floor(basisAmount * 0.1);
          await client.query(
            `INSERT INTO shadow_ledger_entries (economic_entry_id, contributor_user_id, contribution_type, description, estimated_value, actual_value, deserved_amount, lifecycle_stage, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              entryId, contributorId,
              ['technical_review', 'relationship_intro', 'solution_design', 'delivery_support', 'market_research'][k % 5],
              `Shadow contribution by user ${contributorId}`,
              estValue, Math.floor(estValue * 0.8), Math.floor(estValue * 0.9),
              ['planned', 'in_progress', 'actual_logged', 'reviewed', 'approved'][i % 5],
              `Shadow entry for economic entry ${entryId}`,
            ]
          );
        }
        econCount++;
      }
      console.log(`Added ${econCount} economic entries with shares and shadow contributions`);
    }

    // ============================================================
    // 23. ENSURE 16+ PER USER FOR ALL FILTERED ENTITIES
    // ============================================================

    // --- Products: ensure 16+ visible per user ---
    // For partners: products where owner_user_id = self OR shared
    // For us_market_bridge: products with status='active'
    // For restricted: products shared via shared_items
    const allProducts = await client.query('SELECT id, owner_user_id FROM products');
    const partnerEntities = (await client.query('SELECT id FROM partner_entities ORDER BY id')).rows;
    for (let userId = 4; userId <= 7; userId++) {
      const owned = allProducts.rows.filter(p => p.owner_user_id === userId).length;
      const need = Math.max(0, 16 - owned);
      for (let i = 0; i < need; i++) {
        const entityId = partnerEntities.length > 0 ? partnerEntities[(userId + i) % partnerEntities.length].id : null;
        await client.query(
          `INSERT INTO products (product_name, category, owner_entity_id, owner_user_id, maturity_level, compliance_risk_level, demo_available, status, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW() - interval '${Math.floor(Math.random() * 90)} days')`,
          [`Product U${userId}-${i+1}`, ['platform','product','service','sdk','saas'][i%5], entityId, userId,
           ['concept','mvp','growth','mature'][i%4], ['low','medium','high','low','medium'][i%5],
           (i % 3 !== 2), // ~67% have demo_available = true
           `Product for user ${userId}`]
        );
      }
    }
    // Share products with user 8 (restricted)
    const prodIds = (await client.query('SELECT id FROM products ORDER BY id LIMIT 20')).rows;
    for (let i = 0; i < Math.min(16, prodIds.length); i++) {
      try {
        await client.query(
          `INSERT INTO shared_items (shared_with_user_id, shared_by_user_id, entity_type, entity_id, access_level, shared_at)
           VALUES (8, 1, 'product', $1, 'view', NOW()) ON CONFLICT DO NOTHING`,
          [prodIds[i].id]
        );
      } catch {}
    }
    console.log('Ensured 16+ products per user');

    // --- Projects: ensure 16+ visible per user ---
    // Partners see where they're owner, delivery_manager, or technical_lead
    const allProjects2 = await client.query('SELECT id, project_owner_user_id, delivery_manager_user_id, technical_lead_user_id FROM projects');
    for (let userId = 3; userId <= 7; userId++) {
      const visible = allProjects2.rows.filter(p =>
        p.project_owner_user_id === userId || p.delivery_manager_user_id === userId || p.technical_lead_user_id === userId
      ).length;
      const need = Math.max(0, 16 - visible);
      const opps = (await client.query('SELECT id FROM opportunities ORDER BY id LIMIT 50')).rows;
      for (let i = 0; i < need; i++) {
        const oppId = opps.length > 0 ? opps[(userId*3+i) % opps.length].id : null;
        await client.query(
          `INSERT INTO projects (project_name, opportunity_id, project_owner_user_id, delivery_manager_user_id, technical_lead_user_id, start_date, target_end_date, status, budget, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - interval '${Math.floor(Math.random() * 60)} days')`,
          [`Project U${userId}-${i+1}`, oppId, userId, ((userId+1)%7)+1, ((userId+2)%7)+1,
           new Date(Date.now() - 30*86400000).toISOString().split('T')[0],
           new Date(Date.now() + 90*86400000).toISOString().split('T')[0],
           ['planning','active','in_progress','completed'][i%4],
           Math.floor(Math.random()*200000)+50000, `Project for user ${userId}`]
        );
      }
    }
    console.log('Ensured 16+ projects per user');

    // --- Risks: ensure 16+ per user ---
    // Partners see only risks where owner_user_id = self
    for (let userId = 1; userId <= 7; userId++) {
      const owned = (await client.query('SELECT COUNT(*) FROM risks WHERE owner_user_id = $1', [userId])).rows[0].count;
      const need = Math.max(0, 16 - parseInt(owned));
      for (let i = 0; i < need; i++) {
        const relTypes = ['opportunity','project','product','partner_entity'];
        const relType = relTypes[i%4];
        const relId = (i%10)+1;
        await client.query(
          `INSERT INTO risks (related_type, related_id, risk_type, severity, status, owner_user_id, mitigation_notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
          [relType, relId, ['compliance','financial','operational','technical','security'][i%5],
           ['low','medium','high','critical'][i%4], ['open','in_progress','mitigated','monitoring'][i%4],
           userId, `Risk mitigation for user ${userId} item ${i+1}`]
        );
      }
    }
    console.log('Ensured 16+ risks per user');

    // --- KPI: ensure 16+ per user ---
    for (let userId = 1; userId <= 7; userId++) {
      const owned = (await client.query('SELECT COUNT(*) FROM kpi_contributions WHERE user_id = $1', [userId])).rows[0].count;
      const need = Math.max(0, 16 - parseInt(owned));
      for (let i = 0; i < need; i++) {
        await client.query(
          `INSERT INTO kpi_contributions (user_id, contribution_type, related_type, related_id, metric_name, metric_value, period_start, period_end, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
          [userId, ['sourcing','technical','channel','delivery','product'][i%5],
           ['lead','opportunity','project','product'][i%4], (i%10)+1,
           ['leads_sourced','deals_influenced','demos_delivered','revenue_generated','referrals_made'][i%5],
           Math.floor(Math.random()*10)+1,
           new Date(Date.now()-30*86400000).toISOString().split('T')[0],
           new Date().toISOString().split('T')[0],
           `KPI contribution for user ${userId}`]
        );
      }
    }
    console.log('Ensured 16+ KPI per user');

    // --- Economics: ensure 16+ shares and 16+ shadow per user ---
    // Get all opps
    const econOpps = (await client.query('SELECT id, estimated_total_value FROM opportunities ORDER BY id')).rows;

    // Ensure 16+ commercial_share_entries per user (as beneficiary)
    for (let userId = 1; userId <= 7; userId++) {
      const existing = (await client.query('SELECT COUNT(*) FROM commercial_share_entries WHERE beneficiary_user_id = $1', [userId])).rows[0].count;
      const need = Math.max(0, 16 - parseInt(existing));
      if (need > 0) {
        // Find or create economic entries to attach shares to
        const entries = (await client.query('SELECT id, total_basis_amount FROM economic_entries ORDER BY id')).rows;
        for (let i = 0; i < need; i++) {
          let entryId;
          if (entries.length > 0) {
            entryId = entries[(userId*3+i) % entries.length].id;
          } else {
            // Create an entry
            const opp = econOpps[i % econOpps.length];
            const res = await client.query(
              `INSERT INTO economic_entries (opportunity_id, entry_type, lifecycle_stage, total_basis_amount, basis_type, currency, created_by_user_id, created_at)
               VALUES ($1, 'commercial', 'approved', $2, 'total_value', 'USD', 1, NOW()) RETURNING id`,
              [opp.id, opp.estimated_total_value || 100000]
            );
            entryId = res.rows[0].id;
            entries.push({ id: entryId, total_basis_amount: opp.estimated_total_value || 100000 });
          }
          const basis = entries.find(e => e.id === entryId)?.total_basis_amount || 100000;
          const pct = [10,15,20,25,5][i%5];
          const amt = Math.floor(parseFloat(basis) * pct / 100);
          try {
            await client.query(
              `INSERT INTO commercial_share_entries (economic_entry_id, beneficiary_user_id, role_type, share_percent, calculated_amount, final_amount, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [entryId, userId, ['deal_owner','source_owner','sponsor','technical_partner','delivery_owner'][i%5],
               pct, amt, amt, ['pending','approved','paid'][i%3]]
            );
          } catch {}
        }
      }
    }
    console.log('Ensured 16+ economics shares per user');

    // Ensure 16+ shadow_ledger_entries per user (as contributor)
    for (let userId = 1; userId <= 7; userId++) {
      const existing = (await client.query('SELECT COUNT(*) FROM shadow_ledger_entries WHERE contributor_user_id = $1', [userId])).rows[0].count;
      const need = Math.max(0, 16 - parseInt(existing));
      if (need > 0) {
        const entries = (await client.query('SELECT id FROM economic_entries ORDER BY id')).rows;
        for (let i = 0; i < need; i++) {
          const entryId = entries.length > 0 ? entries[(userId*2+i) % entries.length].id : 1;
          const estVal = Math.floor(Math.random()*50000)+5000;
          try {
            await client.query(
              `INSERT INTO shadow_ledger_entries (economic_entry_id, contributor_user_id, contribution_type, description, estimated_value, actual_value, deserved_amount, lifecycle_stage, notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [entryId, userId,
               ['technical_review','relationship_intro','solution_design','delivery_support','market_research'][i%5],
               `Shadow contribution by user ${userId} - item ${i+1}`,
               estVal, Math.floor(estVal*0.8), Math.floor(estVal*0.9),
               ['planned','in_progress','actual_logged','reviewed','approved'][i%5],
               `Shadow entry for user ${userId}`]
            );
          } catch {}
        }
      }
    }
    console.log('Ensured 16+ shadow entries per user');

    // --- Michael (user 7, us_market_bridge): needs contacts, orgs, leads, opps, agreements ---
    // The dataFilter for contacts/orgs uses ownerFilter for partners
    // us_market_bridge IS a partner role, so filtered by owner_user_id
    // Ensure user 7 owns 16+ contacts
    const u7contacts = (await client.query('SELECT COUNT(*) FROM contacts WHERE owner_user_id = 7')).rows[0].count;
    for (let i = 0; i < Math.max(0, 16 - parseInt(u7contacts)); i++) {
      const orgId = orgIds[(7*5+i) % orgIds.length];
      await client.query(
        `INSERT INTO contacts (first_name, last_name, email, phone, organization_id, owner_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, 7, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
        [`Michael-C${i+1}`, 'USContact', `michael.contact${i}@example.com`, `+1-555-7${String(100+i).slice(-3)}`, orgId]
      );
    }
    // Ensure user 7 owns 16+ organizations
    const u7orgs = (await client.query('SELECT COUNT(*) FROM organizations WHERE owner_user_id = 7')).rows[0].count;
    for (let i = 0; i < Math.max(0, 16 - parseInt(u7orgs)); i++) {
      await client.query(
        `INSERT INTO organizations (org_name, owner_user_id, org_type, country, created_at)
         VALUES ($1, 7, $2, 'USA', NOW() - interval '${Math.floor(Math.random()*90)} days')`,
        [`US Market Org ${i+1}`, ['customer','partner','prospect'][i%3]]
      );
    }
    // Ensure user 7 has 16+ leads (as source_owner or sponsor)
    const u7leads = (await client.query('SELECT COUNT(*) FROM leads WHERE source_owner_user_id = 7 OR sponsor_user_id = 7')).rows[0].count;
    for (let i = 0; i < Math.max(0, 16 - parseInt(u7leads)); i++) {
      const orgId = orgIds[(7*3+i) % orgIds.length];
      await client.query(
        `INSERT INTO leads (lead_name, source_type, source_owner_user_id, organization_id, geography, vertical, need_type, estimated_value, status, created_at)
         VALUES ($1, $2, 7, $3, 'US', $4, $5, $6, $7, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
        [`US Market Lead ${i+1}`, ['referral','direct','partner'][i%3], orgId,
         ['technology','finance','healthcare'][i%3], ['product','consulting','implementation'][i%3],
         Math.floor(Math.random()*200000)+10000, ['new','reviewing','qualified'][i%3]]
      );
    }
    // Ensure user 7 has 16+ opportunities (deal_owner or opp_role)
    const u7opps = (await client.query('SELECT COUNT(*) FROM opportunities WHERE deal_owner_user_id = 7 OR source_owner_user_id = 7 OR sponsor_user_id = 7')).rows[0].count;
    for (let i = 0; i < Math.max(0, 16 - parseInt(u7opps)); i++) {
      const orgId = orgIds[(7*4+i) % orgIds.length];
      const stages = (await client.query('SELECT id FROM pipeline_stages ORDER BY sort_order LIMIT 6')).rows;
      const stageId = stages.length > 0 ? stages[i%stages.length].id : 1;
      await client.query(
        `INSERT INTO opportunities (opportunity_name, deal_owner_user_id, source_owner_user_id, account_org_id, stage_id, estimated_total_value, deal_type, status, created_at)
         VALUES ($1, 7, 7, $2, $3, $4, $5, 'active', NOW() - interval '${Math.floor(Math.random()*60)} days')`,
        [`US Market Deal ${i+1}`, orgId, stageId,
         Math.floor(Math.random()*300000)+50000, ['new_business','expansion','renewal'][i%3]]
      );
    }
    // Ensure user 7 has 16+ agreements
    const u7agreements = (await client.query(`SELECT COUNT(*) FROM agreements a WHERE a.related_type = 'opportunity' AND a.related_id IN (SELECT id FROM opportunities WHERE deal_owner_user_id = 7 OR source_owner_user_id = 7)`)).rows[0].count;
    const u7OppIds = (await client.query('SELECT id FROM opportunities WHERE deal_owner_user_id = 7 OR source_owner_user_id = 7')).rows;
    for (let i = 0; i < Math.max(0, 16 - parseInt(u7agreements)); i++) {
      const oppId = u7OppIds.length > 0 ? u7OppIds[i % u7OppIds.length].id : null;
      await client.query(
        `INSERT INTO agreements (agreement_type, related_type, related_id, party_1, party_2, status, start_date, notes, created_at)
         VALUES ($1, 'opportunity', $2, $3, $4, $5, NOW(), $6, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
        [['nda','partnership','reseller','service'][i%4], oppId,
         'Alliance CRM', `US Partner ${i+1}`,
         ['draft','active','signed','expired'][i%4], `Agreement for US market deal`]
      );
    }
    // Ensure user 7 has 16+ proposals
    for (let i = 0; i < Math.max(0, 16 - u7OppIds.length); i++) {
      // proposals are tied to opportunities
    }
    console.log('Ensured 16+ items for Michael (user 7)');

    // --- Archie (user 8, restricted_external): needs shared items per entity type ---
    // Share 16+ of EACH entity type
    const shareTargets = [
      { type: 'opportunity', query: 'SELECT id FROM opportunities ORDER BY id LIMIT 20' },
      { type: 'agreement', query: 'SELECT id FROM agreements ORDER BY id LIMIT 20' },
      { type: 'lead', query: 'SELECT id FROM leads ORDER BY id LIMIT 20' },
      { type: 'project', query: 'SELECT id FROM projects ORDER BY id LIMIT 20' },
      { type: 'organization', query: 'SELECT id FROM organizations ORDER BY id LIMIT 20' },
      { type: 'contact', query: 'SELECT id FROM contacts ORDER BY id LIMIT 20' },
      { type: 'risk', query: 'SELECT id FROM risks ORDER BY id LIMIT 20' },
      { type: 'kpi', query: 'SELECT id FROM kpi_contributions ORDER BY id LIMIT 20' },
    ];
    for (const st of shareTargets) {
      const existing = (await client.query(`SELECT COUNT(*) FROM shared_items WHERE shared_with_user_id = 8 AND entity_type = $1`, [st.type])).rows[0].count;
      const need = Math.max(0, 18 - parseInt(existing));
      if (need > 0) {
        const ids = (await client.query(st.query)).rows;
        for (let i = 0; i < Math.min(need, ids.length); i++) {
          try {
            await client.query(
              `INSERT INTO shared_items (shared_with_user_id, shared_by_user_id, entity_type, entity_id, access_level, shared_at)
               VALUES (8, $1, $2, $3, 'view', NOW()) ON CONFLICT DO NOTHING`,
              [(i%3)+1, st.type, ids[i].id]
            );
          } catch {}
        }
      }
    }
    console.log('Ensured shared items for Archie (user 8)');

    // ============================================================
    // 24. SEED ACTIVITIES FOR ARCHIE (user 8, restricted_external)
    // ============================================================
    const archieActivities = (await client.query('SELECT COUNT(*) FROM activities WHERE owner_user_id = 8')).rows[0].count;
    if (parseInt(archieActivities) < 15) {
      const sharedProducts = (await client.query("SELECT entity_id FROM shared_items WHERE shared_with_user_id = 8 AND entity_type = 'product' LIMIT 15")).rows;
      const sharedAgreements = (await client.query("SELECT entity_id FROM shared_items WHERE shared_with_user_id = 8 AND entity_type = 'agreement' LIMIT 10")).rows;
      const actTypes = ['review', 'comment', 'meeting', 'call', 'email', 'note'];
      let actCount = 0;
      for (let i = 0; i < 16; i++) {
        const relType = i < 8 ? 'product' : 'agreement';
        const relItems = relType === 'product' ? sharedProducts : sharedAgreements;
        const relId = relItems.length > 0 ? relItems[i % relItems.length].entity_id : null;
        await client.query(
          `INSERT INTO activities (activity_type, summary, owner_user_id, related_type, related_id, activity_date, private_flag, created_at)
           VALUES ($1, $2, 8, $3, $4, NOW() - interval '${Math.floor(Math.random()*30)} days', false, NOW() - interval '${Math.floor(Math.random()*30)} days')`,
          [actTypes[i % actTypes.length], `Archie activity: ${actTypes[i % actTypes.length]} on ${relType} #${relId || 'N/A'}`,
           relType, relId]
        );
        actCount++;
      }
      console.log(`Added ${actCount} activities for Archie`);
    }

    // ============================================================
    // 25. SEED MEETING NOTES - 15+ visible to all users including Archie
    // ============================================================
    const meetingNotesExist = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meeting_notes') AS e");
    if (meetingNotesExist.rows[0].e) {
      const existingNotes = (await client.query('SELECT COUNT(*) FROM meeting_notes')).rows[0].count;
      if (parseInt(existingNotes) < 15) {
        const noteTemplates = [
          { title: 'Weekly Product Sync', summary: 'Discussed product roadmap updates and partner feedback' },
          { title: 'Advisory Board Meeting', summary: 'Quarterly review of advisory recommendations' },
          { title: 'Partner Onboarding Review', summary: 'Reviewed onboarding progress for new partners' },
          { title: 'Technical Architecture Review', summary: 'Deep dive into system architecture decisions' },
          { title: 'Compliance Status Update', summary: 'Review of compliance requirements and deadlines' },
          { title: 'Revenue Share Discussion', summary: 'Discussed revenue sharing models and adjustments' },
          { title: 'Client Feedback Session', summary: 'Collected and analyzed recent client feedback' },
          { title: 'Strategic Planning Meeting', summary: 'Long-term strategy and growth planning' },
          { title: 'Integration Workshop', summary: 'Technical workshop on system integrations' },
          { title: 'Risk Assessment Review', summary: 'Review of identified risks and mitigation plans' },
          { title: 'Product Demo Preparation', summary: 'Prepared demo scripts and materials' },
          { title: 'Market Analysis Briefing', summary: 'US market expansion opportunities discussed' },
          { title: 'Delivery Standup', summary: 'Daily delivery team standup notes' },
          { title: 'Partner Feedback Roundtable', summary: 'Partner feedback collection session' },
          { title: 'Security Review Meeting', summary: 'Security audit findings and remediation plans' },
          { title: 'Budget Planning Session', summary: 'FY budget allocation and forecasting' },
          { title: 'Customer Success Review', summary: 'Reviewed customer satisfaction metrics' },
          { title: 'API Design Workshop', summary: 'API design patterns and standards discussion' },
        ];
        for (let i = 0; i < 18; i++) {
          const tmpl = noteTemplates[i % noteTemplates.length];
          const creatorId = (i % 7) + 1;
          await client.query(
            `INSERT INTO meeting_notes (title, meeting_date, attendees, summary, action_items, visibility_level, created_by_user_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - interval '${Math.floor(Math.random()*60)} days')`,
            [tmpl.title, new Date(Date.now() - (i * 3) * 86400000).toISOString(),
             'Fetih, Muhittin, Erol, Archie', tmpl.summary,
             'Follow up on action items from this meeting',
             i % 3 === 0 ? 'shared' : 'internal', creatorId]
          );
        }
        // Share meeting notes with Archie
        const noteIds = (await client.query('SELECT id FROM meeting_notes ORDER BY id')).rows;
        for (const note of noteIds) {
          try {
            await client.query(
              `INSERT INTO shared_items (shared_with_user_id, shared_by_user_id, entity_type, entity_id, access_level, shared_at)
               VALUES (8, 1, 'meeting_note', $1, 'view', NOW()) ON CONFLICT DO NOTHING`, [note.id]
            );
          } catch {}
        }
        console.log('Added meeting notes');
      }
    }

    // ============================================================
    // 26. SEED ADVISORY REQUESTS - 15+ for Archie
    // ============================================================
    const advisoryExist = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'advisory_requests') AS e");
    if (advisoryExist.rows[0].e) {
      const existingAdvisory = (await client.query('SELECT COUNT(*) FROM advisory_requests WHERE requested_by_user_id = 8 OR assigned_to_user_id = 8')).rows[0].count;
      if (parseInt(existingAdvisory) < 15) {
        const advisoryTemplates = [
          { title: 'Market Entry Strategy Review', desc: 'Need advisory input on US market entry timing' },
          { title: 'Product Positioning Feedback', desc: 'Review product positioning for enterprise segment' },
          { title: 'Compliance Framework Assessment', desc: 'Assess compliance with new regulations' },
          { title: 'Technical Due Diligence', desc: 'Technical review of proposed architecture' },
          { title: 'Partnership Agreement Review', desc: 'Review terms of new partnership agreement' },
          { title: 'Pricing Model Validation', desc: 'Validate proposed pricing for new market' },
          { title: 'Risk Mitigation Strategy', desc: 'Advisory on risk mitigation approaches' },
          { title: 'Customer Retention Analysis', desc: 'Analyze churn patterns and retention strategies' },
          { title: 'Competitive Landscape Review', desc: 'Assessment of competitive positioning' },
          { title: 'Revenue Model Optimization', desc: 'Advisory on revenue model improvements' },
          { title: 'Security Architecture Review', desc: 'Review security architecture decisions' },
          { title: 'Go-to-Market Strategy', desc: 'GTM strategy for new product launch' },
          { title: 'Vendor Selection Advisory', desc: 'Advisory on vendor evaluation criteria' },
          { title: 'Talent Acquisition Strategy', desc: 'Advisory on key hiring priorities' },
          { title: 'Data Privacy Compliance', desc: 'GDPR and data privacy advisory' },
          { title: 'Integration Architecture Review', desc: 'Advisory on integration approach' },
        ];
        for (let i = 0; i < 16; i++) {
          const tmpl = advisoryTemplates[i % advisoryTemplates.length];
          // Some requested by Archie, some assigned to Archie
          const requestedBy = i % 2 === 0 ? 8 : (i % 3) + 1;
          const assignedTo = i % 2 === 0 ? (i % 3) + 1 : 8;
          await client.query(
            `INSERT INTO advisory_requests (title, description, requested_by_user_id, assigned_to_user_id, status, priority, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW() - interval '${Math.floor(Math.random()*45)} days')`,
            [tmpl.title, tmpl.desc, requestedBy, assignedTo,
             ['pending', 'in_progress', 'completed', 'closed'][i % 4],
             ['low', 'medium', 'high'][i % 3]]
          );
        }
        console.log('Added advisory requests');
      }
    }

    // ============================================================
    // 27. NOTIFICATIONS - 15+ per user
    // ============================================================
    const notifTypes = ['system', 'opportunity', 'lead', 'governance', 'compliance', 'project', 'product', 'risk'];
    const notifTemplates = [
      { type: 'opportunity', title: 'Deal stage updated', message: 'A deal has moved to the next pipeline stage.' },
      { type: 'opportunity', title: 'New opportunity created', message: 'A new opportunity has been added to the pipeline.' },
      { type: 'opportunity', title: 'Revenue share confirmed', message: 'Your revenue share allocation has been confirmed.' },
      { type: 'opportunity', title: 'Deal closing soon', message: 'An opportunity is expected to close this week.' },
      { type: 'opportunity', title: 'Proposal submitted', message: 'A new proposal has been submitted for review.' },
      { type: 'lead', title: 'New lead assigned', message: 'A new lead has been assigned to you for follow-up.' },
      { type: 'lead', title: 'Lead status changed', message: 'A lead you are tracking has changed status.' },
      { type: 'lead', title: 'Referral received', message: 'A new referral lead has been submitted.' },
      { type: 'governance', title: 'Visibility request pending', message: 'A visibility upgrade request needs your review.' },
      { type: 'governance', title: 'Access request approved', message: 'Your access request has been approved.' },
      { type: 'compliance', title: 'Compliance review required', message: 'A deal requires compliance review before proceeding.' },
      { type: 'project', title: 'Project milestone due', message: 'A project milestone is approaching its deadline.' },
      { type: 'project', title: 'Budget alert', message: 'A project is approaching its budget limit.' },
      { type: 'system', title: 'Weekly digest available', message: 'Your weekly pipeline summary is ready to view.' },
      { type: 'system', title: 'Welcome to Alliance CRM', message: 'Your workspace is ready. Start by reviewing the dashboard.' },
      { type: 'product', title: 'Product update available', message: 'A product in your portfolio has been updated.' },
      { type: 'risk', title: 'Risk flagged', message: 'A new risk has been identified on one of your deals.' },
      { type: 'system', title: 'New team member joined', message: 'A new member has joined the alliance.' },
    ];

    let notifCount = 0;
    for (let userId = 1; userId <= 8; userId++) {
      const existing = await client.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);
      const need = Math.max(0, 18 - parseInt(existing.rows[0].count));
      for (let i = 0; i < need; i++) {
        const tmpl = notifTemplates[i % notifTemplates.length];
        const hoursAgo = Math.floor(Math.random() * 168) + 1; // within past 7 days
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, read, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW() - interval '${hoursAgo} hours')`,
          [userId, tmpl.type, tmpl.title, tmpl.message, (i < 5)] // first 5 are read, rest unread
        );
        notifCount++;
      }
    }
    console.log(`Added ${notifCount} notifications`);

    await client.query('COMMIT');
    console.log('\n=== SEED COMPLETE ===');

    // Verify final counts
    console.log('\n=== FINAL VERIFICATION ===');
    for (const table of ['leads', 'opportunities', 'projects', 'partner_entities', 'agreements', 'proposals', 'risks', 'products', 'activities', 'contacts', 'organizations', 'shared_items', 'visibility_requests', 'compliance_reviews', 'opportunity_revenue_shares', 'kpi_contributions', 'notifications']) {
      const r = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${r.rows[0].count}`);
    }

    // Per-user counts for key filtered tables
    console.log('\n=== PER-USER COUNTS ===');
    for (let userId = 1; userId <= 8; userId++) {
      const user = (await client.query('SELECT full_name, role FROM users WHERE id = $1', [userId])).rows[0];
      const leads = await client.query("SELECT COUNT(*) FROM leads WHERE source_owner_user_id = $1", [userId]);
      const referrals = await client.query("SELECT COUNT(*) FROM leads WHERE source_owner_user_id = $1 AND source_type = 'referral'", [userId]);
      const opps = await client.query("SELECT COUNT(*) FROM opportunities WHERE deal_owner_user_id = $1 OR source_owner_user_id = $1 OR sponsor_user_id = $1", [userId]);
      const contacts = await client.query("SELECT COUNT(*) FROM contacts WHERE owner_user_id = $1", [userId]);
      const orgs = await client.query("SELECT COUNT(*) FROM organizations WHERE owner_user_id = $1", [userId]);
      const activities = await client.query("SELECT COUNT(*) FROM activities WHERE owner_user_id = $1", [userId]);
      const projects = await client.query("SELECT COUNT(*) FROM projects WHERE project_owner_user_id = $1 OR delivery_manager_user_id = $1 OR technical_lead_user_id = $1", [userId]);
      const risks = await client.query("SELECT COUNT(*) FROM risks WHERE owner_user_id = $1", [userId]);
      const products = await client.query("SELECT COUNT(*) FROM products WHERE owner_user_id = $1", [userId]);
      const payouts = await client.query("SELECT COUNT(*) FROM opportunity_revenue_shares WHERE beneficiary_user_id = $1", [userId]);
      console.log(`\nUser ${userId} (${user.full_name} - ${user.role}):`);
      console.log(`  leads=${leads.rows[0].count} referrals=${referrals.rows[0].count} opps=${opps.rows[0].count} contacts=${contacts.rows[0].count} orgs=${orgs.rows[0].count}`);
      console.log(`  activities=${activities.rows[0].count} projects=${projects.rows[0].count} risks=${risks.rows[0].count} products=${products.rows[0].count} payouts=${payouts.rows[0].count}`);
    }

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e);
    throw e;
  } finally {
    client.release();
    pool.end();
  }
}

seed();
