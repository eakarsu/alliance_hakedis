'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');

const app = express();
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health/ready', async (_req, res) => {
  try { await pool.query('SELECT 1 FROM hakedis_claims LIMIT 1'); res.json({ status: 'ready', authoritativeSurface: '/api/v1/hakedis' }); }
  catch (_error) { res.status(503).json({ status: 'not_ready' }); }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/v1/hakedis', require('./routes/authoritativeHakedis'));
app.use('/api/ai', require('./routes/authoritativeAi'));
app.use('/api', (_req, res) => res.status(410).json({ error: 'Legacy/generated route retired; use /api/v1/hakedis' }));
app.use((error, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'test') console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
});
if (require.main === module) {
  const port = Number(process.env.BACKEND_PORT || 3001);
  app.listen(port, '127.0.0.1', () => console.log(`Hakedis governed API listening on http://127.0.0.1:${port}`));
}
module.exports = app;
