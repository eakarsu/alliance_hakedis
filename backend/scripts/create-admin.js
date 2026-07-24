'use strict';

const bcrypt = require('bcryptjs');
const pool = require('../db/connection');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('Explicit bootstrap acknowledgement is required.');
  }
  const email = String(process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const name = String(process.env.PROVISION_ADMIN_NAME || process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator').trim().slice(0, 255);
  if (!email || !email.includes('@')) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (password.length < 12 || password.length > 72) throw new Error('ADMIN_PASSWORD must contain 12-72 characters.');
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users(full_name,email,password_hash,role,timezone,status)
     VALUES($1,$2,$3,'founding_orchestrator','UTC','active')
     ON CONFLICT(email) DO UPDATE SET
       full_name=EXCLUDED.full_name,
       password_hash=EXCLUDED.password_hash,
       role=EXCLUDED.role,
       timezone=EXCLUDED.timezone,
       status=EXCLUDED.status,
       updated_at=NOW()`,
    [name, email, passwordHash],
  );
  console.log(`Provisioned administrator ${email}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
