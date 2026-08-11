'use strict';

const ALLOWED_TOPIC_KEYS = new Set(['general', 'ielts', 'language', 'public', 'free', 'interview']);
const MAX_HISTORY = 20;
const MAX_MSG_LENGTH = 8000;
const VALID_ROLES = ['user', 'assistant', 'system'];

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array';
  for (const msg of messages) {
    if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string')
      return 'Each message must have role and content strings';
    if (!VALID_ROLES.includes(msg.role)) return 'Invalid message role';
    if (msg.content.length > MAX_MSG_LENGTH) return 'Message content too long';
  }
  return null;
}

function validateChatBody(req, res, next) {
  const { topicKey, messages } = req.body;
  if (!topicKey || !ALLOWED_TOPIC_KEYS.has(topicKey)) {
    return res.status(400).json({ error: 'Invalid topicKey' });
  }
  const err = validateMessages(messages);
  if (err) return res.status(400).json({ error: err });
  req.body.messages = messages.slice(-MAX_HISTORY);
  next();
}

function validateFeedbackBody(req, res, next) {
  const err = validateMessages(req.body.messages);
  if (err) return res.status(400).json({ error: err });
  req.body.messages = req.body.messages.slice(-MAX_HISTORY);
  next();
}

module.exports = { validateChatBody, validateFeedbackBody, ALLOWED_TOPIC_KEYS };
