'use strict';

const fs = require('node:fs');
const path = require('node:path');
const pool = require('./connection');

async function main() {
  const names = ['migration_000_auth_base.sql', 'migration_012_governed_hakedis.sql', 'migration_013_ai_runtime_results.sql'];
  for (const name of names) {
    const sql = fs.readFileSync(path.join(__dirname, name), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${name}.`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
