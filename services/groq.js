'use strict';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const REQUEST_TIMEOUT_MS = 30_000;

async function groqChat(system, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Groq request timed out');
    throw new Error(`Groq unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  let raw;
  try {
    raw = await res.text();
  } catch {
    throw new Error('Groq returned unreadable response');
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Groq returned non-JSON response');
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !Array.isArray(data.choices) ||
    data.choices.length === 0 ||
    !data.choices[0] ||
    typeof data.choices[0] !== 'object' ||
    !data.choices[0].message ||
    typeof data.choices[0].message !== 'object' ||
    typeof data.choices[0].message.content !== 'string'
  ) {
    throw new Error('Unexpected Groq response format');
  }

  return data.choices[0].message.content;
}

module.exports = { groqChat, GROQ_MODEL };
