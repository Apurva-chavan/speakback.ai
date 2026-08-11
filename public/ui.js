'use strict';

// ── Focus chips ────────────────────────────────────────────────────────────
document.querySelectorAll('.focus-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.focus-chip').forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-pressed', 'false');
    });
    chip.classList.add('active');
    chip.setAttribute('aria-pressed', 'true');
    document.getElementById('lang-focus').value = chip.dataset.val;
  });
});

// ── Theme toggle ───────────────────────────────────────────────────────────
const THEME_KEY = 'sb-theme';
const toggleBtns = document.querySelectorAll('.theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const dark = theme === 'dark';
  toggleBtns.forEach(b => {
    b.querySelector('.t-icon').textContent = dark ? '☀️' : '🌙';
    b.querySelector('.t-label').textContent = dark ? 'Light' : 'Dark';
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  });
}

toggleBtns.forEach(b => b.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}));

applyTheme(localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

// ── Resume upload UI ───────────────────────────────────────────────────────
const zone        = document.getElementById('resume-zone');
const fileInput   = document.getElementById('resume-file');
const zoneInner   = document.getElementById('resume-zone-inner');
const resumeLoaded   = document.getElementById('resume-loaded');
const resumeFilename = document.getElementById('resume-filename');

zoneInner.addEventListener('click', () => fileInput.click());
document.querySelector('.resume-browse').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });

zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleResumeFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleResumeFile(fileInput.files[0]); });

function handleResumeFile(file) {
  resumeFilename.textContent = file.name;
  zoneInner.style.display = 'none';
  resumeLoaded.style.display = 'flex';
  // _resumeFile is declared in script.js
  if (typeof _resumeFile !== 'undefined') _resumeFile = file;
  else window._pendingResumeFile = file;
}

document.getElementById('resume-remove').addEventListener('click', () => {
  zoneInner.style.display = 'flex';
  resumeLoaded.style.display = 'none';
  fileInput.value = '';
  if (typeof _resumeFile !== 'undefined') _resumeFile = null;
  else window._pendingResumeFile = null;
});

// ── Service worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
