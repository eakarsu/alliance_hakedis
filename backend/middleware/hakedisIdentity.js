'use strict';

const jwt = require('jsonwebtoken');
module.exports = function hakedisIdentity(req, res, next) {
  const secret = process.env.HAKEDIS_JWT_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ error: 'Hakedis identity is not configured' });
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Bearer token required' });
  try {
    const claims = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'], issuer: 'hakedis-identity', audience: 'hakedis-api' });
    if (!claims.sub || !claims.tenantId || !claims.role) throw new Error('missing identity scope');
    req.hakedisActor = { id: String(claims.sub), tenantId: String(claims.tenantId), role: String(claims.role) };
    next();
  } catch (_error) { res.status(401).json({ error: 'Invalid hakedis identity' }); }
};
