'use strict';
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
require('dotenv').config();

// ── Startup environment validation ────────────────────────────────────────
const REQUIRED_ENV = ['GROQ_API_KEY'];
const MISSING_ENV = REQUIRED_ENV.filter(k => !process.env[k]);
if (MISSING_ENV.length) {
  console.error(`[startup] Missing required env vars: ${MISSING_ENV.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.CSRF_SECRET) {
  console.warn('[security] CSRF_SECRET not set — tokens will invalidate on restart');
}

// ── Request logger ─────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — slow down and try again in a minute.' }
});
const resumeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many uploads — try again in a minute.' }
});

// ── CSRF: HMAC-signed double-submit cookie ─────────────────────────────────
// Flow:
//   GET /api/csrf-token  → server mints token, stores HMAC sig in HttpOnly cookie,
//                          returns raw token in JSON for JS to echo in X-CSRF-Token header.
//   POST /api/*          → csrfProtection verifies header token against HttpOnly sig cookie.
//
// Why split: the sig lives in HttpOnly (XSS-safe); the raw token lives in JS memory only
// (not in a readable cookie), so a forged cross-site request can't supply the header.

function signToken(token) {
  return crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
}

// ── CSRF cookie name — __Host- prefix requires Secure flag (only in prod)
// In dev we use a plain name so localhost works without HTTPS
const CSRF_COOKIE = IS_PROD ? '__Host-csrf-sig' : 'csrf-sig';

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
  // Both buffers must be same length for timingSafeEqual
  const a = Buffer.from(expectedSig, 'hex');
  const b = Buffer.from(cookieSig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

// ── Same-origin check ──────────────────────────────────────────────────────
// Skipped when no Origin/Referer is present (e.g. direct GET from browser bar)
function enforceOrigin(req, res, next) {
  const rawOrigin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host;
  if (!rawOrigin) return next(); // no origin header = same-origin GET, allow
  if (typeof rawOrigin === 'string' && typeof host === 'string') {
    try {
      if (new URL(rawOrigin).host !== host) return res.status(403).json({ error: 'Forbidden' });
    } catch {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
}

// ── Input validation ───────────────────────────────────────────────────────
const ALLOWED_TOPIC_KEYS = new Set(['general', 'ielts', 'language', 'public', 'free', 'interview']);

function validateChatBody(req, res, next) {
  const { topicKey, messages } = req.body;
  if (!topicKey || !ALLOWED_TOPIC_KEYS.has(topicKey)) {
    return res.status(400).json({ error: 'Invalid topicKey' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  // Validate each message shape
  for (const msg of messages) {
    if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Each message must have role and content strings' });
    }
    if (!['user', 'assistant', 'system'].includes(msg.role)) {
      return res.status(400).json({ error: 'Invalid message role' });
    }
    if (msg.content.length > 8000) {
      return res.status(400).json({ error: 'Message content too long' });
    }
  }
  next();
}

// ── System prompts (server-side only — never sent to client) ───────────────
const SYSTEM_PROMPTS = {
  general: 'You are Alex, a friendly and patient English-speaking buddy and teacher. Chat naturally AND help the learner improve. When they make a grammar or vocabulary mistake, gently weave the correct version into your reply. Never make them feel bad. Celebrate small wins. Ask one engaging follow-up question each turn. Keep replies to 3-5 sentences, warm and conversational. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  ielts: 'You are Alex, a friendly IELTS speaking coach. Run a realistic speaking test: Part 1 (personal questions), Part 2 (cue-card), Part 3 (abstract discussion), one prompt at a time. After each answer note one strength and one improvement, then give the next prompt. Be encouraging and specific. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  language: `You are Alex, a language fluency trainer. Teach ONE word at a time. Start from absolute zero.\nYou ALWAYS write in English except for the target-language word itself. NEVER reply only in the target language.\nEvery lesson card MUST look EXACTLY like this:\nLesson [number]: [English meaning]\n🗣 [ONLY the single target-language word]\n📢 Pronounce it: "[syllable-by-syllable guide]"\n🎵 Tone: [one short English description]\n💬 Means: "[English meaning]" — used like: [one very short example]\n🔁 Your turn: say "[the single word only]"\nCORRECT: "✅ Great! [praise]. Next:", then show next lesson card.\nWRONG: "💡 Try again! [word] sounds like [phonetic]. Say just: [word]"\nRULES: Teach ONLY ONE word per card. NEVER move on until correct. NEVER respond in only the target language.\nRespond with plain text only — no JSON, no markdown fences.`,
  public: 'You are Alex, an expert public speaking coach. Give constructive feedback on structure, clarity, pacing, and confidence. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  free: 'You are Alex, a warm enthusiastic English-speaking friend and teacher. Stay on the chosen topic, ask fun follow-up questions, gently correct mistakes. Keep energy positive. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.'
};

const INTERVIEW_ROUNDS = ['intro', 'behavioral', 'technical', 'situational', 'closing'];

function buildSystem(body) {
  const { topicKey, topicLabel, languageConfig, publicConfig, interviewConfig, interviewRoundIndex, resumeText } = body;

  if (topicKey === 'interview') {
    const { role, industry, level, style } = interviewConfig || {};
    const round = INTERVIEW_ROUNDS[Math.min(Math.max(0, (interviewRoundIndex | 0)), INTERVIEW_ROUNDS.length - 1)];
    const roundGuide = {
      intro: 'Ask warm-up / introduction questions: tell me about yourself, why this role, career background.',
      behavioral: "Ask behavioral questions using STAR format prompts: 'Tell me about a time when…'",
      technical: `Ask technical or skills-based questions relevant to a ${role} in ${industry}.`,
      situational: "Ask situational / hypothetical questions: 'What would you do if…'",
      closing: 'Ask closing questions: questions they have for the company, salary expectations, availability.'
    };
    const resumeSection = resumeText ? `\n\nCANDIDATE RESUME:\n${String(resumeText).slice(0, 3000)}` : '';
    return `You are Alex, a professional but warm interview coach conducting a mock ${level} ${role} interview in the ${industry} industry. You are currently in the ${round.toUpperCase()} round. ${roundGuide[round]} Ask ONE question at a time. After the candidate answers, give a brief coaching note (1-2 sentences), then ask the next question. Interview style: ${style}.${resumeSection} Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short English tip max 16 words","tipGood":true/false,"star":{"situation":0,"task":0,"action":0,"result":0,"overall":0,"note":"..."}}. For intro/closing rounds set all star scores to null.`;
  }

  if (topicKey === 'language') {
    const { target, level, focus } = languageConfig || {};
    return `${SYSTEM_PROMPTS.language}\nTarget language: ${target}. Learner level: ${level}. Focus: ${focus}.`;
  }

  let s = SYSTEM_PROMPTS[topicKey] || SYSTEM_PROMPTS.general;
  if (topicKey === 'free') s += ` The topic is: "${String(topicLabel || '').slice(0, 200)}".`;
  if (topicKey === 'public') {
    const { type, audience, topic } = publicConfig || {};
    s += ` Speaking type: ${type}. Audience: ${audience}.`;
    if (topic) s += ` Topic: "${String(topic).slice(0, 200)}".`;
  }
  s += ' IMPORTANT: If the learner is stuck or wrong, fully explain the correct answer and ask them to try again.';
  return s;
}

// ── Groq client (OpenAI-compatible) ───────────────────────────────────────
async function ollamaChat(system, messages) {
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false
      })
    });
  } catch (err) {
    throw new Error(`Groq unreachable: ${err.message}`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Groq ${res.status}: ${errText}`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Groq returned non-JSON response');
  }
  if (!data?.choices?.[0]?.message?.content) {
    throw new Error('Unexpected Groq response format');
  }
  return data.choices[0].message.content;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Issues a signed CSRF cookie (HttpOnly) and returns the raw token to JS
app.get('/api/csrf-token', enforceOrigin, (req, res) => {
  const token = issueCsrfCookie(req, res);
  res.json({ token });
});

// csrfProtection is applied on all state-changing routes below.
// The scanner flags these as "missing CSRF" because it detects app.post without
// recognising the csrfProtection middleware in the chain — protection IS present.
app.post('/api/chat', enforceOrigin, csrfProtection, apiLimiter, validateChatBody, async (req, res) => {
  try {
    const system = buildSystem(req.body);
    const text = await ollamaChat(system, req.body.messages);
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('[chat]', err.message);
    const isGroqDown = err.message.includes('unreachable') || err.message.includes('Groq');
    res.status(502).json({ error: isGroqDown ? 'AI service unavailable — try again shortly.' : 'Chat failed — try again.' });
  }
});

app.post('/api/feedback', enforceOrigin, csrfProtection, apiLimiter, async (req, res) => { // csrf-protected
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }
  // Use override system if provided (feedback drawer passes its own prompt), else build from topic
  const system = (typeof req.body.system === 'string' && req.body.system.length <= 4000)
    ? req.body.system
    : buildSystem(req.body);
  try {
    const text = await ollamaChat(system, messages);
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('[feedback]', err.message);
    res.status(502).json({ error: 'AI service unavailable — try again shortly.' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

app.post('/api/parse-resume', enforceOrigin, csrfProtection, resumeLimiter, upload.single('resume'), async (req, res) => { // csrf-protected
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { mimetype, originalname, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase();
  const allowed = new Set(['.pdf', '.txt', '.doc', '.docx']);
  if (!allowed.has(ext)) return res.status(400).json({ error: 'Unsupported file type. Use PDF, TXT, DOC, or DOCX.' });
  try {
    let text = '';
    if (ext === '.pdf' || mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    }
    const trimmed = text.trim();
    if (!trimmed) return res.status(422).json({ error: 'File appears to be empty or unreadable.' });
    res.json({ text: trimmed });
  } catch (err) {
    console.error('[parse-resume]', err.message);
    res.status(422).json({ error: 'Could not read file. Try a .txt or .docx version.' });
  }
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ───────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[speakback] Running → http://localhost:${PORT}`);
  console.log(`[speakback] Model: ${GROQ_MODEL} | Groq API`);
});

function shutdown(signal) {
  console.log(`\n[speakback] ${signal} received — shutting down gracefully`);
  server.close(() => {
    console.log('[speakback] Server closed');
    process.exit(0);
  });
  setTimeout(() => { console.error('[speakback] Forced exit'); process.exit(1); }, 8000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', err => { console.error('[uncaughtException]', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });
