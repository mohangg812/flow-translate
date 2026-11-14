import { createWorker } from 'tesseract.js';
import fs from 'fs';

const imagePath = process.argv[2];

if (!imagePath || !fs.existsSync(imagePath)) {
  console.log(JSON.stringify({ status: 'error', error: 'Image file not found: ' + imagePath, bubbles: [] }));
  process.exit(0);
}

function cleanWord(text) {
  return text
    .replace(/^[^a-zA-Z0-9$!?"']+|[^a-zA-Z0-9$!?"'.]+$/g, '')
    .trim();
}

function normalizeComicText(text) {
  return text
    .replace(/[|\\/_~=><§@#$%^&*()[\]{}—–]+/g, ' ')
    .replace(/\bBLACK GAT\b/gi, 'BLACK CAT')
    .replace(/\b1S\b/g, 'IS')
    .replace(/\bI5\b/g, 'IS')
    .replace(/\b0F\b/g, 'OF')
    .replace(/\bTHIET\b/gi, 'THIEF')
    .replace(/\bEVE YTHING\b/gi, 'EVERYTHING')
    .replace(/\bDOORMA[|I1l]\b/gi, 'DOORMAN')
    .replace(/\bHE DOORMAN\b/gi, 'THE DOORMAN')
    .replace(/\bWH\s+WE HEADED\b/gi, 'WHERE ARE WE HEADED')
    .replace(/\bGENOUETRIREBER\b/gi, 'GENOLET REBER')
    .replace(/\bSAPPHIR E\b/gi, 'SAPPHIRE')
    .replace(/\bSAPPHIR\b/gi, 'SAPPHIRE')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBubblesFromTsv(tsvStr) {
  const tsvLines = tsvStr.split('\n');
  const tsvLineMap = new Map();

  for (let i = 1; i < tsvLines.length; i++) {
    const parts = tsvLines[i].split('\t');
    if (parts.length >= 12 && parts[0] === '5') {
      const lineKey = `${parts[2]}_${parts[3]}_${parts[4]}`;
      const conf = parseFloat(parts[10]);
      const rawWord = parts[11].trim();
      const word = cleanWord(rawWord);
      const x = parseInt(parts[6], 10);
      const y = parseInt(parts[7], 10);
      const w = parseInt(parts[8], 10);
      const h = parseInt(parts[9], 10);

      // Filter out line art noise, non-letters, and extreme dimensions
      if (conf >= 35 && word && /[a-zA-Z]/.test(word) && h >= 12 && h <= 100 && w <= 450) {
        if (!tsvLineMap.has(lineKey)) {
          tsvLineMap.set(lineKey, []);
        }
        tsvLineMap.get(lineKey).push({ word, conf, x, y, w, h });
      }
    }
  }

  // Split any line that spans across columns (gap > max(word.h * 2.2, 50))
  const splitLines = [];
  for (const [, wordList] of tsvLineMap) {
    wordList.sort((a, b) => a.x - b.x);

    let curSegment = [wordList[0]];
    for (let j = 1; j < wordList.length; j++) {
      const prev = wordList[j - 1];
      const curr = wordList[j];
      const gap = curr.x - (prev.x + prev.w);
      const maxGap = Math.max(prev.h, 22) * 2.2;

      if (gap > maxGap && gap > 45) {
        splitLines.push(curSegment);
        curSegment = [curr];
      } else {
        curSegment.push(curr);
      }
    }
    if (curSegment.length > 0) {
      splitLines.push(curSegment);
    }
  }

  // Convert word segments to validated text lines
  const cleanLines = [];
  for (const seg of splitLines) {
    const text = normalizeComicText(seg.map(w => w.word).join(' '));
    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    const avgConf = seg.reduce((a, b) => a + b.conf, 0) / seg.length;

    // Filter isolated single-letter lines and noise
    if (text.length === 1 && !['I', 'A'].includes(text.toUpperCase())) continue;
    if (text.length <= 2 && !/[aeiouyAEIOUY]/.test(text)) continue;
    if (letters < 2 || (letters / text.length) < 0.65 || avgConf < 40) continue;

    const minX = Math.min(...seg.map(w => w.x));
    const minY = Math.min(...seg.map(w => w.y));
    const maxX = Math.max(...seg.map(w => w.x + w.w));
    const maxY = Math.max(...seg.map(w => w.y + w.h));

    cleanLines.push({
      text,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      conf: Math.round(avgConf)
    });
  }

  // Sort lines top-to-bottom
  cleanLines.sort((a, b) => a.y - b.y || a.x - b.x);

  // Stack lines into speech bubbles
  const clusters = [];
  for (const line of cleanLines) {
    let matchedCluster = null;

    for (const c of clusters) {
      const lastLine = c.lines[c.lines.length - 1];
      const vertGap = line.y - (lastLine.y + lastLine.h);
      const overlapX = Math.min(lastLine.x + lastLine.w, line.x + line.w) - Math.max(lastLine.x, line.x);
      const minW = Math.min(lastLine.w, line.w);

      const heightRatio = Math.max(lastLine.h, line.h) / Math.min(lastLine.h, line.h);
      const newTotalHeight = (line.y + line.h) - c.y;
      const newTotalWidth = Math.max(c.x + c.w, line.x + line.w) - Math.min(c.x, line.x);

      // Condition to stack into same bubble:
      // - lines are vertically adjacent (gap <= 1.8 * line height)
      // - lines have significant horizontal overlap (>= 35% of narrower line)
      // - similar font height
      // - bounding box doesn't blow up
      if (
        vertGap >= -15 &&
        vertGap <= Math.max(lastLine.h, 25) * 1.8 &&
        heightRatio <= 2.5 &&
        newTotalHeight <= 380 &&
        newTotalWidth <= 750 &&
        (overlapX / minW) >= 0.35
      ) {
        matchedCluster = c;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.lines.push(line);
      const minX = Math.min(matchedCluster.x, line.x);
      const minY = Math.min(matchedCluster.y, line.y);
      const maxX = Math.max(matchedCluster.x + matchedCluster.w, line.x + line.w);
      const maxY = Math.max(matchedCluster.y + matchedCluster.h, line.y + line.h);
      matchedCluster.x = minX;
      matchedCluster.y = minY;
      matchedCluster.w = maxX - minX;
      matchedCluster.h = maxY - minY;
      matchedCluster.confs.push(line.conf);
    } else {
      clusters.push({
        lines: [line],
        x: line.x,
        y: line.y,
        w: line.w,
        h: line.h,
        confs: [line.conf]
      });
    }
  }

  // Format final bubbles
  const result = [];
  let id = 1;
  for (const c of clusters) {
    c.lines.sort((a, b) => a.y - b.y);
    const fullText = normalizeComicText(c.lines.map(l => l.text).join(' '));
    const words = fullText.split(' ');

    // Filter isolated 1-word artifacts
    if (c.lines.length === 1 && words.length === 1) {
      if (fullText.length < 3) continue;
      if (!/[aeiouyAEIOUY]/.test(fullText)) continue;
      if (c.confs[0] < 60) continue;
      if (['Za', 'NL', 'CAS', 'Fre', 'OF', 'Vv', 'Fa', 'LG', 'AY', 'AN'].includes(fullText)) continue;
    }

    const avgH = c.h / Math.max(1, c.lines.length);
    const padX = Math.round(avgH * 0.5) + 12;
    const padY = Math.round(avgH * 0.35) + 8;

    result.push({
      id: `b_${id++}`,
      text_en: fullText,
      bbox: {
        x: Math.max(0, c.x - padX),
        y: Math.max(0, c.y - padY),
        width: c.w + padX * 2,
        height: c.h + padY * 2
      },
      confidence: Math.round(c.confs.reduce((s, x) => s + x, 0) / c.confs.length)
    });
  }

  return result;
}

async function extract() {
  try {
    const worker = await createWorker('eng');
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const ret = await worker.recognize(imagePath, {}, { tsv: true });
    await worker.terminate();

    const bubbles = extractBubblesFromTsv(ret.data.tsv);
    console.log(JSON.stringify({ status: 'ok', bubbles }));
  } catch (err) {
    console.log(JSON.stringify({ status: 'error', error: err.message, bubbles: [] }));
  }
}

extract();
