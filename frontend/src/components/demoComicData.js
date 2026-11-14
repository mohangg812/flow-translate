// Standalone, zero-dependency demo comic data with rich SVG artwork for Cyber Vanguard #1
// Ensures 100% functionality on GitHub Pages, offline mode, and when backend is unreachable.

function createComicPageSvg({
  pageNum,
  title,
  subtitle,
  panels,
  isTranslated = false
}) {
  const width = 900;
  const height = 1300;

  const panelsSvg = panels.map((p, idx) => {
    const [x, y, w, h] = p.rect;
    const border = p.border || '#38bdf8';
    const bgGradId = `panel_grad_${pageNum}_${idx}`;

    const bubblesSvg = p.bubbles.map((b) => {
      const [bx, by, bw, bh] = b.bbox;
      const text = isTranslated ? b.text_ru : b.text_en;
      // Break text into lines if long
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      const maxChars = bw > 500 ? 55 : (bw > 350 ? 32 : 24);

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = Math.max(14, Math.min(18, Math.floor((bh - 20) / Math.max(1, lines.length))));
      const textStartY = by + Math.max(22, Math.floor((bh - lines.length * lineHeight) / 2) + 14);

      return `
        <!-- Speech Bubble -->
        <g class="speech-bubble" id="${b.id}">
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" ry="18" fill="#ffffff" stroke="#0f172a" stroke-width="3" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.35))" />
          <!-- Speech Tail -->
          <polygon points="${bx + Math.floor(bw * 0.2)},${by + bh} ${bx + Math.floor(bw * 0.28)},${by + bh + 14} ${bx + Math.floor(bw * 0.36)},${by + bh}" fill="#ffffff" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
          <line x1="${bx + Math.floor(bw * 0.21)}" y1="${by + bh - 1}" x2="${bx + Math.floor(bw * 0.35)}" y2="${by + bh - 1}" stroke="#ffffff" stroke-width="5" />
          
          <!-- Language Badge -->
          <rect x="${bx + bw - 32}" y="${by + 6}" width="24" height="14" rx="4" fill="${isTranslated ? '#10b981' : '#3b82f6'}" />
          <text x="${bx + bw - 20}" y="${by + 17}" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">${isTranslated ? 'RU' : 'EN'}</text>

          <!-- Bubble Text -->
          <text font-family="'Impact', 'Arial Black', system-ui, sans-serif" font-size="${Math.max(11, Math.min(14, lineHeight - 2))}" font-weight="700" fill="#0f172a" text-anchor="middle">
            ${lines.map((l, lIdx) => `<tspan x="${bx + Math.floor(bw / 2)}" y="${textStartY + lIdx * lineHeight}">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`).join('')}
          </text>
        </g>
      `;
    }).join('\n');

    return `
      <!-- Panel ${idx + 1} -->
      <defs>
        <linearGradient id="${bgGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${p.fillStart || '#1e293b'}" />
          <stop offset="100%" stop-color="${p.fillEnd || '#0f172a'}" />
        </linearGradient>
      </defs>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" ry="14" fill="url(#${bgGradId})" stroke="${border}" stroke-width="3.5" filter="drop-shadow(0 8px 16px rgba(0,0,0,0.5))" />
      
      <!-- Panel Decorative Elements -->
      ${p.artOverlay || ''}

      <!-- Panel Caption if any -->
      ${p.caption ? `
        <rect x="${x + 12}" y="${y + 12}" width="${p.caption.length * 8 + 24}" height="22" rx="4" fill="#020617" stroke="${border}" stroke-width="1.5" />
        <text x="${x + 24}" y="${y + 27}" font-family="system-ui, sans-serif" font-size="10" font-weight="900" letter-spacing="1.5" fill="#f8fafc">${p.caption}</text>
      ` : ''}

      ${bubblesSvg}
    `;
  }).join('\n');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="space_bg" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="40%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <pattern id="star_grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="0.8" fill="#ffffff" opacity="0.4" />
      <circle cx="45" cy="35" r="1.2" fill="#38bdf8" opacity="0.6" />
      <circle cx="30" cy="50" r="0.6" fill="#ffffff" opacity="0.3" />
    </pattern>
  </defs>

  <!-- Background Canvas -->
  <rect width="${width}" height="${height}" fill="url(#space_bg)" />
  <rect width="${width}" height="${height}" fill="url(#star_grid)" />

  <!-- Outer Comic Book Page Border -->
  <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="20" ry="20" fill="none" stroke="#334155" stroke-width="2" />

  <!-- Comic Header Bar -->
  <g id="comic_header">
    <rect x="40" y="22" width="260" height="14" rx="4" fill="#0f172a" opacity="0.8" />
    <text x="45" y="33" font-family="system-ui, sans-serif" font-size="9" font-weight="900" letter-spacing="1" fill="#94a3b8">CYBER VANGUARD &bull; ISSUE #1</text>
    <text x="860" y="33" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="#94a3b8" text-anchor="end">PAGE ${pageNum} OF 3</text>
  </g>

  <!-- Panels -->
  ${panelsSvg}

  <!-- Page Footer -->
  <text x="450" y="1285" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#64748b" text-anchor="middle">
    ${title} &bull; Flow Translate Neural Comic Reader
  </text>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// -------------------------------------------------------------
// PAGES DEFINITIONS WITH PANELS & SPEECH BUBBLES
// -------------------------------------------------------------

const PAGE_1_PANELS = [
  {
    rect: [40, 45, 820, 370],
    fillStart: '#1e293b',
    fillEnd: '#090d16',
    border: '#38bdf8',
    caption: 'SECTOR 7 — DEEP SPACE',
    artOverlay: `
      <!-- Starship Bridge Hologram & Viewport -->
      <polygon points="120,400 240,240 660,240 780,400" fill="#0369a1" opacity="0.15" />
      <line x1="240" y1="240" x2="660" y2="240" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" />
      <circle cx="450" cy="180" r="45" fill="#f43f5e" opacity="0.25" />
      <circle cx="450" cy="180" r="15" fill="#fb7185" />
      <polygon points="450,140 435,210 465,210" fill="#38bdf8" opacity="0.8" />
    `,
    bubbles: [
      {
        id: 'b1_1',
        bbox: [100, 90, 420, 95],
        text_en: 'Commander, long-range sensors detect an unidentified alien vessel!',
        text_ru: 'Командир, дальние сенсоры зафиксировали неопознанный корабль пришельцев!'
      }
    ]
  },
  {
    rect: [40, 435, 395, 410],
    fillStart: '#4c0519',
    fillEnd: '#1e1b4b',
    border: '#f43f5e',
    artOverlay: `
      <!-- Pulse Cannon Warning HUD -->
      <circle cx="237" cy="640" r="90" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="8,6" opacity="0.7" />
      <circle cx="237" cy="640" r="40" fill="none" stroke="#fb7185" stroke-width="1.5" />
      <line x1="237" y1="530" x2="237" y2="750" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4" />
      <line x1="127" y1="640" x2="347" y2="640" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4" />
      <text x="237" y="770" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#fb7185" text-anchor="middle" letter-spacing="2">WEAPONS LOCK DETECTED</text>
    `,
    bubbles: [
      {
        id: 'b1_2',
        bbox: [70, 480, 340, 90],
        text_en: 'They are powering up their pulse cannons! Stand by for impact!',
        text_ru: 'Они заряжают импульсные пушки! Приготовиться к столкновению!'
      }
    ]
  },
  {
    rect: [465, 435, 395, 410],
    fillStart: '#064e3b',
    fillEnd: '#022c22',
    border: '#10b981',
    artOverlay: `
      <!-- Energy Shields Arcs -->
      <path d="M 500,750 Q 662,560 825,750" fill="none" stroke="#34d399" stroke-width="3" filter="drop-shadow(0 0 8px #10b981)" />
      <path d="M 520,770 Q 662,600 805,770" fill="none" stroke="#6ee7b7" stroke-width="1.5" stroke-dasharray="6,4" />
      <text x="662" y="795" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#34d399" text-anchor="middle" letter-spacing="2">SHIELDS ONLINE: 100%</text>
    `,
    bubbles: [
      {
        id: 'b1_3',
        bbox: [500, 480, 330, 90],
        text_en: 'Shields at maximum power! Prepare to intercept!',
        text_ru: 'Щиты на максимуме! Приготовиться к перехвату!'
      }
    ]
  },
  {
    rect: [40, 865, 820, 395],
    fillStart: '#2e1065',
    fillEnd: '#0f172a',
    border: '#f59e0b',
    artOverlay: `
      <!-- Hyperspace Contact Rift -->
      <ellipse cx="450" cy="1070" rx="360" ry="80" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="12,8" opacity="0.8" />
      <ellipse cx="450" cy="1070" rx="200" ry="40" fill="#f59e0b" opacity="0.2" />
      <polygon points="350,1070 450,1010 550,1070 450,1130" fill="#fef08a" opacity="0.6" />
    `,
    bubbles: [
      {
        id: 'b1_4',
        bbox: [130, 920, 620, 85],
        text_en: 'Energy barrier holding steady. They are initiating contact!',
        text_ru: 'Энергетический барьер стабилен. Они выходят на связь!'
      }
    ]
  }
];

const PAGE_2_PANELS = [
  {
    rect: [40, 45, 820, 540],
    fillStart: '#1e1b4b',
    fillEnd: '#0f172a',
    border: '#a855f7',
    caption: 'BRIDGE OF THE STARSHIP AURORA',
    artOverlay: `
      <!-- Hologram matrix projection -->
      <circle cx="450" cy="320" r="110" fill="none" stroke="#c084fc" stroke-width="2" stroke-dasharray="6,4" opacity="0.6" />
      <line x1="340" y1="320" x2="560" y2="320" stroke="#a855f7" stroke-width="1.5" />
      <polygon points="450,230 520,360 380,360" fill="none" stroke="#e879f9" stroke-width="2" />
      <text x="450" y="390" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#d8b4fe" text-anchor="middle" letter-spacing="2">QUANTUM FREQUENCY: 894.2 THz</text>
    `,
    bubbles: [
      {
        id: 'b2_1',
        bbox: [120, 100, 560, 90],
        text_en: 'Incoming transmission on an encrypted quantum frequency!',
        text_ru: 'Входящая передача на зашифрованной квантовой частоте!'
      },
      {
        id: 'b2_2',
        bbox: [200, 420, 540, 85],
        text_en: 'Can the neural translator decode their linguistic matrix?',
        text_ru: 'Сможет ли нейросетевой переводчик расшифровать их матрицу языка?'
      }
    ]
  },
  {
    rect: [40, 605, 820, 655],
    fillStart: '#083344',
    fillEnd: '#021827',
    border: '#06b6d4',
    caption: 'NEURAL DECODER SYNCHRONIZED',
    artOverlay: `
      <!-- Alien Delegate Hologram -->
      <circle cx="450" cy="940" r="140" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.4" />
      <ellipse cx="450" cy="910" rx="45" ry="60" fill="#0891b2" opacity="0.4" />
      <circle cx="430" cy="895" r="7" fill="#67e8f9" />
      <circle cx="470" cy="895" r="7" fill="#67e8f9" />
      <path d="M 400,1030 Q 450,960 500,1030" fill="none" stroke="#22d3ee" stroke-width="3" />
      <text x="450" y="1120" font-family="system-ui, sans-serif" font-size="12" font-weight="900" fill="#67e8f9" text-anchor="middle" letter-spacing="3">DECRYPTION SUCCESSFUL &bull; 99.8% FIDELITY</text>
    `,
    bubbles: [
      {
        id: 'b2_3',
        bbox: [110, 670, 680, 95],
        text_en: "Translation complete: 'Greetings from the Andromeda galaxy! We seek peaceful cooperation.'",
        text_ru: 'Перевод завершен: «Приветствуем из галактики Андромеда! Мы ищем мирного сотрудничества.»'
      }
    ]
  }
];

const PAGE_3_PANELS = [
  {
    rect: [40, 45, 395, 580],
    fillStart: '#064e3b',
    fillEnd: '#022c22',
    border: '#10b981',
    caption: 'DEFENSE PROTOCOL',
    artOverlay: `
      <!-- Stand down indicator -->
      <rect x="90" y="320" width="295" height="120" rx="12" fill="#022c22" stroke="#34d399" stroke-width="1.5" />
      <circle cx="140" cy="380" r="24" fill="#059669" />
      <text x="140" y="386" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle">✓</text>
      <text x="180" y="372" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#a7f3d0">LASERS OFFLINE</text>
      <text x="180" y="392" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#6ee7b7">DOCKING AUTHORIZED</text>
    `,
    bubbles: [
      {
        id: 'b3_1',
        bbox: [70, 90, 340, 90],
        text_en: 'Lower defense shields. Open a direct communication link!',
        text_ru: 'Опустите защитные щиты. Откройте прямую линию связи!'
      }
    ]
  },
  {
    rect: [465, 45, 395, 580],
    fillStart: '#450a0a',
    fillEnd: '#1c0505',
    border: '#ef4444',
    caption: 'DOCKING RING 4',
    artOverlay: `
      <!-- Clamps lock graphics -->
      <circle cx="662" cy="380" r="70" fill="none" stroke="#f87171" stroke-width="2" stroke-dasharray="8,4" />
      <polygon points="662,330 682,370 642,370" fill="#f87171" />
      <polygon points="662,430 682,390 642,390" fill="#f87171" />
      <text x="662" y="480" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#fca5a5" text-anchor="middle" letter-spacing="2">AIRLOCK ENGAGED</text>
    `,
    bubbles: [
      {
        id: 'b3_2',
        bbox: [500, 90, 330, 90],
        text_en: 'Confirmed! Their emissary is ready to step aboard.',
        text_ru: 'Подтверждено! Их посол готов подняться на борт.'
      }
    ]
  },
  {
    rect: [40, 645, 820, 615],
    fillStart: '#172554',
    fillEnd: '#020617',
    border: '#3b82f6',
    caption: 'DAWN OF THE ALLIANCE',
    artOverlay: `
      <!-- Twin suns rising over planet ring -->
      <circle cx="360" cy="980" r="80" fill="#f59e0b" opacity="0.8" />
      <circle cx="520" cy="950" r="50" fill="#38bdf8" opacity="0.8" />
      <path d="M 50,1080 Q 450,860 850,1080" fill="none" stroke="#e2e8f0" stroke-width="4" opacity="0.7" />
      <path d="M 40,1110 Q 450,890 860,1110" fill="none" stroke="#94a3b8" stroke-width="2" opacity="0.4" />
      <text x="450" y="1170" font-family="system-ui, sans-serif" font-size="13" font-weight="900" fill="#93c5fd" text-anchor="middle" letter-spacing="3">HUMANITY &amp; ANDROMEDA EMBARK TOGETHER</text>
    `,
    bubbles: [
      {
        id: 'b3_3',
        bbox: [120, 710, 660, 95],
        text_en: 'This is the dawn of a new alliance between our worlds. Welcome, travelers of the stars!',
        text_ru: 'Это рассвет нового альянса между нашими мирами. Добро пожаловать, странники звёзд!'
      }
    ]
  }
];

// -------------------------------------------------------------
// BUBBLES PERCENTAGE CONVERTER HELPER
// -------------------------------------------------------------
function extractPageBubbles(panels) {
  const width = 900;
  const height = 1300;
  const bubbles = [];

  panels.forEach(panel => {
    panel.bubbles.forEach(b => {
      const [bx, by, bw, bh] = b.bbox;
      bubbles.push({
        id: b.id,
        text_en: b.text_en,
        text_ru: b.text_ru,
        rel_x: Number(((bx / width) * 100).toFixed(1)),
        rel_y: Number(((by / height) * 100).toFixed(1)),
        rel_w: Number(((bw / width) * 100).toFixed(1)),
        rel_h: Number(((bh / height) * 100).toFixed(1))
      });
    });
  });

  return bubbles;
}

// -------------------------------------------------------------
// EXPORTED FALLBACK DEMO COMIC OBJECT
// -------------------------------------------------------------
export const FALLBACK_DEMO_COMIC = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Cyber Vanguard #1: The Cosmic Anomaly',
  format: 'DEMO',
  current_page: 1,
  total_pages: 3,
  pages: [
    {
      page_num: 1,
      width: 900,
      height: 1300,
      original_image_url: createComicPageSvg({
        pageNum: 1,
        title: 'Episode 1: The Cosmic Anomaly',
        panels: PAGE_1_PANELS,
        isTranslated: false
      }),
      translated_image_url: createComicPageSvg({
        pageNum: 1,
        title: 'Эпизод 1: Космическая Аномалия',
        panels: PAGE_1_PANELS,
        isTranslated: true
      }),
      bubbles: extractPageBubbles(PAGE_1_PANELS)
    },
    {
      page_num: 2,
      width: 900,
      height: 1300,
      original_image_url: createComicPageSvg({
        pageNum: 2,
        title: 'Episode 2: The Encrypted Signal',
        panels: PAGE_2_PANELS,
        isTranslated: false
      }),
      translated_image_url: createComicPageSvg({
        pageNum: 2,
        title: 'Эпизод 2: Зашифрованный Сигнал',
        panels: PAGE_2_PANELS,
        isTranslated: true
      }),
      bubbles: extractPageBubbles(PAGE_2_PANELS)
    },
    {
      page_num: 3,
      width: 900,
      height: 1300,
      original_image_url: createComicPageSvg({
        pageNum: 3,
        title: 'Episode 3: Dawn of the Alliance',
        panels: PAGE_3_PANELS,
        isTranslated: false
      }),
      translated_image_url: createComicPageSvg({
        pageNum: 3,
        title: 'Эпизод 3: Рассвет Нового Альянса',
        panels: PAGE_3_PANELS,
        isTranslated: true
      }),
      bubbles: extractPageBubbles(PAGE_3_PANELS)
    }
  ]
};
