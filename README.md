# SpeakBack — AI Speaking Coach

A full-stack AI-powered speaking coach that runs entirely on your machine. No cloud API keys, no subscriptions — powered by [Ollama](https://ollama.com).

Practice job interviews, learn a new language, prepare for IELTS/TOEFL, or work on public speaking — all with real-time voice input, live feedback, and detailed session reports.

---

## Features

| Mode | What it does |
|---|---|
| General conversation | Casual English chat with inline grammar & vocabulary coaching |
| Job interview prep | Upload your resume for a personalised 5-round mock interview with STAR scoring |
| Language learning | Structured word-by-word lessons with phonetic guides and XP tracking |
| Public speaking | Delivery, structure, pacing, and confidence coaching |
| IELTS / TOEFL | Examiner-style Part 1, 2, and 3 prompts |
| Your own topic | Free-form practice on any subject |

**Session report drawer** — fluency score, grammar corrections, vocabulary upgrades, per-question interview scores, hiring verdict.

---

## Tech stack

- **Backend:** Node.js · Express · Helmet · express-rate-limit · Multer · pdf-parse · mammoth
- **AI:** [Ollama](https://ollama.com) (local LLM — default: `llama3.2`)
- **Frontend:** Vanilla JS · Web Speech API (SpeechRecognition + SpeechSynthesis) · CSS custom properties
- **Security:** HMAC-signed CSRF tokens · HttpOnly cookies · CSP headers · same-origin enforcement · rate limiting · server-side prompt isolation

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Ollama](https://ollama.com) installed and running locally

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/your-username/speakback-app.git
cd speakback-app
npm install
```

**2. Pull the model**

```bash
ollama pull llama3.2
```

Any Ollama-compatible model works. For better quality try `llama3.1:8b` or `mistral`.

**3. Configure environment**

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development
OLLAMA_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=llama3.2
CSRF_SECRET=<generate-with-command-below>
```

Generate a strong CSRF secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4. Start**

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (required for Web Speech API).

---

## Security architecture

| Layer | Implementation |
|---|---|
| CSRF protection | HMAC-SHA256 signed double-submit: sig stored in `HttpOnly SameSite=Strict` cookie; raw token echoed in `X-CSRF-Token` header. `crypto.timingSafeEqual` prevents timing attacks. |
| Security headers | Helmet with strict CSP, `frame-ancestors: none`, COEP disabled for speech API compatibility |
| Same-origin enforcement | Origin/Referer header validation on every API route |
| Rate limiting | 30 req/min on chat/feedback, 10 req/min on file upload |
| Input validation | Topic key allowlist, message shape validation, content length caps |
| File upload | Memory-only storage (no disk writes), 2MB limit, extension + MIME allowlist |
| Prompt isolation | System prompts never leave the server — client sends context, server builds the full prompt |
| Graceful shutdown | SIGTERM/SIGINT handlers with forced exit timeout |

---

## Project structure

```
speakback-app/
├── server.js          # Express server — routes, security middleware, Ollama client
├── public/
│   ├── index.html     # Single-page app shell
│   ├── script.js      # All client-side logic (speech, state, API calls, rendering)
│   └── style.css      # CSS custom properties, dark/light theme, responsive layout
├── .env.example       # Environment variable template
├── .nvmrc             # Node version pin
├── eslint.config.js   # ESLint flat config (v9)
└── package.json
```

---

## Development

```bash
npm run dev      # Start with nodemon
npm run lint     # ESLint check
npm run lint:fix # Auto-fix lint issues
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` to enable secure cookies |
| `OLLAMA_URL` | `http://localhost:11434/api/chat` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Model name |
| `CSRF_SECRET` | random (ephemeral) | HMAC secret — set this in production or tokens invalidate on restart |

---

## Browser support

Requires a browser with Web Speech API support. Chrome and Edge are recommended. Firefox does not support `SpeechRecognition` without a flag.

---

## License

MIT
