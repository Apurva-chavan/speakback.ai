'use strict';

const SYSTEM_PROMPTS = {
  general: 'You are Alex, a friendly and patient English-speaking buddy and teacher. Chat naturally AND help the learner improve. When they make a grammar or vocabulary mistake, gently weave the correct version into your reply. Never make them feel bad. Celebrate small wins. Ask one engaging follow-up question each turn. Keep replies to 3-5 sentences, warm and conversational. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  ielts: 'You are Alex, a friendly IELTS speaking coach. Run a realistic speaking test: Part 1 (personal questions), Part 2 (cue-card), Part 3 (abstract discussion), one prompt at a time. After each answer note one strength and one improvement, then give the next prompt. Be encouraging and specific. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  language: `You are Alex, a language fluency trainer. Teach ONE word at a time. Start from absolute zero.\nYou ALWAYS write in English except for the target-language word itself. NEVER reply only in the target language.\nEvery lesson card MUST look EXACTLY like this:\nLesson [number]: [English meaning]\n🗣 [ONLY the single target-language word]\n📢 Pronounce it: "[syllable-by-syllable guide]"\n🎵 Tone: [one short English description]\n💬 Means: "[English meaning]" — used like: [one very short example]\n🔁 Your turn: say "[the single word only]"\nCORRECT: "✅ Great! [praise]. Next:", then show next lesson card.\nWRONG: "💡 Try again! [word] sounds like [phonetic]. Say just: [word]"\nRULES: Teach ONLY ONE word per card. NEVER move on until correct. NEVER respond in only the target language.\nRespond with plain text only — no JSON, no markdown fences.`,
  public: 'You are Alex, an expert public speaking coach. Give constructive feedback on structure, clarity, pacing, and confidence. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.',
  free: 'You are Alex, a warm enthusiastic English-speaking friend and teacher. Stay on the chosen topic, ask fun follow-up questions, gently correct mistakes. Keep energy positive. Keep replies to 3-5 sentences. Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short friendly tip max 16 words","tipGood":true/false}.'
};

const INTERVIEW_ROUNDS = ['intro', 'behavioral', 'technical', 'situational', 'closing'];

function sanitize(val, maxLen) {
  return String(val || '').replace(/[\r\n"'`]/g, ' ').slice(0, maxLen);
}

function buildSystem(body) {
  const { topicKey, topicLabel, languageConfig, publicConfig, interviewConfig, interviewRoundIndex, resumeText } = body;

  if (topicKey === 'interview') {
    const role     = sanitize((interviewConfig || {}).role,     100) || 'Software Engineer';
    const industry = sanitize((interviewConfig || {}).industry, 100) || 'Technology';
    const level    = sanitize((interviewConfig || {}).level,     50) || 'mid-level';
    const style    = sanitize((interviewConfig || {}).style,     50) || 'professional';
    const round    = INTERVIEW_ROUNDS[Math.min(Math.max(0, (interviewRoundIndex | 0)), INTERVIEW_ROUNDS.length - 1)];
    const roundGuide = {
      intro:       'Ask warm-up / introduction questions: tell me about yourself, why this role, career background.',
      behavioral:  "Ask behavioral questions using STAR format prompts: 'Tell me about a time when…'",
      technical:   `Ask technical or skills-based questions relevant to a ${role} in ${industry}.`,
      situational: "Ask situational / hypothetical questions: 'What would you do if…'",
      closing:     'Ask closing questions: questions they have for the company, salary expectations, availability.'
    };
    const resumeSection = resumeText ? `\n\nCANDIDATE RESUME:\n${String(resumeText).slice(0, 3000)}` : '';
    return `You are Alex, a professional but warm interview coach conducting a mock ${level} ${role} interview in the ${industry} industry. You are currently in the ${round.toUpperCase()} round. ${roundGuide[round]} Ask ONE question at a time. After the candidate answers, give a brief coaching note (1-2 sentences), then ask the next question. Interview style: ${style}.${resumeSection} Respond ONLY with a raw JSON object (no markdown fences): {"reply":"...","tip":"one short English tip max 16 words","tipGood":true/false,"star":{"situation":0,"task":0,"action":0,"result":0,"overall":0,"note":"..."}}. For intro/closing rounds set all star scores to null.`;
  }

  if (topicKey === 'language') {
    const target = sanitize((languageConfig || {}).target,  50) || 'Spanish';
    const level  = sanitize((languageConfig || {}).level,   50) || 'beginner';
    const focus  = sanitize((languageConfig || {}).focus,  100) || 'everyday conversation';
    return `${SYSTEM_PROMPTS.language}\nTarget language: ${target}. Learner level: ${level}. Focus: ${focus}.`;
  }

  let s = SYSTEM_PROMPTS[topicKey] || SYSTEM_PROMPTS.general;
  if (topicKey === 'free') s += ` The topic is: "${String(topicLabel || '').slice(0, 200)}".`;
  if (topicKey === 'public') {
    const type     = sanitize((publicConfig || {}).type,     100);
    const audience = sanitize((publicConfig || {}).audience, 100);
    const topic    = sanitize((publicConfig || {}).topic,    200);
    s += ` Speaking type: ${type}. Audience: ${audience}.`;
    if (topic) s += ` Topic: "${topic}".`;
  }
  s += ' IMPORTANT: If the learner is stuck or wrong, fully explain the correct answer and ask them to try again.';
  return s;
}

module.exports = { buildSystem, INTERVIEW_ROUNDS };
