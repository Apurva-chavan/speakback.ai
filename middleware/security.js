'use strict';
const crypto = require('crypto');

const IS_PROD = process.env.NODE_ENV === 'production';
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const CSRF_COOKIE = IS_PROD ? '__Host-csrf-sig' : 'csrf-sig';

if (!process.env.CSRF_SECRET) {
  console.warn('[security] CSRF_SECRET not set — tokens will invalidate on restart');
}

function attachNonce(req, res, next) {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
}

function enforceOrigin(req, res, next) {
  const rawOrigin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host;
  if (!rawOrigin) return next();
  try {
    if (new URL(rawOrigin).host !== host) return res.status(403).json({ error: 'Forbidden' });
  } catch {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function signToken(token) {
  return crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
}

function issueCsrfCookie(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const sig = signToken(token);
  res.cookie(CSRF_COOKIE, sig, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/'
  });
  return token;
}

function csrfProtection(req, res, next) {
  const headerToken = req.headers['x-csrf-token'];
  const cookieSig = req.cookies[CSRF_COOKIE];
  if (!headerToken || !cookieSig) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  const expectedSig = signToken(headerToken);
  const a = Buffer.from(expectedSig, 'hex');
  const b = Buffer.from(cookieSig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

module.exports = { attachNonce, enforceOrigin, issueCsrfCookie, csrfProtection };
