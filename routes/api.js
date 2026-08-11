'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { enforceOrigin, csrfProtection, issueCsrfCookie } = require('../middleware/security');
const { validateChatBody, validateFeedbackBody } = require('../middleware/validation');
const { groqChat } = require('../services/groq');
const { buildSystem } = require('../services/prompts');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — slow down and try again in a minute.' }
});

router.get('/csrf-token', enforceOrigin, (req, res) => {
  const token = issueCsrfCookie(req, res);
  res.setHeader('X-CSRF-Token', token);
  res.json({ token });
});

router.post('/chat', enforceOrigin, apiLimiter, csrfProtection, validateChatBody, async (req, res) => {
  try {
    const system = buildSystem(req.body);
    const text = await groqChat(system, req.body.messages);
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('[chat]', err.message);
    const isGroqDown = err.message.includes('unreachable') || err.message.includes('Groq') || err.message.includes('timed out');
    res.status(502).json({ error: isGroqDown ? 'AI service unavailable — try again shortly.' : 'Chat failed — try again.' });
  }
});

router.post('/feedback', enforceOrigin, apiLimiter, csrfProtection, validateFeedbackBody, async (req, res) => {
  const system = (typeof req.body.system === 'string' && req.body.system.length <= 4000)
    ? req.body.system
    : buildSystem(req.body);
  try {
    const text = await groqChat(system, req.body.messages);
    res.json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('[feedback]', err.message);
    res.status(502).json({ error: 'AI service unavailable — try again shortly.' });
  }
});

module.exports = router;
