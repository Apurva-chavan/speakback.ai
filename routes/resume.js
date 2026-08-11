'use strict';
const express = require('express');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const rateLimit = require('express-rate-limit');
const { enforceOrigin, csrfProtection } = require('../middleware/security');

const router = express.Router();

const resumeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many uploads — try again in a minute.' }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.doc', '.docx']);

router.post('/', enforceOrigin, resumeLimiter, csrfProtection, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received. Please select a file and try again.' });

  const { mimetype, originalname, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({ error: 'Unsupported file type. Use PDF, TXT, DOC, or DOCX.' });
  }

  try {
    let text = '';

    if (ext === '.pdf' || mimetype === 'application/pdf') {
      try {
        const data = await pdfParse(buffer);
        text = data.text || '';
      } catch (pdfErr) {
        console.error('[parse-resume] pdf-parse failed:', pdfErr.message);
        return res.status(422).json({ error: 'Could not read PDF. It may be encrypted or scanned. Try copy-pasting your resume as a .txt file.' });
      }
    } else if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (ext === '.doc' || mimetype === 'application/msword') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } catch {
        return res.status(422).json({ error: 'Legacy .doc files are not reliably supported. Please save as .docx or .txt and re-upload.' });
      }
    } else {
      text = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    }

    const trimmed = text.trim();
    if (!trimmed) return res.status(422).json({ error: 'File appears to be empty or unreadable. Try a .txt or .docx version.' });

    res.json({ text: trimmed });
  } catch (err) {
    console.error('[parse-resume]', err.message);
    res.status(422).json({ error: 'Could not read file. Try saving your resume as a .txt or .docx file.' });
  }
});

module.exports = router;
