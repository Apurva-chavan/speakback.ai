const topicMeta = {
  general: {
    label: "General conversation",
    system: "You are Alex, a friendly and patient English-speaking buddy and teacher. Chat naturally AND help the learner improve. When they make a grammar or vocabulary mistake, gently weave the correct version into your reply (e.g. 'Oh you mean you WENT there — that's so cool!'). Never make them feel bad. Celebrate small wins. Ask one engaging follow-up question each turn. Keep replies to 3-5 sentences, warm and conversational."
  },
  ielts: {
    label: "IELTS / TOEFL speaking",
    system: "You are Alex, a friendly IELTS speaking coach. Run a realistic speaking test: Part 1 (personal questions), Part 2 (cue-card), Part 3 (abstract discussion), one prompt at a time. After each answer note one strength and one improvement, then give the next prompt. Be encouraging and specific. Keep replies to 3-5 sentences."
  },
  language: {
    label: "",
    system: `You are Alex, a language fluency trainer. Teach ONE word at a time. Start from absolute zero — the learner is a complete beginner.

You ALWAYS write in English except for the target-language word itself. NEVER reply only in the target language.

Every lesson card MUST look EXACTLY like this — no extra sentences, no full phrases until the learner masters the single word:

Lesson [number]: [English meaning]
🗣 [ONLY the single target-language word — NOT a full sentence]
📢 Pronounce it: "[syllable-by-syllable guide — STRESSED syllable in CAPS, e.g. HA-lo]"
🎵 Tone: [one short English description — e.g. "flat and short", "rise at end", "roll the R"]
💬 Means: "[English meaning]" — used like: [one very short example, 2-3 words max]
🔁 Your turn: say "[the single word only]"

When learner replies:
- CORRECT: "✅ Great! [one word of praise]. Next:", then show next lesson card.
- WRONG or don't know: "💡 Try again! [word] sounds like [phonetic]. Say just: [word]"

RULES:
- Teach ONLY ONE word per card — never a full sentence as the practice target.
- NEVER move to next word until learner says the current word correctly.
- NEVER respond in only the target language.
- Sequence: 1=Hello, 2=Goodbye, 3=Thank you, 4=Please, 5=Yes, 6=No, 7=Excuse me, 8=Sorry, 9=Water, 10=Food, then numbers 1-5, colors, common nouns — based on focus area.`
  },
  public: {
    label: "",
    system: "You are Alex, an expert public speaking coach. Give constructive feedback on structure, clarity, pacing, and confidence. Ask the speaker to deliver a short passage or respond to a prompt, then coach them. Keep replies to 3-5 sentences."
  },
  free: {
    label: "",
    system: "You are Alex, a warm enthusiastic English-speaking friend and teacher. Stay on the chosen topic, ask fun follow-up questions, gently correct mistakes by naturally using the right form in your reply. Keep energy positive. Keep replies to 3-5 sentences."
  }
};

// Language lesson state
let langLesson = { word: '', meaning: '', lessonNum: 0, waitingForPractice: false, pendingTip: '' };
let resumeText = '';

// Interview state
let interviewConfig = { role: '', industry: '', level: '', style: '' };
let languageConfig = { target: 'Spanish', level: 'complete beginner', focus: 'everyday conversation' };
let publicConfig = { type: 'persuasive speech', audience: 'general audience', topic: '' };
const INTERVIEW_ROUNDS = ['intro', 'behavioral', 'technical', 'situational', 'closing'];
const QUESTIONS_PER_ROUND = 2;
let interviewRoundIndex = 0;
let interviewQuestionInRound = 0;
let interviewTotalQ = 0;
const TOTAL_INTERVIEW_Q = INTERVIEW_ROUNDS.length * QUESTIONS_PER_ROUND;
let userStopped = false;
let isProcessing = false;
let ttsEndedAt = 0;

let currentTopicKey = null;
let currentTopicLabel = "";
let transcript = [];
let isListening = false;
let isSpeaking = false;
let recognition = null;
let lockedVoice = null;
let wordCount = 0;
let fillerCount = 0;
let langXP = 0;
const FILLERS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'so', 'right', 'okay'];

const $ = id => document.getElementById(id);
const setupScreen = $('setup-screen');
const appScreen = $('app-screen');
const orbWrap = $('orb-wrap');
const orbLabel = $('orb-state-label');
const interimPreview = $('interim-preview');
const transcriptEl = $('transcript');
const topicPill = $('topic-pill');
const interviewProgress = $('interview-progress');

// Resume error helper — shows inline below the resume zone
function showResumeError(msg) {
  let el = document.getElementById('resume-error-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'resume-error-msg';
    el.className = 'resume-error show';
    const zone = document.getElementById('resume-zone');
    if (zone) zone.insertAdjacentElement('afterend', el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

// Status helper — shows below chat bar
let _statusEl = null;
function setStatus(msg) {
  if (!_statusEl) {
    _statusEl = document.createElement('div');
    _statusEl.className = 'chat-status';
    const footer = document.querySelector('footer.app-footer');
    if (footer) footer.appendChild(_statusEl);
  }
  _statusEl.textContent = msg;
  if (orbLabel) orbLabel.textContent = msg;
}

// ---------- SETUP SCREEN ----------
document.querySelectorAll('.topic-card').forEach(card => {
  card.addEventListener('click', () => {
    const t = card.dataset.topic;
    document.querySelectorAll('.setup-panel, #free-topic-row').forEach(p => p.classList.remove('show'));
    if (t === 'free') { $('free-topic-row').classList.add('show'); $('free-topic-input').focus(); return; }
    if (t === 'interview') { $('interview-setup').classList.add('show'); $('interview-role').focus(); return; }
    if (t === 'language') { $('language-setup').classList.add('show'); return; }
    if (t === 'public') { $('public-setup').classList.add('show'); return; }
    launchApp(t, topicMeta[t].label);
  });
});

$('interview-go').addEventListener('click', async () => {
  const role = $('interview-role').value.trim() || 'Software Engineer';
  const industry = $('interview-industry').value;
  const level = $('interview-level').value;
  const style = $('interview-style').value;
  interviewConfig = { role, industry, level, style };
  resumeText = '';
  if (_resumeFile) {
    try {
      const fd = new FormData();
      fd.append('resume', _resumeFile);
      const r = await fetch('/api/parse-resume', { method: 'POST', headers: { 'X-CSRF-Token': _csrfToken }, body: fd });
      const d = await r.json();
      if (r.ok) {
        resumeText = d.text || '';
      } else {
        showResumeError(`Resume upload failed: ${d.error}`);
        return;
      }
    } catch (_) {
      showResumeError('Could not upload resume — check your connection and try again.');
      return;
    }
  }
  launchApp('interview', `${role} · ${industry}`);
});

$('language-go').addEventListener('click', () => {
  const target = $('lang-target').value;
  const level = $('lang-level').value;
  const focus = $('lang-focus').value;
  languageConfig = { target, level, focus };
  launchApp('language', `${target} · ${level}`);
});

$('public-go').addEventListener('click', () => {
  const type = $('public-type').value;
  const audience = $('public-audience').value;
  const topic = $('public-topic').value.trim();
  publicConfig = { type, audience, topic };
  launchApp('public', topic ? `${type} · ${topic}` : type);
});

$('free-topic-go').addEventListener('click', goFree);
$('free-topic-input').addEventListener('keydown', e => { if (e.key === 'Enter') goFree(); });
function goFree() {
  const val = $('free-topic-input').value.trim();
  if (!val) return;
  launchApp('free', val);
}

async function launchApp(key, label) {
  currentTopicKey = key;
  currentTopicLabel = label;
  topicPill.textContent = label;
  setupScreen.classList.add('hidden');
  appScreen.classList.add('show');

  // reset state
  interviewRoundIndex = 0;
  interviewQuestionInRound = 0;
  interviewTotalQ = 0;
  userStopped = false;
  wordCount = 0;
  fillerCount = 0;
  transcript = [];
  transcriptEl.innerHTML = '';
  updateLiveStats();

  if (key === 'interview') {
    interviewProgress.classList.add('show');
    $('lang-bar').classList.remove('show');
    updateInterviewProgress();
    $('drawer-title').textContent = 'Interview report';
  } else if (key === 'language') {
    interviewProgress.classList.remove('show');
    $('lang-bar').classList.add('show');
    $('lang-bar-text').textContent = `${languageConfig.target} · ${languageConfig.focus}`;
    $('lang-xp').textContent = '⭐ 0 XP';
    langXP = 0;
    langLesson = { word: '', meaning: '', lessonNum: 0, waitingForPractice: false, pendingTip: '' };
    $('drawer-title').textContent = 'Language learning report';
  } else {
    interviewProgress.classList.remove('show');
    $('lang-bar').classList.remove('show');
    $('drawer-title').textContent = 'Your feedback report';
  }

  setupSpeechRecognition();
  setStatus('connecting…');

  // Ensure CSRF token is ready before the first API call
  await csrfReady;
  if (!_csrfToken) await refreshCsrfToken();

  setStatus('tap mic or type to start');
  sendGreeting();
}

$('change-topic-btn').addEventListener('click', () => {
  killRecognition();
  window.speechSynthesis && window.speechSynthesis.cancel();
  isSpeaking = false;
  isProcessing = false;
  appScreen.classList.remove('show');
  setupScreen.classList.remove('hidden');
  interviewProgress.classList.remove('show');
  $('lang-bar').classList.remove('show');
  transcript = [];
  transcriptEl.innerHTML = '';
  $('free-topic-row').classList.remove('show');
  $('interview-setup').classList.remove('show');
  $('language-setup').classList.remove('show');
  $('public-setup').classList.remove('show');
  $('free-topic-input').value = '';
});

// ---------- INTERVIEW HELPERS ----------
function advanceInterviewRound() {
  interviewQuestionInRound++;
  interviewTotalQ++;
  if (interviewQuestionInRound >= QUESTIONS_PER_ROUND) {
    interviewQuestionInRound = 0;
    if (interviewRoundIndex < INTERVIEW_ROUNDS.length - 1) interviewRoundIndex++;
  }
  updateInterviewProgress();
}

function updateInterviewProgress() {
  document.querySelectorAll('.progress-step').forEach((el, i) => {
    el.classList.toggle('active', i === interviewRoundIndex);
    el.classList.toggle('done', i < interviewRoundIndex);
  });
  $('question-counter').textContent = `Q ${interviewTotalQ} / ${TOTAL_INTERVIEW_Q}`;
}

// ---------- GREETING ----------
async function sendGreeting() {
  setStatus('thinking…');
  const greetMsg = currentTopicKey === 'interview'
    ? `[START] Greet the candidate warmly, introduce yourself as Alex their interview coach, briefly explain the interview structure (${INTERVIEW_ROUNDS.length} rounds: ${INTERVIEW_ROUNDS.join(', ')}), then ask the first intro question. Keep it to 3-4 sentences.`
    : currentTopicKey === 'language'
      ? `Start with ONE short English welcome sentence, then immediately show the Lesson 1 card for the SINGLE WORD "Hello" in ${languageConfig.target}. Use the EXACT lesson card format — the practice target must be the single word only, not a full sentence. Target language: ${languageConfig.target}. Level: ${languageConfig.level}. Focus: ${languageConfig.focus}. Plain text only, no JSON.`
      : `[START] Greet the learner warmly, introduce yourself as Alex, and kick off with your first question or prompt. 2-3 sentences.`;
  try {
    const data = await apiCall('chat', [{ role: 'user', content: greetMsg }]);
    const parsed = parseJSON(data);
    const replyText = parsed.reply || "Hey! I'm Alex. Let's get started!";
    // Extract first lesson word from greeting
    if (currentTopicKey === 'language') {
      const wordMatch = replyText.match(/🗣\s*([^\n]+)/);
      const meaningMatch = replyText.match(/Lesson\s*(\d+):\s*([^\n]+)/);
      if (wordMatch) {
        langLesson.word = wordMatch[1].trim();
        langLesson.waitingForPractice = true;
        langLesson.lessonNum = 1;
        if (meaningMatch) langLesson.meaning = meaningMatch[2].trim();
      }
    }
    pushAI(replyText);
  } catch (e) {
    setStatus('tap mic or type to start');
  }
}

// ---------- SPEECH RECOGNITION ----------
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setStatus("voice input isn't supported — type instead");
    $('mic-orb').style.opacity = '0.4';
    $('mic-orb').style.cursor = 'not-allowed';
  }
  killRecognition();
}

function killRecognition() {
  if (recognition) {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch (_) {}
    recognition = null;
  }
  isListening = false;
  orbWrap.classList.remove('listening');
  interimPreview.textContent = '';
}

// Start mic — called after TTS ends (auto) or on tap (manual)
function startMic() {
  if (isListening || isSpeaking || isProcessing) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  killRecognition();
  const r = new SR();
  r.continuous = true;        // keep mic open — don't stop after one result
  r.interimResults = true;
  r.lang = 'en-US';
  r.maxAlternatives = 1;

  r.onresult = e => {
    // Hard block: discard everything while Alex is speaking or cooldown active
    if (isSpeaking || isProcessing || (Date.now() - ttsEndedAt < 2000)) {
      interimPreview.textContent = '';
      return;
    }
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += chunk; else interim += chunk;
    }
    interimPreview.textContent = interim;
    if (final.trim()) {
      interimPreview.textContent = '';
      killRecognition();  // stop mic while processing
      handleUserUtterance(final.trim());
    }
  };

  r.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    isListening = false;
    orbWrap.classList.remove('listening');
    interimPreview.textContent = '';
    if (e.error === 'not-allowed' || e.error === 'permission-denied') {
      setStatus('microphone blocked — allow access in browser settings');
    } else {
      setStatus('mic error — tap to retry');
    }
  };

  r.onend = () => {
    // Only update UI if this instance is still the active one
    if (recognition === r) {
      isListening = false;
      orbWrap.classList.remove('listening');
      interimPreview.textContent = '';
      if (!isSpeaking && !isProcessing) setStatus('tap mic or type');
    }
  };

  recognition = r;
  try {
    r.start();
    isListening = true;
    orbWrap.classList.add('listening');
    setStatus('listening…');
  } catch (_) {
    recognition = null;
    isListening = false;
  }
}

$('mic-orb').addEventListener('click', () => {
  if (isSpeaking) {
    // Interrupt Alex
    window.speechSynthesis.cancel();
    isSpeaking = false;
    ttsEndedAt = 0;
    orbWrap.classList.remove('speaking');
  }
  if (isListening) {
    userStopped = true;
    killRecognition();
    setStatus('tap mic or type');
    return;
  }
  userStopped = false;
  ttsEndedAt = 0;
  startMic();
});

$('fallback-send').addEventListener('click', sendFallback);
$('fallback-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendFallback(); });
function sendFallback() {
  const val = $('fallback-input').value.trim();
  if (!val) return;
  $('fallback-input').value = '';
  handleUserUtterance(val);
}



function updateLiveStats() {
  $('stat-words').textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
  $('stat-fillers').textContent = `${fillerCount} filler${fillerCount !== 1 ? 's' : ''}`;
}

async function handleUserUtterance(text) {
  if (isSpeaking || isProcessing) return;
  isProcessing = true;
  text = decodeHtmlEntities(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  wordCount += words.length;
  const lower = text.toLowerCase();
  fillerCount += FILLERS.reduce((n, f) => {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    return n + (lower.match(re) || []).length;
  }, 0);
  updateLiveStats();

  const turn = { role: 'user', text, tip: null, tipGood: false, star: null };
  transcript.push(turn);
  renderTranscript();
  setStatus('thinking…');

  try {
    // Build history — must always start with a user message
    // Filter out any leading ai turns (e.g. greeting) so the model doesn't roleplay both sides
    const raw = transcript.map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }));
    const firstUserIdx = raw.findIndex(m => m.role === 'user');
    const history = firstUserIdx >= 0 ? raw.slice(firstUserIdx) : raw;

    // Language mode: check practice attempt client-side before sending to AI
    if (currentTopicKey === 'language' && langLesson.waitingForPractice && langLesson.word) {
      const attempt = text.trim().toLowerCase().replace(/[^a-z0-9äöüáéíóúàèìòùâêîôûñçß\s]/gi, '');
      const target = langLesson.word.toLowerCase().replace(/[^a-z0-9äöüáéíóúàèìòùâêîôûñçß\s]/gi, '');
      // Looser match for spoken input — mic transcribes phonetically so spelling may differ
      const isCorrect = attempt === target ||
        similarity(attempt, target) >= 0.82 ||
        attempt.split(' ').some(w => w === target || similarity(w, target) >= 0.85);
      const dontKnow = /don.?t know|not sure|no idea|skip|help|idk/i.test(text);
      if (isCorrect && !dontKnow) {
        langXP += 20;
        $('lang-xp').textContent = `⭐ ${langXP} XP`;
        langLesson.waitingForPractice = false;
        history[history.length - 1].content = `[CORRECT] The learner correctly said "${langLesson.word}" (${langLesson.meaning}). Give ONE sentence of specific praise about their pronunciation effort, then immediately show Lesson ${langLesson.lessonNum + 1} card for the next word. Include the full pronunciation and tone lines.`;
      } else {
        history[history.length - 1].content = `[WRONG] The learner tried to say "${langLesson.word}" (${langLesson.meaning}) but said "${text}". Gently correct their pronunciation — explain what they should focus on (stress, tone, mouth shape). Repeat the full lesson card including the pronunciation phonetic guide and tone line. Ask them to try again.`;
      }
    }

    const data = await apiCall('chat', history);
    const parsed = parseJSON(data);
    const replyText = parsed.reply || "Let's keep going.";

    // Extract the new target word from the AI reply for next practice check
    if (currentTopicKey === 'language') {
      const wordMatch = replyText.match(/🗣\s*([^\n]+)/);
      const meaningMatch = replyText.match(/Lesson\s*(\d+):\s*([^\n]+)/);
      const toneMatch = replyText.match(/🎵[^\n]+/);
      if (wordMatch) {
        langLesson.word = wordMatch[1].trim();
        langLesson.waitingForPractice = true;
        if (meaningMatch) {
          langLesson.lessonNum = parseInt(meaningMatch[1]) || langLesson.lessonNum + 1;
          langLesson.meaning = meaningMatch[2].trim();
        }
      }
      // Set tip to the tone/pronunciation line for the user's next turn
      if (toneMatch) {
        langLesson.pendingTip = toneMatch[0].replace('🎵', '').replace('Tone/rhythm:', '').trim();
      }
      langXP += 5;
      $('lang-xp').textContent = `⭐ ${langXP} XP`;
    }

    // For language mode, use the pronunciation/tone tip from the last lesson card
    if (currentTopicKey === 'language') {
      turn.tip = langLesson.pendingTip || "Focus on stress and tone";
      turn.tipGood = true;
      langLesson.pendingTip = '';
    } else {
      turn.tip = parsed.tip || "";
      turn.tipGood = !!parsed.tipGood;
    }
    if (currentTopicKey === 'interview') {
      turn.star = parsed.star || null;
      advanceInterviewRound();
    }
    renderTranscript();
    pushAI(replyText);
  } catch (err) {
    transcript.pop();
    renderTranscript();
    setStatus('connection issue — tap mic or type to retry');
  } finally {
    isProcessing = false;
  }
}

function pushAI(text) {
  text = decodeHtmlEntities(text);
  const aiTurn = { role: 'ai', text, tip: null, tipGood: false, star: null };
  transcript.push(aiTurn);
  renderTranscript();
  userStopped = false; // reset so mic auto-starts after Alex speaks
  speak(text);
}

// ---------- STRING SIMILARITY (Levenshtein-based, for practice checking) ----------
// Normalized edit distance: accounts for insertions, deletions, substitutions and position.
// Much more accurate than character-presence matching for phonetic mic input.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function similarity(a, b) {
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return (longer - levenshtein(a, b)) / longer;
}

// Set isSpeaking immediately when speak() is called — not async in onstart
function speak(text) {
  if (!('speechSynthesis' in window)) { setStatus('tap the mic to talk'); return; }

  // Set speaking flag IMMEDIATELY — before any async callbacks
  isSpeaking = true;
  ttsEndedAt = 0;
  orbWrap.classList.add('speaking');
  setStatus('Alex is talking…');

  window.speechSynthesis.cancel();
  killRecognition();
  interimPreview.textContent = '';

  // If voice not loaded yet, wait for it then speak
  if (!lockedVoice) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      lockedVoice = pickVoice(voices);
    } else {
      // Voices not ready — wait for onvoiceschanged then retry
      window.speechSynthesis.onvoiceschanged = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length) lockedVoice = pickVoice(v);
        window.speechSynthesis.onvoiceschanged = null;
        speak(text);
      };
      return;
    }
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1; utter.pitch = 1;
  utter.voice = lockedVoice || null;
  utter.onend = () => {
    isSpeaking = false;
    ttsEndedAt = Date.now();
    orbWrap.classList.remove('speaking');
    interimPreview.textContent = '';
    setStatus('tap mic or type');
    // Auto-start mic 2s after TTS ends — matches the onresult cooldown exactly
    if (!userStopped) setTimeout(() => startMic(), 2000);
  };
  utter.onerror = () => {
    isSpeaking = false;
    ttsEndedAt = Date.now();
    orbWrap.classList.remove('speaking');
    interimPreview.textContent = '';
    setStatus('tap mic or type');
    if (!userStopped) setTimeout(() => startMic(), 2000);
  };
  window.speechSynthesis.speak(utter);
}
if ('speechSynthesis' in window) {
  // Pick voice once when voices are ready and never change it again
  const initVoice = () => {
    if (lockedVoice) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) lockedVoice = pickVoice(voices);
  };
  window.speechSynthesis.onvoiceschanged = initVoice;
  initVoice();
}

function pickVoice(voices) {
  return voices.find(v => /en-US|en_US/.test(v.lang) && /Google US English/i.test(v.name))
    || voices.find(v => /en-US|en_US/.test(v.lang) && !v.localService)
    || voices.find(v => /en-US|en_US/.test(v.lang))
    || voices.find(v => /^en/.test(v.lang));
}


// ---------- RENDER ----------
function renderTranscript() {
  transcriptEl.innerHTML = '';
  transcript.forEach(t => {
    const row = document.createElement('div');
    row.className = 'bubble-row ' + (t.role === 'user' ? 'user' : 'ai');
    if (t.role === 'ai' && currentTopicKey === 'language') row.classList.add('lang-card');
    const label = document.createElement('div');
    label.className = 'role-label';
    label.textContent = t.role === 'user' ? 'you' : 'alex';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (t.role === 'ai' && currentTopicKey === 'language') {
      // Safe line-break rendering — no innerHTML with unsanitized content
      t.text.split('\n').forEach((line, i, arr) => {
        const span = document.createElement('span');
        span.textContent = line;
        bubble.appendChild(span);
        if (i < arr.length - 1) bubble.appendChild(document.createElement('br'));
      });
    } else {
      bubble.textContent = t.text;
    }
    row.appendChild(label);
    row.appendChild(bubble);

    if (t.role === 'user' && t.tip) {
      const chip = document.createElement('div');
      chip.className = 'tip-chip' + (t.tipGood ? '' : ' improve');
      chip.textContent = (t.tipGood ? '✓ ' : '→ ') + t.tip;
      row.appendChild(chip);
    }

    if (t.role === 'user' && t.star && t.star.overall !== null && t.star.overall !== undefined) {
      row.appendChild(renderStarCard(t.star));
    }

    transcriptEl.appendChild(row);
  });
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function renderStarCard(star) {
  const wrap = document.createElement('div');
  wrap.className = 'star-card';
  const header = document.createElement('div');
  header.className = 'star-header';
  const overall = document.createElement('span');
  overall.className = 'star-overall';
  overall.textContent = star.overall ?? '—';
  const denom = document.createElement('span');
  denom.className = 'star-denom';
  denom.textContent = '/10';
  overall.appendChild(denom);
  const starLabel = document.createElement('span');
  starLabel.className = 'star-label';
  starLabel.textContent = 'STAR score';
  header.appendChild(overall);
  header.appendChild(starLabel);
  wrap.appendChild(header);
  const dimsEl = document.createElement('div');
  dimsEl.className = 'star-dims';
  ['situation', 'task', 'action', 'result'].forEach(d => {
    const dim = document.createElement('div');
    dim.className = 'star-dim';
    const lbl = document.createElement('span');
    lbl.className = 'star-dim-label';
    lbl.textContent = d[0].toUpperCase();
    const track = document.createElement('div');
    track.className = 'star-bar-track';
    const fill = document.createElement('div');
    fill.className = 'star-bar-fill';
    fill.style.width = `${(star[d] || 0) * 10}%`;
    track.appendChild(fill);
    const score = document.createElement('span');
    score.className = 'star-dim-score';
    score.textContent = star[d] ?? '—';
    dim.appendChild(lbl);
    dim.appendChild(track);
    dim.appendChild(score);
    dimsEl.appendChild(dim);
  });
  wrap.appendChild(dimsEl);
  if (star.note) {
    const note = document.createElement('div');
    note.className = 'star-note';
    note.textContent = star.note;
    wrap.appendChild(note);
  }
  return wrap;
}

// ---------- API HELPERS ----------
function buildBody(messages, overrideSystem) {
  const body = {
    topicKey: currentTopicKey,
    topicLabel: currentTopicLabel,
    languageConfig,
    publicConfig,
    interviewConfig,
    interviewRoundIndex,
    resumeText,
    messages
  };
  if (overrideSystem) body.system = overrideSystem;
  return body;
}
// CSRF: server stores HMAC sig in HttpOnly cookie; returns raw token in JSON.
// JS holds the raw token in memory and echoes it in X-CSRF-Token header.
// On 403 we refresh the token once and retry automatically.
let _csrfToken = '';
let _resumeFile = null;

async function refreshCsrfToken() {
  try {
    const r = await fetch('/api/csrf-token');
    const d = await r.json();
    _csrfToken = d.token || '';
  } catch (_) {}
}

// Store the promise so launchApp can await it before the first API call
const csrfReady = refreshCsrfToken();

// Allowlist of permitted API endpoints — prevents any dynamic URL from being passed to fetch
const ALLOWED_ENDPOINTS = { chat: '/api/chat', feedback: '/api/feedback' };

async function apiFetch(endpointKey, body, retried = false) {
  // Resolve URL from allowlist only — never interpolate user input into the URL
  const url = ALLOWED_ENDPOINTS[endpointKey];
  if (!url) throw new Error('Invalid endpoint');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfToken },
    body: JSON.stringify(body)
  });
  // Auto-refresh CSRF token on 403 and retry once
  if (res.status === 403 && !retried) {
    await refreshCsrfToken();
    return apiFetch(endpointKey, body, true);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${errText}`);
  }
  return res.json();
}

function postChat(body) { return apiFetch('chat', body); }
function postFeedback(body) { return apiFetch('feedback', body); }

async function apiCall(endpoint, messages, overrideSystem) {
  if (!ALLOWED_ENDPOINTS[endpoint]) throw new Error('Invalid endpoint');
  const body = buildBody(messages, overrideSystem);
  return endpoint === 'chat' ? postChat(body) : postFeedback(body);
}

function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function parseJSON(data) {
  const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let clean = raw.replace(/```json|```/gi, '').trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(clean);
    if (parsed.reply) parsed.reply = decodeHtmlEntities(parsed.reply);
    if (parsed.tip) parsed.tip = decodeHtmlEntities(parsed.tip);
    return parsed;
  } catch (_) {}

  // Try to find the first complete {...} JSON block
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      if (parsed.reply) parsed.reply = decodeHtmlEntities(parsed.reply);
      if (parsed.tip) parsed.tip = decodeHtmlEntities(parsed.tip);
      return parsed;
    } catch (_) {}
  }

  // Model returned plain text — use it directly as the reply
  const plainText = decodeHtmlEntities(clean);
  return { reply: plainText || "Let's keep going!", tip: '', tipGood: true };
}

// ---------- FEEDBACK DRAWER ----------
const overlay = $('overlay');
const drawer = $('drawer');
const drawerBody = $('drawer-body');

$('open-feedback-btn').addEventListener('click', openDrawer);
$('drawer-close').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

function openDrawer() {
  overlay.classList.add('show');
  drawer.classList.add('show');
  const userTurns = transcript.filter(t => t.role === 'user');
  if (userTurns.length === 0) {
    setDrawerContent([mkEl('p', 'empty-note', 'Have a bit of a conversation first, then check back here.')]);
    return;
  }
  currentTopicKey === 'interview' ? loadInterviewReport() : loadDeepFeedback();
}
function closeDrawer() { overlay.classList.remove('show'); drawer.classList.remove('show'); }

function mkEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function setDrawerContent(nodes) {
  drawerBody.textContent = '';
  nodes.forEach(n => drawerBody.appendChild(n));
}
function mkScoreRow(score, color) {
  const row = mkEl('div', 'fluency-row');
  const s = mkEl('div', 'fluency-score', String(score));
  if (color) s.style.color = color;
  const track = mkEl('div', 'fluency-bar-track');
  const fill = mkEl('div', 'fluency-bar-fill');
  fill.style.width = score + '%';
  if (color) fill.style.background = color;
  track.appendChild(fill);
  row.appendChild(s);
  row.appendChild(track);
  return row;
}

async function loadDeepFeedback() {
  setDrawerContent([mkEl('p', 'loading-line', 'reading back through what you said...')]);
  const userText = transcript.filter(t => t.role === 'user').map((t, i) => `${i + 1}. ${t.text}`).join('\n');
  const system = `You are an encouraging but precise English speaking coach. Analyze ONLY the learner's sentences. Respond ONLY with a raw JSON object, no markdown fences:\n{"fluencyScore":<0-100>,"fluencyNote":"<2-3 sentences>","corrections":[{"original":"...","corrected":"...","explanation":"..."}],"vocabulary":[{"basic":"...","upgrade":"...","example":"..."}],"encouragement":"<one warm specific sentence>"}\nMax 5 corrections, max 5 vocabulary. Quote their actual words.`;
  try {
    const data = await apiCall('feedback', [{ role: 'user', content: `Learner said:\n${userText}` }], system);
    renderDeepFeedback(parseJSON(data));
  } catch (e) {
    setDrawerContent([mkEl('p', 'loading-line', "Couldn't generate the report — try again.")]);
  }
}

function renderDeepFeedback(fb) {
  const score = Math.max(0, Math.min(100, fb.fluencyScore || 0));
  const nodes = [mkScoreRow(score), mkEl('p', 'fluency-note', fb.fluencyNote || ''), mkEl('p', 'section-title', 'Grammar & phrasing')];
  if (!(fb.corrections || []).length) {
    nodes.push(mkEl('p', 'explain-text', 'No issues spotted — clean sentences throughout.'));
  } else {
    fb.corrections.forEach(c => {
      const item = mkEl('div', 'correction-item');
      const r1 = mkEl('div', 'diff-row'); r1.appendChild(mkEl('span', 'diff-orig', c.original)); item.appendChild(r1);
      const r2 = mkEl('div', 'diff-row'); r2.appendChild(document.createTextNode('→ ')); r2.appendChild(mkEl('span', 'diff-fix', c.corrected)); item.appendChild(r2);
      item.appendChild(mkEl('div', 'explain-text', c.explanation));
      nodes.push(item);
    });
  }
  const vt = mkEl('p', 'section-title', 'Vocabulary boosts'); vt.style.marginTop = '22px'; nodes.push(vt);
  if (!(fb.vocabulary || []).length) {
    nodes.push(mkEl('p', 'explain-text', 'Good word choices — nothing to upgrade.'));
  } else {
    fb.vocabulary.forEach(v => {
      const item = mkEl('div', 'vocab-item');
      const r = mkEl('div', 'diff-row');
      r.appendChild(mkEl('span', 'diff-orig', v.basic));
      r.appendChild(document.createTextNode(' → '));
      r.appendChild(mkEl('span', 'diff-fix', v.upgrade));
      item.appendChild(r);
      item.appendChild(mkEl('div', 'explain-text', v.example));
      nodes.push(item);
    });
  }
  nodes.push(mkEl('div', 'encourage-box', fb.encouragement || ''));
  setDrawerContent(nodes);
}

async function loadInterviewReport() {
  setDrawerContent([mkEl('p', 'loading-line', 'compiling your interview report...')]);
  const qa = transcript.reduce((acc, t, i) => {
    if (t.role === 'ai' && transcript[i + 1]?.role === 'user') acc.push({ q: t.text, a: transcript[i + 1].text, star: transcript[i + 1].star });
    return acc;
  }, []);
  const qaText = qa.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join('\n\n');
  const system = `You are an expert interview coach. Analyze this mock interview transcript. Respond ONLY with a raw JSON object, no markdown fences:\n{"overallScore":<0-100>,"overallNote":"<2-3 sentences on overall performance>","strengths":["<specific strength 1>","<specific strength 2>","<specific strength 3>"],"improvements":["<specific improvement 1>","<specific improvement 2>","<specific improvement 3>"],"questionScores":[{"q":"<short question summary>","score":<0-10>,"feedback":"<one sentence>"}],"hiringVerdict":"<one sentence: would you recommend moving forward and why>","encouragement":"<one warm specific closing sentence>"}`;
  try {
    const data = await apiCall('feedback', [{ role: 'user', content: `Mock interview for ${interviewConfig.role} (${interviewConfig.industry}, ${interviewConfig.level}):\n\n${qaText}` }], system);
    renderInterviewReport(parseJSON(data));
  } catch (e) {
    setDrawerContent([mkEl('p', 'loading-line', "Couldn't generate the report — try again.")]);
  }
}

function renderInterviewReport(fb) {
  const score = Math.max(0, Math.min(100, fb.overallScore || 0));
  const scoreColor = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--accent)' : 'var(--danger)';
  const nodes = [mkScoreRow(score, scoreColor), mkEl('p', 'fluency-note', fb.overallNote || '')];
  const verdict = mkEl('div', `verdict-box ${score >= 60 ? 'verdict-pass' : 'verdict-fail'}`);
  const icon = mkEl('span', 'verdict-icon', score >= 60 ? '✓' : '✗');
  verdict.appendChild(icon);
  verdict.appendChild(document.createTextNode(' ' + (fb.hiringVerdict || '')));
  nodes.push(verdict);
  const st1 = mkEl('p', 'section-title', 'Top strengths'); st1.style.marginTop = '22px'; nodes.push(st1);
  (fb.strengths || []).forEach(s => { const el = mkEl('div', 'strength-item'); el.textContent = '✓ ' + s; nodes.push(el); });
  const st2 = mkEl('p', 'section-title', 'Areas to improve'); st2.style.marginTop = '18px'; nodes.push(st2);
  (fb.improvements || []).forEach(s => { const el = mkEl('div', 'improve-item'); el.textContent = '→ ' + s; nodes.push(el); });
  if ((fb.questionScores || []).length) {
    const st3 = mkEl('p', 'section-title', 'Per-question scores'); st3.style.marginTop = '18px'; nodes.push(st3);
    fb.questionScores.forEach((q, i) => {
      const pct = (q.score || 0) * 10;
      const qColor = q.score >= 7 ? 'var(--success)' : q.score >= 5 ? 'var(--accent)' : 'var(--danger)';
      const item = mkEl('div', 'correction-item');
      const sr = mkEl('div'); sr.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px';
      const qs = mkEl('span', null, `${q.score}/10`); qs.style.cssText = `font-family:'Fraunces',serif;font-size:1.3rem;font-weight:600;color:${qColor}`;
      const qt = mkEl('div', 'fluency-bar-track'); qt.style.flex = '1';
      const qf = mkEl('div', 'fluency-bar-fill'); qf.style.width = pct + '%'; qf.style.background = qColor;
      qt.appendChild(qf); sr.appendChild(qs); sr.appendChild(qt); item.appendChild(sr);
      const ql = mkEl('div', 'diff-row', `Q${i + 1}: ${q.q}`); ql.style.cssText = 'font-size:0.8rem;color:var(--ink-soft);margin-bottom:4px';
      item.appendChild(ql);
      item.appendChild(mkEl('div', 'explain-text', q.feedback));
      nodes.push(item);
    });
  }
  nodes.push(mkEl('div', 'encourage-box', fb.encouragement || ''));
  setDrawerContent(nodes);
}
