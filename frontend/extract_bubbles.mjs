import { createWorker } from 'tesseract.js';
import fs from 'fs';

const imagePath = process.argv[2];

if (!imagePath || !fs.existsSync(imagePath)) {
  console.log(JSON.stringify({ status: 'error', error: 'Image file not found: ' + imagePath, bubbles: [] }));
  process.exit(0);
}

function clusterWordsIntoBubbles(words) {
  // Sort words top-to-bottom
  words.sort((a, b) => a.y - b.y || a.x - b.x);

  const clusters = [];

  for (const w of words) {
    let matchedCluster = null;

    for (const c of clusters) {
      const avgH = c.avgH || w.h;
      const horizDist = Math.max(0, Math.max(c.bbox.x - (w.x + w.w), w.x - (c.bbox.x + c.bbox.w)));
      const vertDist = Math.max(0, Math.max(c.bbox.y - (w.y + w.h), w.y - (c.bbox.y + c.bbox.h)));

      // Close horizontally (< 2.6 line height) and vertically (< 1.5 line height)
      if (horizDist < avgH * 2.6 && vertDist < avgH * 1.5) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.words.push(w);
      const minX = Math.min(matchedCluster.bbox.x, w.x);
      const minY = Math.min(matchedCluster.bbox.y, w.y);
      const maxX = Math.max(matchedCluster.bbox.x + matchedCluster.bbox.w, w.x + w.w);
      const maxY = Math.max(matchedCluster.bbox.y + matchedCluster.bbox.h, w.y + w.h);
      matchedCluster.bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      matchedCluster.avgH = (matchedCluster.avgH * (matchedCluster.words.length - 1) + w.h) / matchedCluster.words.length;
    } else {
      clusters.push({
        words: [w],
        bbox: { x: w.x, y: w.y, w: w.w, h: w.h },
        avgH: w.h
      });
    }
  }

  // Filter and format clusters
  const validBubbles = [];
  let bIdx = 1;

  for (const c of clusters) {
    // Sort words in reading order: top-to-bottom, left-to-right within line
    c.words.sort((a, b) => {
      const aMidY = a.y + a.h / 2;
      const bMidY = b.y + b.h / 2;
      const minH = Math.min(a.h, b.h);
      if (Math.abs(aMidY - bMidY) < minH * 0.75) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    const rawText = c.words.map(w => w.text).join(' ').trim();
    // Clean up comic noise symbols
    const cleanText = rawText
      .replace(/[|\\/_~=><§@#$%^&*()\[\]{}—–]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check letter density and minimum length
    const lettersCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    if (lettersCount < 3 || (lettersCount / cleanText.length) < 0.65) {
      continue;
    }

    // Filter out full-page runaway bounding boxes
    if (c.bbox.w > 2000 || c.bbox.h > 1500) {
      continue;
    }

    const padX = Math.round(c.avgH * 0.6) + 12;
    const padY = Math.round(c.avgH * 0.4) + 8;

    validBubbles.push({
      id: `b_${bIdx++}`,
      text_en: cleanText,
      bbox: {
        x: Math.max(0, c.bbox.x - padX),
        y: Math.max(0, c.bbox.y - padY),
        width: c.bbox.w + padX * 2,
        height: c.bbox.h + padY * 2
      },
      confidence: Math.round(c.words.reduce((sum, w) => sum + w.conf, 0) / c.words.length)
    });
  }

  return validBubbles;
}

async function extract() {
  try {
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imagePath, {}, { tsv: true });
    await worker.terminate();

    const lines = ret.data.tsv.split('\n');
    const validWords = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 12 && parts[0] === '5' && parts[11] && parts[11].trim()) {
        const conf = parseFloat(parts[10]);
        const text = parts[11].trim();

        // Only keep words with confidence >= 50 and containing Latin letters
        if (conf >= 50 && /[a-zA-Z]/.test(text) && text.length >= 2) {
          validWords.push({
            conf,
            x: parseInt(parts[6], 10),
            y: parseInt(parts[7], 10),
            w: parseInt(parts[8], 10),
            h: parseInt(parts[9], 10),
            text
          });
        }
      }
    }

    const bubbles = clusterWordsIntoBubbles(validWords);
    console.log(JSON.stringify({ status: 'ok', bubbles }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'error', error: err.message, bubbles: [] }));
  }
}

extract();
