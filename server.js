'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
require('dotenv').config();

const { attachNonce } = require('./middleware/security');
const apiRouter = require('./routes/api');
const resumeRouter = require('./routes/resume');
const { GROQ_MODEL } = require('./services/groq');

// ── Startup validation ─────────────────────────────────────────────────────
const MISSING_ENV = ['GROQ_API_KEY'].filter(k => !process.env[k]);
if (MISSING_ENV.length) {
  console.error(`[startup] Missing required env vars: ${MISSING_ENV.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Request logger ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} id=${req.id}`);
  next();
});

// ── Security headers ───────────────────────────────────────────────────────
app.use(attachNonce);
app.use((req, res, next) => helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
})(req, res, next));

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// ── HTML with nonce injection ──────────────────────────────────────────────
const indexPath = path.join(__dirname, 'public', 'index.html');
const indexTemplate = fs.readFileSync(indexPath, 'utf8'); // read once at startup

app.get('/', (req, res) => {
  const html = indexTemplate.replace(/__NONCE__/g, res.locals.nonce);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);
app.use('/api/parse-resume', resumeRouter);

// ── 404 & error handlers ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[speakback] Running → http://localhost:${PORT}`);
  console.log(`[speakback] Model: ${GROQ_MODEL} | Groq API | ${IS_PROD ? 'production' : 'development'}`);
});

function shutdown(signal) {
  console.log(`\n[speakback] ${signal} received — shutting down gracefully`);
  server.close(() => { console.log('[speakback] Server closed'); process.exit(0); });
  setTimeout(() => { console.error('[speakback] Forced exit'); process.exit(1); }, 8000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err    => { console.error('[uncaughtException]', err); process.exit(1); });
process.on('unhandledRejection', reason => { console.error('[unhandledRejection]', reason); });
