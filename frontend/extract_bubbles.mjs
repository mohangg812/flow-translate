import { createWorker } from 'tesseract.js';
import fs from 'fs';

const imagePath = process.argv[2];

if (!imagePath || !fs.existsSync(imagePath)) {
  console.log(JSON.stringify({ error: 'Image file not found: ' + imagePath, bubbles: [] }));
  process.exit(0);
}

async function extract() {
  try {
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imagePath, {}, { tsv: true });
    await worker.terminate();

    const tsv = ret.data.tsv || '';
    const lines = tsv.split('\n');

    // Group words by block_num and par_num
    const paragraphs = new Map();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 12) continue;
      const level = parseInt(parts[0], 10);
      const blockNum = parseInt(parts[2], 10);
      const parNum = parseInt(parts[3], 10);
      const left = parseInt(parts[6], 10);
      const top = parseInt(parts[7], 10);
      const width = parseInt(parts[8], 10);
      const height = parseInt(parts[9], 10);
      const conf = parseFloat(parts[10]);
      const text = (parts[11] || '').trim();

      const key = `${blockNum}_${parNum}`;

      if (level === 3) {
        // Paragraph boundary
        if (!paragraphs.has(key)) {
          paragraphs.set(key, {
            left, top, width, height,
            words: [],
            conf: 0
          });
        } else {
          const p = paragraphs.get(key);
          p.left = left;
          p.top = top;
          p.width = width;
          p.height = height;
        }
      } else if (level === 5 && text) {
        if (!paragraphs.has(key)) {
          paragraphs.set(key, {
            left, top, width, height,
            words: [],
            conf: 0
          });
        }
        const p = paragraphs.get(key);
        p.words.push(text);
        p.conf = (p.conf + (conf > 0 ? conf : 75)) / (p.words.length > 1 ? 2 : 1);
      }
    }

    const bubbles = [];
    let idx = 1;
    for (const [key, p] of paragraphs.entries()) {
      const combinedText = p.words.join(' ').replace(/\s+/g, ' ').trim();
      if (combinedText.length >= 2) {
        // Expand bbox slightly to encompass comic bubble area
        const padX = Math.round(p.width * 0.12) + 12;
        const padY = Math.round(p.height * 0.20) + 10;
        bubbles.push({
          id: `b_${idx++}`,
          text_en: combinedText,
          bbox: {
            x: Math.max(0, p.left - padX),
            y: Math.max(0, p.top - padY),
            width: p.width + padX * 2,
            height: p.height + padY * 2
          },
          confidence: Math.round(p.conf)
        });
      }
    }

    console.log(JSON.stringify({ status: 'ok', bubbles }));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message, bubbles: [] }));
  }
}

extract();
