import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Tesseract, { createWorker } from 'tesseract.js';
import api from './api';
import { 
  Volume2, Star, Edit3, Search, LogOut, 
  ArrowRightLeft, X, Shield, RefreshCw, Check, Sun, Moon, Copy,
  Sparkles, Languages, PlusCircle, CheckCircle2,
  Lock, Mail, LayoutGrid, ListFilter, RotateCw, ChevronLeft, ChevronRight,
  Camera, FileText, Globe, Download, UploadCloud,
  FileCheck, ExternalLink, Loader2, ArrowUpRight, Scan, BookOpen, Compass, Bookmark,
  Mic, MicOff, MessageSquare, History, SlidersHorizontal, Trash2, Video,
  Keyboard, Music, Play, Pause, VolumeX, Flame, Zap, Award, Info
} from 'lucide-react';

const SOURCE_LANGUAGES = [
  { code: 'auto', label: 'Автоопределение', flag: '' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const TARGET_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LANGUAGES = TARGET_LANGUAGES;

// Smart client-side language detection tailored for ru, en, de, es
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (clean.length < 2) return null;

  // 1. Cyrillic alphabet -> Russian
  if (/[\u0400-\u04FF]/.test(clean)) {
    return 'ru';
  }

  // 2. Specific German characters (Umlauts & Eszett)
  if (/[äöüßÄÖÜ]/.test(clean)) {
    return 'de';
  }

  // 3. Specific Spanish characters (Accented letters, inverted punctuation, ñ)
  if (/[áéíóúñ¿¡ÁÉÍÓÚÑ]/.test(clean)) {
    return 'es';
  }

  // 4. Tokenize Latin words for statistical match
  const words = clean.toLowerCase().match(/[a-z]{2,}/g) || [];
  if (words.length === 0) return 'en';

  const deWords = new Set([
    'der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich', 'des', 'auf',
    'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden',
    'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind',
    'noch', 'wie', 'einem', 'über', 'einen', 'haben', 'kann', 'oder', 'vor',
    'zur', 'guten', 'tag', 'danke', 'bitte', 'ja', 'nein', 'hallo', 'geht', 'alles'
  ]);

  const esWords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'los', 'se', 'del', 'las', 'un', 'por', 'con',
    'no', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le',
    'ha', 'me', 'si', 'sin', 'sobre', 'este', 'ya', 'entre', 'cuando', 'todo', 'esta',
    'ser', 'son', 'dos', 'también', 'fue', 'había', 'era', 'muy', 'hola', 'gracias',
    'favor', 'buenos', 'días', 'amigo', 'donde'
  ]);

  const enWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for', 'not', 'on',
    'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
    'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
    'make', 'can', 'like', 'time', 'just', 'him', 'know', 'take', 'people', 'into',
    'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
    'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
    'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
    'these', 'give', 'day', 'most', 'us', 'hello', 'please', 'thanks', 'where', 'why'
  ]);

  let scoreDe = 0;
  let scoreEs = 0;
  let scoreEn = 0;

  for (const w of words) {
    if (deWords.has(w)) scoreDe += 2;
    if (esWords.has(w)) scoreEs += 2;
    if (enWords.has(w)) scoreEn += 2;
  }

  if (scoreDe > scoreEn && scoreDe > scoreEs) return 'de';
  if (scoreEs > scoreEn && scoreEs > scoreDe) return 'es';
  return 'en';
}

const URL_PRESETS = [
  { label: 'Wikipedia', domain: 'wikipedia.org', desc: 'Искусственный интеллект', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
  { label: 'TechCrunch', domain: 'techcrunch.com', desc: 'Стартапы и технологии', url: 'https://techcrunch.com' },
  { label: 'BBC News', domain: 'bbc.com', desc: 'Мировые события', url: 'https://www.bbc.com/news' },
  { label: 'The Verge', domain: 'theverge.com', desc: 'Обзоры гаджетов и софта', url: 'https://www.theverge.com' },
];

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const TRANSLATION_CONTEXTS = [
  { id: 'general', label: 'Общий', desc: 'Естественный повседневный перевод' },
  { id: 'idioms', label: 'Идиомы', desc: 'Идиоматические выражения и переносный смысл' },
  { id: 'slang', label: 'Сленг', desc: 'Разговорная речь и американский сленг' },
  { id: 'business', label: 'Бизнес', desc: 'Деловая переписка и профессиональный тон' },
  { id: 'culinary', label: 'Кулинария', desc: 'Еда, ингредиенты и бытовой контекст' },
  { id: 'it', label: 'IT', desc: 'Технологии, разработка и компьютерная лексика' },
];

const AMERICAN_CONTEXT_DATABASE = [
  {
    triggers: ['зеленая зелень', 'зеленая зелени', 'зелёная зелень', 'зеленую зелень', 'зелёную зелень', 'зеленой зелени', 'зелень', 'зеленый', 'зеленое'],
    variants: [
      { phrase: 'Lush greenery', meaning: 'в природе: сочная растительность, богатая листва', category: 'general' },
      { phrase: 'Fresh greens / Herbs', meaning: 'в кулинарии: свежая листовая зелень, петрушка, салат', category: 'culinary' },
      { phrase: 'Green as grass / Inexperienced', meaning: 'переносный смысл: совсем юный или неопытный («молодо-зелено»)', category: 'idioms' },
      { phrase: 'Crisp cash / Bucks', meaning: 'американский сленг: пачка наличных купюр («зелень»)', category: 'slang' }
    ]
  },
  {
    triggers: ['руки не доходят', 'руки не дошли', 'рука не доходит', 'не доходят руки'],
    variants: [
      { phrase: "Haven't gotten around to it yet", meaning: 'разговорное: всё откладываю, не дошли руки', category: 'general' },
      { phrase: 'Been on the back burner', meaning: 'в работе: задача отложена на второй план', category: 'business' },
      { phrase: "Haven't found the time yet", meaning: 'буквально: не было свободной минуты', category: 'idioms' }
    ]
  },
  {
    triggers: ['собаку съел', 'собаку съела', 'собаку съели'],
    variants: [
      { phrase: 'Knows it inside and out', meaning: 'досконально знает все детали вопроса', category: 'general' },
      { phrase: 'An old hand at this / Veteran', meaning: 'опытный мастер, ветеран своего дела', category: 'business' },
      { phrase: 'Knows the ropes', meaning: 'отлично ориентируется во всех нюансах процесса', category: 'idioms' }
    ]
  },
  {
    triggers: ['дело в шляпе'],
    variants: [
      { phrase: "It's in the bag", meaning: 'успех гарантирован, вопрос решен', category: 'idioms' },
      { phrase: 'Done deal', meaning: 'договоренность закрыта, все согласовано', category: 'business' },
      { phrase: 'Mission accomplished', meaning: 'задача успешно выполнена', category: 'general' }
    ]
  },
  {
    triggers: ['горит дедлайн', 'горят дедлайны', 'дедлайн горит', 'дедлайны горят', 'горит'],
    variants: [
      { phrase: 'Tight deadline / Crunch time', meaning: 'аврал и цейтнот по срокам в проекте', category: 'business' },
      { phrase: 'The clock is ticking', meaning: 'время на исходе, нужно торопиться', category: 'general' },
      { phrase: 'Lit / On fire', meaning: 'сленг: атмосфера или проект просто огонь', category: 'slang' },
      { phrase: 'Burning / In flames', meaning: 'буквальный огонь или пламя костра', category: 'general' }
    ]
  },
  {
    triggers: ['вешать лапшу', 'вешает лапшу', 'лапшу на уши', 'лапша на ушах'],
    variants: [
      { phrase: "Pulling someone's leg", meaning: 'подшучивать, разыгрывать кого-то', category: 'idioms' },
      { phrase: 'Feeding a line / Spouting BS', meaning: 'намеренно врать, вешать лапшу на уши', category: 'slang' },
      { phrase: 'Making stuff up', meaning: 'сочинять небылицы на ходу', category: 'general' }
    ]
  },
  {
    triggers: ['на чиле', 'на расслабоне', 'чилить', 'чилю'],
    variants: [
      { phrase: 'Chilling out / Kicking back', meaning: 'отдыхать, приятно проводить время', category: 'slang' },
      { phrase: 'Just vibing', meaning: 'находиться в спокойном расслабленном настроении', category: 'slang' },
      { phrase: 'Taking it easy', meaning: 'не напрягаться, жить в спокойном ритме', category: 'general' }
    ]
  },
  {
    triggers: ['втирать дичь', 'втирает дичь', 'дичь'],
    variants: [
      { phrase: 'Talking pure nonsense', meaning: 'говорить откровенную ерунду или выдумки', category: 'slang' },
      { phrase: 'Wild / Crazy thing', meaning: 'в значении странная, безумная ситуация', category: 'slang' },
      { phrase: 'Game meat / Poultry', meaning: 'в кулинарии: мясо диких птиц или зверей', category: 'culinary' }
    ]
  },
  {
    triggers: ['забей', 'забить', 'забивай'],
    variants: [
      { phrase: 'Never mind / Forget about it', meaning: 'разговорное: не обращай внимания, забей', category: 'general' },
      { phrase: 'Let it go', meaning: 'житейский совет: отпусти ситуацию, не держи в голове', category: 'idioms' },
      { phrase: 'Score a goal', meaning: 'в спорте: забить мяч или шайбу в ворота', category: 'general' },
      { phrase: 'Hammer in / Drive in', meaning: 'буквально: забить гвоздь или сваю', category: 'general' }
    ]
  },
  {
    triggers: ['крутой', 'круто', 'крутая', 'крутые'],
    variants: [
      { phrase: 'Cool / Badass / Sick', meaning: 'о человеке или вещи: впечатляющий, крутой', category: 'slang' },
      { phrase: 'Steep', meaning: 'о склоне: крутой подъем или крутая лестница', category: 'general' },
      { phrase: 'Tough / Hardcore', meaning: 'о характере или мерах: жесткий, суровый', category: 'general' }
    ]
  },
  {
    triggers: ['огонь'],
    variants: [
      { phrase: 'Lit / Awesome / Fire', meaning: 'сленг: трек, вечеринка или дизайн просто огонь', category: 'slang' },
      { phrase: 'Flame / Blaze', meaning: 'буквальный огонь, пламя', category: 'general' },
      { phrase: 'Gunfire', meaning: 'военное: открыть огонь, стрельба', category: 'general' }
    ]
  },
  {
    triggers: ['тема', 'тему', 'темы'],
    variants: [
      { phrase: 'Topic / Subject', meaning: 'предмет обсуждения или доклада', category: 'general' },
      { phrase: 'Dope thing / Great idea', meaning: 'сленг: вот это годная тема, отличная задумка', category: 'slang' },
      { phrase: 'Theme', meaning: 'музыкальная тема или тема оформления в софте', category: 'it' }
    ]
  },
  {
    triggers: ['нормально', 'нормальный', 'нормальная'],
    variants: [
      { phrase: 'All good / Pretty good', meaning: 'ответ на «как дела?»: нормально, всё в порядке', category: 'general' },
      { phrase: 'Decent / Solid', meaning: 'о качестве: вполне приличный результат', category: 'general' },
      { phrase: 'Properly', meaning: 'сделай нормально: как полагается по стандарту', category: 'business' }
    ]
  },
  {
    triggers: ['деревянный', 'деревянная', 'дерево'],
    variants: [
      { phrase: 'Wooden', meaning: 'сделанный из дерева или древесины', category: 'general' },
      { phrase: 'Stiff / Clumsy', meaning: 'о человеке: скованный, непластичный, неловкий', category: 'idioms' },
      { phrase: 'Ruble slang', meaning: 'ироничное разговорное про валюту', category: 'slang' }
    ]
  },
  {
    triggers: ['ключ', 'ключи'],
    variants: [
      { phrase: 'Key', meaning: 'от дверного замка или криптографический шифр', category: 'general' },
      { phrase: 'Fresh spring / Source', meaning: 'родник, природный водный источник', category: 'general' },
      { phrase: 'Wrench', meaning: 'гаечный ключ (инструмент)', category: 'general' },
      { phrase: 'API Key / Token', meaning: 'в IT: секретный ключ доступа к сервису', category: 'it' }
    ]
  },
  {
    triggers: ['мир'],
    variants: [
      { phrase: 'World / Globe', meaning: 'планета Земля, все человечество', category: 'general' },
      { phrase: 'Peace / Harmony', meaning: 'отсутствие войны, покой и согласие', category: 'general' },
      { phrase: 'Universe', meaning: 'мироздание, вселенная', category: 'general' }
    ]
  },
  {
    triggers: ['свой', 'свои', 'своя'],
    variants: [
      { phrase: 'One of us / Insider', meaning: 'свой человек, близкий круг доверия', category: 'slang' },
      { phrase: 'Own', meaning: 'свой собственный личный предмет', category: 'general' },
      { phrase: 'True to oneself', meaning: 'быть в своей стихии / верным себе', category: 'idioms' }
    ]
  },
  {
    triggers: ['париться', 'не парься', 'парюсь'],
    variants: [
      { phrase: "Don't sweat it / No worries", meaning: 'не переживай, не бери в голову', category: 'slang' },
      { phrase: 'Overthinking', meaning: 'слишком сильно заморачиваться', category: 'general' },
      { phrase: 'Take a steam bath', meaning: 'буквально: париться в бане с веником', category: 'culinary' }
    ]
  },
  {
    triggers: ['бабки', 'кэш', 'лавэ'],
    variants: [
      { phrase: 'Cash / Bucks / Dough', meaning: 'сленг: деньги, наличные купюры', category: 'slang' },
      { phrase: 'Grandmas / Elderly women', meaning: 'пожилые женщины, бабушки', category: 'general' }
    ]
  },
  {
    triggers: ['тянуть', 'тянет'],
    variants: [
      { phrase: 'Pull / Drag', meaning: 'буквально тащить или тянуть предмет', category: 'general' },
      { phrase: 'Stall / Procrastinate', meaning: 'тянуть время, откладывать решение', category: 'business' },
      { phrase: 'Craving / Drawn to', meaning: 'тянет к человеку или к сладкому', category: 'general' }
    ]
  },
  {
    triggers: ['гонять', 'гоняет'],
    variants: [
      { phrase: 'Speed / Drive fast', meaning: 'быстро ездить на автомобиле', category: 'slang' },
      { phrase: 'Play on repeat', meaning: 'гонять любимый трек по кругу', category: 'slang' },
      { phrase: 'Run around', meaning: 'бегать, гонять мяч во дворе', category: 'general' }
    ]
  },
  {
    triggers: ['дойти', 'дошло'],
    variants: [
      { phrase: 'Get it / Finally clicked', meaning: 'дошло! наконец-то понял суть мысли', category: 'slang' },
      { phrase: 'Reach / Arrive on foot', meaning: 'дойти пешком до нужного места', category: 'general' }
    ]
  },
  {
    triggers: ['свет'],
    variants: [
      { phrase: 'Light / Glow', meaning: 'освещение, солнечный луч', category: 'general' },
      { phrase: 'Power / Electricity', meaning: 'электричество (в доме отключили свет)', category: 'general' },
      { phrase: 'High society', meaning: 'высший свет, аристократическое общество', category: 'idioms' }
    ]
  },
  {
    triggers: ['вода'],
    variants: [
      { phrase: 'Water', meaning: 'питьевая или природная вода', category: 'general' },
      { phrase: 'Fluff / Filler', meaning: 'пустые слова без конкретики в докладе', category: 'business' }
    ]
  },
  {
    triggers: ['масло масляное'],
    variants: [
      { phrase: 'Completely redundant', meaning: 'избыточный смысловой плеоназм', category: 'idioms' },
      { phrase: 'Stating the obvious', meaning: 'констатация очевидного факта', category: 'general' }
    ]
  },
  {
    triggers: ['лук'],
    variants: [
      { phrase: 'Onion', meaning: 'в кулинарии: репчатый или зеленый лук', category: 'culinary' },
      { phrase: 'Bow', meaning: 'оружие для стрельбы стрелами', category: 'general' },
      { phrase: 'Outfit / Look', meaning: 'стильный внешний образ (модный лук)', category: 'slang' }
    ]
  },
  {
    triggers: ['коса'],
    variants: [
      { phrase: 'Braid', meaning: 'заплетенная коса из волос', category: 'general' },
      { phrase: 'Scythe', meaning: 'сельскохозяйственный инструмент косаря', category: 'general' },
      { phrase: 'Sand spit', meaning: 'географическая песчаная коса на море', category: 'general' }
    ]
  },
  {
    triggers: ['банка'],
    variants: [
      { phrase: 'Jar / Can', meaning: 'стеклянная банка или жестяные консервы', category: 'culinary' },
      { phrase: 'Biceps', meaning: 'сленг в спортзале: накачанные банки', category: 'slang' }
    ]
  },
  {
    triggers: ['стучать'],
    variants: [
      { phrase: 'Knock', meaning: 'буквально стучать рукой в дверь', category: 'general' },
      { phrase: 'Snitch / Rat out', meaning: 'доносить, стучать начальству или органам', category: 'slang' }
    ]
  },
  {
    triggers: ['базар', 'фильтруй базар'],
    variants: [
      { phrase: 'Market / Bazaar', meaning: 'продуктовый или вещевой рынок', category: 'general' },
      { phrase: 'Watch your mouth', meaning: 'фильтруй базар, следи за выражениями', category: 'slang' }
    ]
  },
  {
    triggers: ['да нет наверное', 'да нет', 'probably not'],
    variants: [
      { phrase: 'Probably not / Most likely no', meaning: 'вежливое сомнение с преобладающим отказом', category: 'general' },
      { phrase: 'Doubtful', meaning: 'маловероятно, вряд ли', category: 'general' },
      { phrase: "I wouldn't bet on it", meaning: 'разговорное: я бы на это не рассчитывал', category: 'slang' }
    ]
  },
  {
    triggers: ['ни пуха ни пера', 'ни пуха', 'break a leg'],
    variants: [
      { phrase: 'Break a leg', meaning: 'традиционное пожелание удачи перед выступлением или экзаменом', category: 'idioms' },
      { phrase: 'Best of luck / Knock em dead', meaning: 'удачи, порви всех!', category: 'slang' },
      { phrase: 'Good luck', meaning: 'нейтральное пожелание удачи', category: 'general' }
    ]
  },
  {
    triggers: ['руки чешутся', 'рука чешется', 'itching to'],
    variants: [
      { phrase: 'Itching to do something', meaning: 'не терпится поскорее приступить', category: 'idioms' },
      { phrase: 'Dying to try', meaning: 'очень сильно хочется попробовать', category: 'slang' },
      { phrase: 'Eager / Can hardly wait', meaning: 'в предвкушении интересного дела', category: 'general' }
    ]
  },
  {
    triggers: ['не в своей тарелке', 'out of element'],
    variants: [
      { phrase: 'Like a fish out of water', meaning: 'чувствовать себя неловко и чужим в незнакомой обстановке', category: 'idioms' },
      { phrase: 'Out of my element', meaning: 'не в своей стихии, вне зоны комфорта', category: 'general' },
      { phrase: 'Uncomfortable / Awkward', meaning: 'неуютно, скованно', category: 'general' }
    ]
  },
  {
    triggers: ['глаз алмаз', 'sharp eye'],
    variants: [
      { phrase: 'Eagle eye / Sharp eye', meaning: 'очень внимательный, замечает малейшие детали', category: 'idioms' },
      { phrase: 'Spot on / Dead on', meaning: 'точно в цель, идеальное попадание', category: 'slang' },
      { phrase: 'Keen observation', meaning: 'проницательность, зоркость', category: 'business' }
    ]
  },
  {
    triggers: ['время летит', 'время бежит', 'time flies'],
    variants: [
      { phrase: 'Time flies', meaning: 'время пролетает незаметно', category: 'idioms' },
      { phrase: 'Running out of time', meaning: 'время стремительно тает', category: 'general' },
      { phrase: 'Before you know it', meaning: 'не успеешь оглянуться, как пройдёт время', category: 'general' }
    ]
  },
  {
    triggers: ['каша в голове', 'brain fog'],
    variants: [
      { phrase: 'All mixed up / Brain fog', meaning: 'путаница в мыслях, сложно сосредоточиться', category: 'slang' },
      { phrase: 'Muddled thoughts', meaning: 'хаос и неразбериха в рассуждениях', category: 'general' },
      { phrase: 'Disorganized', meaning: 'отсутствие четкой структуры', category: 'business' }
    ]
  },
  {
    triggers: ['выносить мозг', 'выносит мозг', 'driving me crazy'],
    variants: [
      { phrase: 'Driving me nuts / Crazy', meaning: 'доводить до белого каления, раздражать', category: 'slang' },
      { phrase: 'Doing my head in', meaning: 'утомлять нескончаемыми разговорами', category: 'idioms' },
      { phrase: 'Getting on my nerves', meaning: 'действовать на нервы', category: 'general' }
    ]
  },
  {
    triggers: ['без понятия', 'понятия не имею', 'no clue'],
    variants: [
      { phrase: 'No clue / Beats me', meaning: 'разговорное: абсолютно без понятия', category: 'slang' },
      { phrase: "Haven't the foggiest", meaning: 'идиома: не имею ни малейшего представления', category: 'idioms' },
      { phrase: "I have no idea", meaning: 'нейтральное: не знаю', category: 'general' }
    ]
  },
  {
    triggers: ['по рукам', 'договорились', 'deal'],
    variants: [
      { phrase: "It's a deal / Shake on it", meaning: 'по рукам, договоренность достигнута', category: 'idioms' },
      { phrase: 'Done deal', meaning: 'деловой консенсус, вопрос закрыт', category: 'business' },
      { phrase: 'You got it', meaning: 'разговорное согласие', category: 'slang' }
    ]
  },
  {
    triggers: ['в шоколаде', 'living large'],
    variants: [
      { phrase: 'Sitting pretty / Living large', meaning: 'в полном шоколаде, в достатке и благополучии', category: 'slang' },
      { phrase: 'Having it made', meaning: 'всё сложилось самым лучшим образом', category: 'idioms' },
      { phrase: 'Living the good life', meaning: 'комфортная обеспеченная жизнь', category: 'general' }
    ]
  },
  {
    triggers: ['как снег на голову', 'как гром среди ясного неба', 'out of the blue'],
    variants: [
      { phrase: 'Out of the blue', meaning: 'совершенно неожиданно, как снег на голову', category: 'idioms' },
      { phrase: 'Bolt from the blue', meaning: 'внезапная неожиданная новость', category: 'idioms' },
      { phrase: 'Unexpectedly / Sudden', meaning: 'врасплох, внезапно', category: 'general' }
    ]
  }
];

function findAmericanContextVariants(text, contextFilter = 'general', apiAlternatives = []) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.toLowerCase().trim();
  if (clean.length < 2) return [];

  let matched = [];

  // 1. Поиск по прямым триггерам
  for (const entry of AMERICAN_CONTEXT_DATABASE) {
    if (entry.triggers.some(t => clean.includes(t) || t.includes(clean))) {
      matched = entry.variants;
      break;
    }
  }

  // 2. Поиск по отдельным словам
  if (matched.length === 0) {
    const words = clean.split(/\s+/).map(w => w.replace(/[^а-яa-z0-9]/gi, '')).filter(w => w.length >= 3);
    for (const w of words) {
      for (const entry of AMERICAN_CONTEXT_DATABASE) {
        if (entry.triggers.some(t => t.includes(w) || w.includes(t))) {
          matched = entry.variants;
          break;
        }
      }
      if (matched.length > 0) break;
    }
  }

  // 3. Детектор однокоренных тавтологий (например: белая белизна, темная темнота)
  if (matched.length === 0) {
    const rawWords = clean.split(/\s+/).filter(w => w.length >= 4);
    for (let i = 0; i < rawWords.length - 1; i++) {
      const w1 = rawWords[i].replace(/[^а-яa-z]/gi, '');
      const w2 = rawWords[i + 1].replace(/[^а-яa-z]/gi, '');
      if (w1.length >= 4 && w2.length >= 4 && w1.slice(0, 4) === w2.slice(0, 4) && w1 !== w2) {
        matched = [
          { phrase: `Intensely ${w1}`, meaning: 'литературное усилительное значение', category: 'general' },
          { phrase: `Ultra-${w1}`, meaning: 'разговорный американский вариант', category: 'slang' },
          { phrase: `Pure ${w1}`, meaning: 'в значении абсолютного качества', category: 'idioms' }
        ];
        break;
      }
    }
  }

  // 4. Если нет в базе, но есть варианты от API перевода
  if (matched.length === 0 && apiAlternatives && apiAlternatives.length > 0) {
    matched = apiAlternatives.slice(0, 3).map((alt, i) => ({
      phrase: alt,
      meaning: i === 0 ? 'альтернативный естественный вариант' : (i === 1 ? 'в разговорной речи' : 'в формальном стиле'),
      category: 'general'
    }));
  }

  if (matched.length === 0) return [];

  if (contextFilter && contextFilter !== 'general') {
    const categoryMatches = matched.filter(v => v.category === contextFilter);
    if (categoryMatches.length > 0) {
      const otherMatches = matched.filter(v => v.category !== contextFilter);
      return [...categoryMatches, ...otherMatches].slice(0, 4);
    }
  }

  return matched.slice(0, 4);
}

function analyzeHipHopLyrics(text) {
  if (!text || text.trim().length < 8) return null;
  const clean = text.toLowerCase();

  const ruRapMarkers = [
    'бит', 'биты', 'флоу', 'йоу', 'йо', 'гэнг', 'гэнгста', 'рэп', 'рэпер', 'рифм', 'баттл',
    'хайп', 'гетто', 'улиц', 'микрофон', 'микро', 'чипинкос', 'респект', 'блок', 'ствол',
    'райм', 'панч', 'панчлайн', 'дисс', 'бас', 'сабвуфер', 'чилить', 'флекс', 'флексить',
    'кэш', 'лавэ', 'бабки', 'мусора', 'район', 'пацан', 'братух', 'братва', 'дым', 'косяк',
    'трап', 'бумбэп', 'дрил', 'майк', 'грязь', 'барыг', 'шутер', 'раунд', 'текст', 'строк',
    'врубай', 'кач', 'качает', 'бассы', 'слышишь', 'стелю', 'стелет', 'читка'
  ];

  const enRapMarkers = [
    'yo', 'flow', 'beat', 'rhyme', 'rhymes', 'bars', 'verse', 'hook', 'spit', 'mic',
    'hood', 'hustle', 'cash', 'flex', 'gang', 'gangsta', 'homie', 'trap', 'boom bap',
    'drill', 'diss', 'cypher', 'swag', 'ice', 'drip', 'chain', 'hustling', 'streets',
    'banger', 'spitting', 'skrrt', 'brr', 'yeah', 'skrt', 'clout', 'drop the beat'
  ];

  const adlibPatterns = /\b(йоу|йо|эй|у|ай|е|скр+|skrrt|brr+|yeah|uh|ay|aye|whoa|damn)\b/gi;
  const adlibsFound = (clean.match(adlibPatterns) || []).length;

  const matchedRu = ruRapMarkers.filter(m => clean.includes(m));
  const matchedEn = enRapMarkers.filter(m => clean.includes(m));
  const matchedAll = [...new Set([...matchedRu, ...matchedEn])];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const words = clean.split(/\s+/).filter(Boolean);
  const avgWordsPerLine = lines.length > 0 ? (words.length / lines.length) : 0;
  const isRapStructure = lines.length >= 2 && avgWordsPerLine >= 3 && avgWordsPerLine <= 14;

  let rhymePairs = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const end1 = lines[i].replace(/[^\p{L}]/gu, '').slice(-3);
    const end2 = lines[i+1].replace(/[^\p{L}]/gu, '').slice(-3);
    if (end1 && end2 && end1.length >= 2 && end1 === end2) {
      rhymePairs++;
    }
  }

  let score = 0;
  score += Math.min(matchedAll.length * 18, 65);
  score += Math.min(adlibsFound * 8, 20);
  if (isRapStructure) score += 15;
  if (rhymePairs > 0) score += Math.min(rhymePairs * 10, 20);

  const confidence = Math.min(Math.max(score, 8), 98);
  const isHipHop = confidence >= 40 || matchedAll.length >= 2;

  return {
    isHipHop,
    genreTitle: isHipHop ? 'Стиль: Хип-хоп / Рэп' : 'Стиль: Другой жанр (эстрада / лирика)',
    genreDescription: isHipHop 
      ? 'В тексте присутствует характерный рэп-речитатив: уличная лексика, рифмованные строки и флоу под бит.' 
      : 'Мелодичная песенная лирика без рэп-речитатива и уличного сленга.',
    markers: matchedAll.slice(0, 8)
  };
}

const BASE_URL = import.meta.env.BASE_URL || '/';
const getAssetUrl = (file) => `${BASE_URL.replace(/\/$/, '')}/${file.replace(/^\//, '')}`;

const RAP_AUDIO_TRACKS = [
  {
    id: 'chipinkos',
    title: 'Чипинкос — Зачем тебе рэп',
    badge: 'Оригинальный рэп',
    src: getAssetUrl('chipinkos.mp3')
  },
  {
    id: 'moan',
    title: 'Громкие мужские стоны',
    badge: '18+ / Громко',
    src: getAssetUrl('moan.mp3')
  },
  {
    id: 'gachi',
    title: 'Гачимучи / Gym Grunt',
    badge: 'Billy Herrington',
    src: getAssetUrl('gachi.mp3')
  }
];

const MOAN_PRESET_LYRICS = `Аааах, уууух, давай ещё сильнее!
Оооох, глубже, жми до отказа!
Ааааай, горячо, не останавливайся,
Уууух, чисто на пределе сил!`;

const CHIPINKOS_PRESET_LYRICS = `Йоу, Чипинкос на микрофоне, рэп с улиц!
Мой флоу качает каждый темный район,
Тут реальный бит, здесь битва за трон.
Мы стелем правду, микрофон горит огнем,
Гэнгста стиль, мы делаем хип-хоп день за днем!`;

const POP_BALLAD_PRESET_LYRICS = `Белые розы, белые розы, беззащитны шипы.
Что с ними сделал снег и морозы, лед витрин голубых.
Люди украсят вами свой праздник лишь на несколько дней
И оставляют умирать на белом холодном окне.`;

// Client-side Robust Translation Helper (Static top-level, never recreated on render)
async function robustTranslateClient(inputText, srcLang, tgtLang, signal) {
  if (!inputText || !inputText.trim()) return '';
  const cleanSrc = srcLang === 'auto' ? (detectLanguage(inputText) || 'en') : srcLang;
  if (cleanSrc === tgtLang) return inputText;

  const splitChunks = (str, maxLen = 450) => {
    if (str.length <= maxLen) return [str];
    const paras = str.split('\n');
    const chunks = [];
    let cur = '';
    for (const p of paras) {
      if (!p.trim()) {
        if (cur) { chunks.push(cur); cur = ''; }
        continue;
      }
      if (cur.length + p.length + 1 <= maxLen) {
        cur = cur ? `${cur}\n${p}` : p;
      } else {
        if (cur) { chunks.push(cur); cur = ''; }
        if (p.length <= maxLen) {
          cur = p;
        } else {
          const sentences = p.split(/(?<=[.!?])\s+/);
          for (const s of sentences) {
            if (cur.length + s.length + 1 <= maxLen) {
              cur = cur ? `${cur} ${s}` : s;
            } else {
              if (cur) { chunks.push(cur); cur = ''; }
              if (s.length <= maxLen) {
                cur = s;
              } else {
                for (let i = 0; i < s.length; i += maxLen) {
                  chunks.push(s.slice(i, i + maxLen));
                }
              }
            }
          }
        }
      }
    }
    if (cur) chunks.push(cur);
    return chunks.length ? chunks : [str];
  };

  const chunks = splitChunks(inputText, 450);
  const translatedChunks = [];

  for (const c of chunks) {
    let chunkTrans = '';
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${cleanSrc}&tl=${tgtLang}&dt=t&q=${encodeURIComponent(c)}`;
      const gRes = await fetch(gUrl, { signal });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData && gData[0]) {
          const parts = [];
          for (const item of gData[0]) {
            if (item && item[0]) {
              let tPart = item[0];
              const sPart = item[1] || '';
              if (sPart.endsWith('\n') && !tPart.endsWith('\n')) {
                tPart += '\n';
              } else if (sPart.endsWith(' ') && !tPart.endsWith(' ')) {
                tPart += ' ';
              }
              parts.push(tPart);
            }
          }
          chunkTrans = parts.join('');
        }
      }
    } catch (_) {}

    if (!chunkTrans) {
      try {
        const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(c.slice(0, 400))}&langpair=${cleanSrc}|${tgtLang}`;
        const mRes = await fetch(mUrl, { signal });
        if (mRes.ok) {
          const mData = await mRes.json();
          const raw = mData?.responseData?.translatedText;
          if (raw && !raw.includes('QUERY LENGTH LIMIT EXCEEDED') && !raw.includes('MYMEMORY WARNING')) {
            const doc = new DOMParser().parseFromString(raw, 'text/html');
            chunkTrans = doc.body.textContent || raw;
          }
        }
      } catch (_) {}
    }

    translatedChunks.push(chunkTrans || c);
  }

  const joiner = inputText.includes('\n') && chunks.length > 1 ? '\n\n' : ' ';
  return translatedChunks.join(joiner).trim();
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('flow_theme') || 'dark');
  const [user, setUser] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Cache key refs to prevent redundant repeat translations & infinite re-render loops
  const lastTranslatedKeyRef = useRef('Simplicity is the ultimate sophistication|en|ru|neutral');
  const lastRapLyricsKeyRef = useRef('');
  
  // Auth state
  const [authModal, setAuthModal] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isCopiedSecret, setIsCopiedSecret] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Translator state
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('ru');
  const [detectedLang, setDetectedLang] = useState('en');
  const [sourceText, setSourceText] = useState('Simplicity is the ultimate sophistication');
  const [translatedText, setTranslatedText] = useState('Простота — это высшая форма утонченности');
  const [alternatives, setAlternatives] = useState([]);
  const [examples, setExamples] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isInDictionary, setIsInDictionary] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Context Domain Selector state ('general' | 'idioms' | 'it' | 'business' | 'culinary' | 'slang')
  const [selectedContext, setSelectedContext] = useState('general');

  // Mode State: 'text' | 'image' | 'doc' | 'url' | 'dialogue' | 'rap'
  const [activeMode, setActiveMode] = useState('text');

  // Rap & Hip-Hop Mode State (Audio tracks & lyrics detector)
  const chipinkosAudioRef = useRef(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState('chipinkos');
  const [isPlayingChipinkos, setIsPlayingChipinkos] = useState(false);
  const [isChipinkosMuted, setIsChipinkosMuted] = useState(false);
  const [rapLyricsText, setRapLyricsText] = useState(CHIPINKOS_PRESET_LYRICS);
  const [rapTranslation, setRapTranslation] = useState('');
  const [isTranslatingRap, setIsTranslatingRap] = useState(false);

  const currentAudioTrack = useMemo(() => {
    return RAP_AUDIO_TRACKS.find(t => t.id === selectedAudioTrack) || RAP_AUDIO_TRACKS[0];
  }, [selectedAudioTrack]);

  const handleSelectAudioTrack = (trackId) => {
    setSelectedAudioTrack(trackId);
    const target = RAP_AUDIO_TRACKS.find(t => t.id === trackId);
    const audio = chipinkosAudioRef.current;
    if (audio && target) {
      audio.pause();
      audio.src = target.src;
      audio.currentTime = 0;
      audio.load();
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => setIsPlayingChipinkos(true))
         .catch((err) => {
           console.log('Play blocked or error:', err);
           setIsPlayingChipinkos(false);
         });
      }
    }
  };

  // American English contextual variants for source text
  const contextVariants = useMemo(() => {
    return findAmericanContextVariants(sourceText, selectedContext, alternatives);
  }, [sourceText, selectedContext, alternatives]);
  const activeContextObj = TRANSLATION_CONTEXTS.find(c => c.id === selectedContext);

  const handleSelectContext = useCallback((ctxId) => {
    setSelectedContext(ctxId);
    const updatedVariants = findAmericanContextVariants(sourceText, ctxId, alternatives);
    if (updatedVariants && updatedVariants.length > 0) {
      if (ctxId !== 'general') {
        const matching = updatedVariants.find(v => v.category === ctxId);
        if (matching) {
          setTranslatedText(matching.phrase);
        }
      } else {
        const generalMatch = updatedVariants.find(v => v.category === 'general') || updatedVariants[0];
        if (generalMatch) {
          setTranslatedText(generalMatch.phrase);
        }
      }
    }
  }, [sourceText, alternatives]);

  // Hip-Hop analysis for rap mode lyrics
  const hipHopAnalysis = useMemo(() => {
    return analyzeHipHopLyrics(rapLyricsText);
  }, [rapLyricsText]);

  // Autoplay Chipinkos track when switching to 'rap' mode, pause when leaving
  useEffect(() => {
    if (activeMode === 'rap') {
      if (chipinkosAudioRef.current) {
        chipinkosAudioRef.current.currentTime = 0;
        const playPromise = chipinkosAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlayingChipinkos(true))
            .catch((err) => {
              console.log('Autoplay blocked until user interaction:', err);
              setIsPlayingChipinkos(false);
            });
        }
      }
    } else {
      if (chipinkosAudioRef.current) {
        chipinkosAudioRef.current.pause();
        setIsPlayingChipinkos(false);
      }
    }
  }, [activeMode]);

  const toggleChipinkosAudio = () => {
    const audio = chipinkosAudioRef.current;
    if (!audio) return;
    if (isPlayingChipinkos) {
      audio.pause();
      setIsPlayingChipinkos(false);
    } else {
      if (!audio.src || !audio.src.includes(currentAudioTrack.src)) {
        audio.src = currentAudioTrack.src;
        audio.load();
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlayingChipinkos(true))
          .catch((err) => {
            console.error('Audio play error:', err);
            setIsPlayingChipinkos(false);
          });
      }
    }
  };

  const toggleChipinkosMute = () => {
    if (!chipinkosAudioRef.current) return;
    chipinkosAudioRef.current.muted = !isChipinkosMuted;
    setIsChipinkosMuted(!isChipinkosMuted);
  };
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [loadedFile, setLoadedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Speech-to-Text (Voice) State
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef(null);

  // Dialogue Mode State (Face-to-Face synchronous conversation)
  const [dialogueMessages, setDialogueMessages] = useState([
    { id: '1', sender: 'peer', text: 'Hello! How can I help you today?', translatedText: 'Здравствуйте! Чем я могу вам помочь сегодня?', lang: 'en', targetLang: 'ru' }
  ]);
  const [isDialogueListeningLeft, setIsDialogueListeningLeft] = useState(false);
  const [isDialogueListeningRight, setIsDialogueListeningRight] = useState(false);
  const [autoSpeakDialogue, setAutoSpeakDialogue] = useState(true);

  // Smart Linguistics State (DeepL & Reverso style)
  const [tone, setTone] = useState('neutral'); // 'neutral' | 'formal' | 'informal'

  // Bottom Tabs: null | 'favorites' | 'history' (opens exclusively on clicking tabs)
  const [activeBottomTab, setActiveBottomTab] = useState(null);
  const [recentHistory, setRecentHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('flow_recent_history')) || [];
    } catch {
      return [];
    }
  });

  // URL modal state
  const [urlModal, setUrlModal] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');

  // Favorites state
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ source_text: '', translated_text: '', source_lang: 'en', target_lang: 'ru', notes: '', category_id: '' });
  const [editingEntry, setEditingEntry] = useState(null);
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#09090B');

  // View Mode & Flashcards
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [flashcardModal, setFlashcardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [shortcutsModal, setShortcutsModal] = useState(false);

  // Admin state
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  const translateAbortRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  const sourceTextareaRef = useRef(null);
  const debouncedSearch = useDebounce(search, 400);

  // Google Lens & Live Camera State
  const [ocrBlocks, setOcrBlocks] = useState([]);
  const [rawOcrData, setRawOcrData] = useState({ lines: [], words: [] });
  const [ocrGranularity, setOcrGranularity] = useState('lines'); // 'lines' | 'words'
  const [ocrLangChoice, setOcrLangChoice] = useState('auto'); // 'auto' | 'rus' | 'eng' | 'rus+eng' | 'deu' | 'spa'
  const [currentOcrFile, setCurrentOcrFile] = useState(null);
  const [fullOcrText, setFullOcrText] = useState('');
  const [imageNaturalDims, setImageNaturalDims] = useState({ width: 0, height: 0 });
  const [lensMode, setLensMode] = useState('boxes'); // 'boxes' | 'overlay' | 'clean'
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedSnippet, setSelectedSnippet] = useState(null);
  const [copiedLensId, setCopiedLensId] = useState(null);
  const [isLensTranslating, setIsLensTranslating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Auto-resize input textarea smoothly without jittery collapsing
  const adjustTextareaHeight = useCallback(() => {
    const el = sourceTextareaRef.current;
    if (!el) return;
    if (!el.value.trim()) {
      el.style.height = '160px';
      return;
    }
    const scrollH = el.scrollHeight;
    if (scrollH > el.clientHeight) {
      el.style.height = `${scrollH}px`;
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(adjustTextareaHeight);
  }, [sourceText, activeMode, adjustTextareaHeight]);

  // Debounced translation for rap lyrics (with strict cache check to prevent re-translation loops)
  useEffect(() => {
    if (activeMode !== 'rap') return;
    const clean = rapLyricsText.trim();
    if (!clean) {
      setRapTranslation('');
      lastRapLyricsKeyRef.current = '';
      return;
    }
    if (clean === lastRapLyricsKeyRef.current) return;
    const timer = setTimeout(async () => {
      lastRapLyricsKeyRef.current = clean;
      setIsTranslatingRap(true);
      try {
        const res = await api.post('/translate', {
          text: clean,
          source_lang: 'auto',
          target_lang: 'en',
          tone: 'informal'
        });
        if (res.data?.translated_text) {
          setRapTranslation(res.data.translated_text);
        }
      } catch (_) {
        try {
          const fallback = await robustTranslateClient(clean, 'ru', 'en');
          if (fallback) setRapTranslation(fallback);
        } catch (e) {}
      } finally {
        setIsTranslatingRap(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [rapLyricsText, activeMode]);

  // High performance GPU-accelerated cursor spotlight (0 React re-renders)
  useEffect(() => {
    let rafId = null;
    const handleMouseMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        rafId = null;
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Camera handlers for live viewfinder
  const startCamera = async () => {
    setIsCameraLoading(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        setIsCameraActive(true);
      } else {
        alert('Камера не поддерживается вашим браузером');
      }
    } catch (err) {
      alert('Ошибка доступа к камере: ' + (err.message || 'Разрешите доступ к веб-камере в браузере'));
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      stopCamera();
      if (blob) {
        processImageFile(blob);
      }
    }, 'image/jpeg', 0.92);
  };

  // High-precision Canvas Preprocessor for OCR
  // 1. Auto-normalizes EXIF rotation
  // 2. Clamps resolution to optimal 1600-1800px (speed & memory)
  // 3. Analyzes background luminance: inverts dark backgrounds so Tesseract gets black text on white
  const preprocessImageForOcr = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let targetW = img.naturalWidth || 800;
        let targetH = img.naturalHeight || 600;
        const MAX_DIM = 1800;
        if (targetW > MAX_DIM || targetH > MAX_DIM) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * MAX_DIM) / targetW);
            targetW = MAX_DIM;
          } else {
            targetW = Math.round((targetW * MAX_DIM) / targetH);
            targetH = MAX_DIM;
          }
        }

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = targetW;
        previewCanvas.height = targetH;
        const pCtx = previewCanvas.getContext('2d');
        pCtx.drawImage(img, 0, 0, targetW, targetH);

        let isDark = false;
        try {
          const imgData = pCtx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;
          let totalLuma = 0;
          const step = Math.max(1, Math.floor(data.length / (4 * 4000)));
          let count = 0;
          for (let i = 0; i < data.length; i += 4 * step) {
            totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            count++;
          }
          const avgLuma = count > 0 ? totalLuma / count : 128;
          if (avgLuma < 110) {
            isDark = true;
          }
        } catch (_) {}

        const ocrCanvas = document.createElement('canvas');
        ocrCanvas.width = targetW;
        ocrCanvas.height = targetH;
        const oCtx = ocrCanvas.getContext('2d');
        oCtx.drawImage(previewCanvas, 0, 0);

        if (isDark) {
          try {
            const ocrImgData = oCtx.getImageData(0, 0, targetW, targetH);
            const d = ocrImgData.data;
            for (let i = 0; i < d.length; i += 4) {
              d[i] = 255 - d[i];
              d[i + 1] = 255 - d[i + 1];
              d[i + 2] = 255 - d[i + 2];
            }
            oCtx.putImageData(ocrImgData, 0, 0);
          } catch (_) {}
        }

        previewCanvas.toBlob((previewBlob) => {
          ocrCanvas.toBlob((ocrBlob) => {
            resolve({
              previewBlob: previewBlob || file,
              ocrBlob: ocrBlob || previewBlob || file,
              dims: { width: targetW, height: targetH },
              isDark
            });
          }, 'image/png');
        }, 'image/jpeg', 0.95);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // OCR Processing Function via Tesseract.js (Google Lens / Apple Live Text)
  const processImageFile = useCallback(async (file, explicitLang) => {
    if (!file) return;
    setIsOcrProcessing(true);
    setOcrProgress(0);
    setOcrStatusText('Подготовка изображения...');
    setActiveMode('image');
    setSelectedBlockId(null);
    setOcrBlocks([]);
    setCurrentOcrFile(file);

    try {
      // 1. High-precision preprocessing (inversion for dark mode, coordinate alignment)
      const { previewBlob, ocrBlob, dims } = await preprocessImageForOcr(file);

      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      const previewUrl = URL.createObjectURL(previewBlob);
      setImagePreviewUrl(previewUrl);
      setImageNaturalDims(dims);

      // 2. Language selection: avoid 4-language collision in auto mode!
      let langToUse = explicitLang || ocrLangChoice;
      if (langToUse === 'auto') {
        const langMap = { en: 'eng', ru: 'rus', de: 'deu', es: 'spa' };
        langToUse = langMap[sourceLang] || 'rus+eng';
      }

      setOcrStatusText('Подготовка сканирования...');
      const worker = await createWorker(langToUse, 1, {
        logger: (m) => {
          if (m.status === 'loading language traineddata') {
            const p = Math.round((m.progress || 0) * 100);
            setOcrProgress(p);
            setOcrStatusText(`Загрузка модели: ${p}%`);
          } else if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 100);
            setOcrProgress(p);
            setOcrStatusText(`Распознавание: ${p}%`);
          }
        }
      });

      // 3. Recognize with blocks enabled!
      const res = await worker.recognize(ocrBlob, {}, { blocks: true });
      await worker.terminate();

      // 4. Extract lines and words with strict noise and confidence filtering
      const extractedLines = [];
      const extractedWords = [];

      res.data.blocks?.forEach((b) => {
        b.paragraphs?.forEach((p) => {
          p.lines?.forEach((line) => {
            const validWords = (line.words || []).filter((w) => {
              const txt = (w.text || '').trim();
              return (w.confidence || 0) >= 35 && /[a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]/.test(txt);
            });

            validWords.forEach((w) => {
              const cleaned = w.text.trim().replace(/^[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]+|[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]+$/g, '');
              if (cleaned) {
                extractedWords.push({
                  id: `word-${extractedWords.length}`,
                  text: cleaned,
                  bbox: w.bbox,
                  confidence: Math.round(w.confidence || 0),
                  translatedText: ''
                });
              }
            });

            // Split line into column chunks if words are horizontally spaced far apart
            if (validWords.length > 0) {
              let currentChunk = [validWords[0]];
              for (let i = 1; i < validWords.length; i++) {
                const prev = validWords[i - 1];
                const curr = validWords[i];
                const gap = curr.bbox.x0 - prev.bbox.x1;
                const wordH = prev.bbox.y1 - prev.bbox.y0;
                if (gap > Math.max(38, wordH * 1.8)) {
                  const blk = buildLineBlock(currentChunk, extractedLines.length);
                  if (blk) extractedLines.push(blk);
                  currentChunk = [curr];
                } else {
                  currentChunk.push(curr);
                }
              }
              if (currentChunk.length > 0) {
                const blk = buildLineBlock(currentChunk, extractedLines.length);
                if (blk) extractedLines.push(blk);
              }
            }
          });
        });
      });

      function buildLineBlock(wordList, index) {
        const text = wordList.map((w) => w.text.trim()).join(' ').replace(/^[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]+|[^a-zA-Z0-9\u0400-\u04FF\u00C0-\u024F]+$/g, '');
        if (!text) return null;
        const x0 = Math.min(...wordList.map((w) => w.bbox.x0));
        const y0 = Math.min(...wordList.map((w) => w.bbox.y0));
        const x1 = Math.max(...wordList.map((w) => w.bbox.x1));
        const y1 = Math.max(...wordList.map((w) => w.bbox.y1));
        const avgConf = Math.round(wordList.reduce((acc, w) => acc + (w.confidence || 0), 0) / wordList.length);
        return {
          id: `line-${index}`,
          text,
          bbox: { x0, y0, x1, y1 },
          confidence: avgConf,
          translatedText: ''
        };
      }

      setRawOcrData({ lines: extractedLines, words: extractedWords });
      const activeBlocks = ocrGranularity === 'words' ? extractedWords : extractedLines;
      setOcrBlocks(activeBlocks);

      const cleanText = extractedLines.map((l) => l.text).filter(Boolean).join('\n');
      setFullOcrText(cleanText);

      if (cleanText) {
        setSourceText(cleanText.slice(0, 2000));
        setLoadedFile({ name: file.name || 'Снимок Google Lens', size: (file.size / 1024).toFixed(1) + ' KB', type: 'image' });
      } else {
        alert('Текст на изображении не обнаружен. Попробуйте выбрать другой язык распознавания или более четкое фото.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Ошибка при распознавании изображения.');
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  }, [sourceLang, imagePreviewUrl, ocrLangChoice, ocrGranularity]);

  const switchGranularity = (gran) => {
    setOcrGranularity(gran);
    setSelectedBlockId(null);
    if (gran === 'words') {
      setOcrBlocks(rawOcrData.words || []);
    } else {
      setOcrBlocks(rawOcrData.lines || []);
    }
  };

  const handleSelectOcrLang = (langKey) => {
    setOcrLangChoice(langKey);
    if (currentOcrFile && !isOcrProcessing) {
      processImageFile(currentOcrFile, langKey);
    }
  };

  const handleCopyLensText = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLensId(id);
    setTimeout(() => setCopiedLensId(null), 1800);
  };

  // Mouse cursor selection on photo: instantly translates highlighted words
  const handleMouseUpSelection = () => {
    const selection = window.getSelection();
    const str = selection ? selection.toString().trim() : '';
    if (str && str.length > 0) {
      const clean = str.replace(/\s+/g, ' ');
      setSourceText(clean);
      setSelectedSnippet(clean);
    }
  };

  const handleWordClick = (wordText) => {
    if (!wordText) return;
    const str = wordText.trim();
    if (str) {
      setSourceText(str);
      setSelectedSnippet(str);
    }
  };

  const handleResetToFullText = () => {
    if (fullOcrText) {
      setSourceText(fullOcrText);
      setSelectedSnippet(null);
    }
  };

  // Google Lens: Translate all detected blocks for AR in-image overlay
  const handleTranslateLensOverlay = useCallback(async () => {
    if (!ocrBlocks || ocrBlocks.length === 0) return;
    setIsLensTranslating(true);
    try {
      const updated = await Promise.all(
        ocrBlocks.map(async (b) => {
          if (b.translatedText) return b;
          try {
            const trans = await robustTranslateClient(b.text, sourceLang === 'auto' ? (detectLanguage(b.text) || 'en') : sourceLang, targetLang);
            return { ...b, translatedText: trans };
          } catch (_) {
            return b;
          }
        })
      );
      setOcrBlocks(updated);
    } finally {
      setIsLensTranslating(false);
    }
  }, [ocrBlocks, sourceLang, targetLang, robustTranslateClient]);

  const switchLensMode = (mode) => {
    setLensMode(mode);
    if (mode === 'overlay') {
      handleTranslateLensOverlay();
    }
  };

  const handleSelectLensBlock = (block) => {
    if (selectedBlockId === block.id) {
      setSelectedBlockId(null);
      setSourceText(fullOcrText.slice(0, 2000));
    } else {
      setSelectedBlockId(block.id);
      setSourceText(block.text);
    }
  };

  // Global Paste listener (Ctrl + V for screenshot OCR)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            processImageFile(blob);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImageFile]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('flow_theme', theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem('flow_token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          if (res.data.theme_preference) setTheme(res.data.theme_preference);
        })
        .catch(() => {
          localStorage.removeItem('flow_token');
          setUser(null);
        });
    }
  }, []);

  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if (user) {
      try { await api.patch('/auth/me/theme', { theme: newTheme }); } catch (_) {}
    }
  };

  const speak = (text, langCode, isTarget = false) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const map = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', es: 'es-ES' };
    utterance.lang = map[langCode] || 'en-US';
    
    if (isTarget) setIsSpeakingTarget(true);
    else setIsSpeakingSource(true);

    utterance.onend = () => {
      setIsSpeakingSource(false);
      setIsSpeakingTarget(false);
    };
    utterance.onerror = () => {
      setIsSpeakingSource(false);
      setIsSpeakingTarget(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speech-to-Text Recognition for Main Input
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Голосовой ввод не поддерживается вашим браузером. Попробуйте Google Chrome, Microsoft Edge или Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;

      const effectiveLang = sourceLang === 'auto' ? (detectedLang || 'ru') : sourceLang;
      const langLocaleMap = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', es: 'es-ES' };
      recognition.lang = langLocaleMap[effectiveLang] || 'ru-RU';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError('');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setSourceText(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setMicError('Не удалось распознать голос');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Dialogue Mode Speech Recognition
  const startDialogueRecognition = (speakerSide) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Голосовой ввод не поддерживается вашим браузером. Попробуйте Google Chrome, Edge или Safari.');
      return;
    }

    if (isDialogueListeningLeft || isDialogueListeningRight) {
      recognitionRef.current?.stop();
      setIsDialogueListeningLeft(false);
      setIsDialogueListeningRight(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;

      const effectiveLeftLang = sourceLang === 'auto' ? (detectedLang || 'ru') : sourceLang;
      const effectiveRightLang = targetLang;
      const langLocaleMap = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', es: 'es-ES' };

      const speakLang = speakerSide === 'left' ? effectiveLeftLang : effectiveRightLang;
      const targetTransLang = speakerSide === 'left' ? effectiveRightLang : effectiveLeftLang;

      recognition.lang = langLocaleMap[speakLang] || 'ru-RU';

      if (speakerSide === 'left') setIsDialogueListeningLeft(true);
      else setIsDialogueListeningRight(true);

      recognition.onresult = async (event) => {
        const spokenText = event.results[0]?.[0]?.transcript?.trim();
        if (!spokenText) return;

        try {
          let transResult = '';
          try {
            const res = await api.post('/translate', {
              text: spokenText,
              source_lang: speakLang,
              target_lang: targetTransLang,
              tone: 'neutral'
            });
            transResult = res.data.translated_text;
          } catch (_) {
            transResult = await robustTranslateClient(spokenText, speakLang, targetTransLang);
          }

          if (transResult) {
            const newMsg = {
              id: Date.now().toString(),
              sender: speakerSide,
              text: spokenText,
              translatedText: transResult,
              lang: speakLang,
              targetLang: targetTransLang,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setDialogueMessages(prev => [...prev, newMsg]);

            if (autoSpeakDialogue) {
              speak(transResult, targetTransLang, true);
            }
          }
        } catch (e) {
          console.error(e);
        }
      };

      recognition.onerror = () => {
        setIsDialogueListeningLeft(false);
        setIsDialogueListeningRight(false);
      };

      recognition.onend = () => {
        setIsDialogueListeningLeft(false);
        setIsDialogueListeningRight(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsDialogueListeningLeft(false);
      setIsDialogueListeningRight(false);
    }
  };

  // Recent Translation History helpers
  const addToHistory = (srcText, trText, sLang, tLang) => {
    if (!srcText || !trText || srcText.trim().length < 2) return;
    setRecentHistory(prev => {
      const filtered = prev.filter(item => item.source_text.toLowerCase().trim() !== srcText.toLowerCase().trim());
      const updated = [{
        id: Date.now().toString(),
        source_text: srcText.trim(),
        translated_text: trText.trim(),
        source_lang: sLang,
        target_lang: tLang,
        timestamp: new Date().toISOString()
      }, ...filtered].slice(0, 30);
      try { localStorage.setItem('flow_recent_history', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  };

  const restoreFromHistory = (item) => {
    setSourceLang(item.source_lang);
    setTargetLang(item.target_lang);
    setSourceText(item.source_text);
    setTranslatedText(item.translated_text);
    const effectiveSource = item.source_lang === 'auto'
      ? (detectLanguage(item.source_text) || 'en')
      : item.source_lang;
    lastTranslatedKeyRef.current = `${item.source_text.trim()}|${effectiveSource}|${item.target_lang}|${tone}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearHistory = () => {
    if (window.confirm('Очистить историю недавних переводов?')) {
      setRecentHistory([]);
      localStorage.removeItem('flow_recent_history');
    }
  };

  const handleClearLoadedContent = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setLoadedFile(null);
    setSourceText('');
  };

  // Document Processing Function (Apple Files / Google Docs)
  const processDocumentFile = async (file) => {
    if (!file) return;
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setActiveMode('doc');
    const ext = file.name.split('.').pop().toLowerCase();

    // Plain text formats
    if (['txt', 'md', 'json', 'csv', 'srt'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setSourceText(text.slice(0, 2000));
        setLoadedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: 'doc', ext: ext.toUpperCase() });
      };
      reader.readAsText(file, 'UTF-8');
    } else if (ext === 'pdf') {
      // Basic text extraction from PDF via binary scan
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target.result;
        const textDecoder = new TextDecoder('iso-8859-1');
        const content = textDecoder.decode(buffer);
        // Extract text between BT and ET blocks
        const matches = content.match(/\((.*?)\)\s*Tj/g) || content.match(/\[(.*?)\]\s*TJ/g);
        if (matches && matches.length > 0) {
          const extracted = matches.map(m => m.replace(/[()[\]]|Tj|TJ/g, '').trim()).join(' ');
          setSourceText(extracted.slice(0, 2000));
        } else {
          // Fallback: search for readable chunks
          const chunks = content.match(/[A-Za-zА-Яа-я0-9\s.,!?-]{20,}/g);
          setSourceText(chunks ? chunks.slice(0, 5).join('\n\n').slice(0, 2000) : 'Не удалось автоматически извлечь текст из PDF.');
        }
        setLoadedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB', type: 'pdf', ext: 'PDF' });
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert(`Формат .${ext} пока не поддерживается. Поддерживаются: .txt, .md, .json, .csv, .srt, .pdf`);
    }
  };

  // Extract text from Web Page URL
  const handleUrlExtract = async (e) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;
    setIsUrlLoading(true);
    setUrlError('');

    try {
      let extractedText = '';
      try {
        const res = await api.post('/translate/extract-url', { url: inputUrl });
        extractedText = res.data.text;
      } catch (backendErr) {
        // Fallback for GitHub Pages (client-side via CORS proxy)
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(inputUrl)}`;
        const fallbackRes = await fetch(proxyUrl);
        const fallbackData = await fallbackRes.json();
        const html = fallbackData.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Remove script, style, nav, footer
        doc.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());
        const paragraphs = Array.from(doc.querySelectorAll('p, h1, h2, h3'))
          .map(p => p.textContent.trim())
          .filter(t => t.length > 25);
        extractedText = paragraphs.slice(0, 10).join('\n\n');
      }

      if (extractedText) {
        setSourceText(extractedText.slice(0, 2000));
        setLoadedFile({ name: inputUrl.replace(/^https?:\/\//, '').split('/')[0], size: 'Web Page', type: 'url' });
        setUrlModal(false);
        setInputUrl('');
        setActiveMode('url');
      } else {
        setUrlError('Не удалось извлечь читаемый текст со страницы.');
      }
    } catch (err) {
      setUrlError('Ошибка загрузки страницы. Проверьте правильность адреса.');
    } finally {
      setIsUrlLoading(false);
    }
  };

  // Download translated file
  const handleDownloadTranslation = () => {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = loadedFile ? loadedFile.name.replace(/\.[^/.]+$/, "") : 'translation';
    a.download = `translated_${baseName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-detect language effect & smart target flip
  useEffect(() => {
    if (sourceLang === 'auto') {
      const detected = detectLanguage(sourceText);
      if (detected && detected !== detectedLang) {
        setDetectedLang(detected);
        if (detected === targetLang) {
          setTargetLang(detected === 'ru' ? 'en' : 'ru');
        }
      }
    }
  }, [sourceText, sourceLang, targetLang, detectedLang]);

  // Core translation execution (used by debounced effect and Ctrl+Enter shortcut)
  const performTranslation = useCallback(async (forcedText) => {
    const text = (forcedText !== undefined ? forcedText : sourceText).trim();
    if (!text) {
      setTranslatedText('');
      setAlternatives([]);
      setExamples([]);
      setIsInDictionary(false);
      setSavedEntryId(null);
      lastTranslatedKeyRef.current = '';
      return;
    }

    const effectiveSource = sourceLang === 'auto'
      ? (detectLanguage(text) || detectedLang || 'en')
      : sourceLang;

    const cacheKey = `${text}|${effectiveSource}|${targetLang}|${tone}|${selectedContext}`;
    if (forcedText === undefined && cacheKey === lastTranslatedKeyRef.current && translatedText) {
      return;
    }

    if (effectiveSource === targetLang) {
      lastTranslatedKeyRef.current = cacheKey;
      setTranslatedText(text);
      setAlternatives([]);
      setExamples([]);
      setIsTranslating(false);
      return;
    }

    if (translateAbortRef.current) {
      translateAbortRef.current.abort();
    }
    const controller = new AbortController();
    translateAbortRef.current = controller;

    setIsTranslating(true);
    try {
      let resData = null;
      try {
        const res = await api.post('/translate', {
          text: text,
          source_lang: effectiveSource,
          target_lang: targetLang,
          tone: tone
        }, { signal: controller.signal });
        resData = res.data;
      } catch (apiErr) {
        if (apiErr.name === 'CanceledError' || apiErr.code === 'ERR_CANCELED') {
          throw apiErr;
        }
        const mainTrans = await robustTranslateClient(text, effectiveSource, targetLang, controller.signal);
        if (mainTrans) {
          resData = {
            translated_text: mainTrans,
            alternatives: [],
            examples: [],
            is_saved_in_dictionary: false,
            saved_entry_id: null,
          };
        } else {
          throw apiErr;
        }
      }

      if (resData) {
        lastTranslatedKeyRef.current = cacheKey;
        let finalTranslation = resData.translated_text;
        if (selectedContext && selectedContext !== 'general') {
          const directVariants = findAmericanContextVariants(text, selectedContext, resData.alternatives || []);
          const contextualMatch = directVariants.find(v => v.category === selectedContext);
          if (contextualMatch) {
            finalTranslation = contextualMatch.phrase;
          }
        }
        setTranslatedText(finalTranslation);
        setAlternatives(resData.alternatives || []);
        setExamples(resData.examples || []);
        setIsInDictionary(resData.is_saved_in_dictionary || false);
        setSavedEntryId(resData.saved_entry_id || null);
        addToHistory(text, finalTranslation, effectiveSource, targetLang);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        console.error('Translation error:', err);
      }
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, detectedLang, tone, selectedContext, translatedText]);

  // Translation Effect (Debounced 500ms, strictly skips if already translated)
  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setTranslatedText('');
      setAlternatives([]);
      setExamples([]);
      setIsInDictionary(false);
      setSavedEntryId(null);
      lastTranslatedKeyRef.current = '';
      return;
    }

    const effectiveSource = sourceLang === 'auto'
      ? (detectLanguage(text) || detectedLang || 'en')
      : sourceLang;
    const cacheKey = `${text}|${effectiveSource}|${targetLang}|${tone}|${selectedContext}`;

    if (cacheKey === lastTranslatedKeyRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      performTranslation();
    }, 500);

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang, detectedLang, tone, selectedContext, performTranslation]);

  const swapLanguages = useCallback(() => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 300);
    const effectiveSource = sourceLang === 'auto' ? detectedLang : sourceLang;
    setSourceLang(targetLang);
    setTargetLang(effectiveSource);
    const tempText = sourceText;
    lastTranslatedKeyRef.current = '';
    setSourceText(translatedText);
    setTranslatedText(tempText);
  }, [sourceLang, targetLang, detectedLang, sourceText, translatedText]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Esc -> Close any active modal or tab
      if (e.key === 'Escape') {
        if (shortcutsModal) { setShortcutsModal(false); return; }
        if (authModal) { setAuthModal(null); return; }
        if (urlModal) { setUrlModal(false); return; }
        if (manualModal) { setManualModal(false); return; }
        if (newCatModal) { setNewCatModal(false); return; }
        if (flashcardModal) { setFlashcardModal(false); return; }
        if (editingEntry) { setEditingEntry(null); return; }
        if (activeBottomTab) { setActiveBottomTab(null); return; }
        return;
      }

      // 2. Ctrl + Shift + S or Cmd + Shift + S -> Swap languages
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        swapLanguages();
        return;
      }

      // 3. Ctrl + Enter or Cmd + Enter -> Immediate Translation
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        performTranslation();
        return;
      }

      // 4. Ctrl + / or Cmd + / -> Toggle shortcuts modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsModal(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcutsModal,
    authModal,
    urlModal,
    manualModal,
    newCatModal,
    flashcardModal,
    editingEntry,
    activeBottomTab,
    swapLanguages,
    performTranslation
  ]);

  // Export dictionary entries as CSV with UTF-8 BOM
  const handleExportCsv = () => {
    if (!entries || entries.length === 0) return;
    const headers = ['Оригинал', 'Перевод', 'Язык оригинала', 'Язык перевода', 'Категория', 'Дата добавления'];
    const rows = entries.map(item => [
      `"${(item.source_text || '').replace(/"/g, '""')}"`,
      `"${(item.translated_text || '').replace(/"/g, '""')}"`,
      `"${(item.source_lang || '')}"`,
      `"${(item.target_lang || '')}"`,
      `"${(item.category_name || item.category?.name || 'Без категории').replace(/"/g, '""')}"`,
      `"${item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flow_translate_dictionary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyTranslation = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFavorite = async () => {
    if (!user) {
      setAuthModal('login');
      return;
    }
    if (!sourceText.trim() || !translatedText.trim()) return;

    try {
      if (isInDictionary && savedEntryId) {
        await api.delete(`/dictionary/entries/${savedEntryId}`);
        setIsInDictionary(false);
        setSavedEntryId(null);
        loadFavorites();
      } else {
        const effectiveSource = sourceLang === 'auto' ? detectedLang : sourceLang;
        const res = await api.post('/dictionary/entries', {
          source_text: sourceText,
          translated_text: translatedText,
          source_lang: effectiveSource,
          target_lang: targetLang,
          is_favorite: true,
        });
        setIsInDictionary(true);
        setSavedEntryId(res.data.id);
        loadFavorites();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка сохранения');
    }
  };

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const params = { page, page_size: 10, is_favorite: true, sort_by: 'created_at', order: 'desc' };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (filterCat) params.category_id = filterCat;

      const res = await api.get('/dictionary/entries', { params });
      setEntries(res.data.items);
      setTotalPages(res.data.total_pages);
      setTotalEntries(res.data.total);
    } catch (_) {}
  }, [user, page, debouncedSearch, filterCat]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    try {
      const catsRes = await api.get('/dictionary/categories');
      setCategories(catsRes.data);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const deleteFavorite = async (id) => {
    try {
      await api.delete(`/dictionary/entries/${id}`);
      if (savedEntryId === id) {
        setIsInDictionary(false);
        setSavedEntryId(null);
      }
      loadFavorites();
    } catch (_) {}
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/dictionary/entries', {
        source_text: manualForm.source_text,
        translated_text: manualForm.translated_text,
        source_lang: manualForm.source_lang,
        target_lang: manualForm.target_lang,
        notes: manualForm.notes || null,
        category_id: manualForm.category_id || null,
        is_favorite: true,
      });
      setManualModal(false);
      setManualForm({ source_text: '', translated_text: '', source_lang: 'en', target_lang: 'ru', notes: '', category_id: '' });
      loadFavorites();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    }
  };

  const handleEditEntry = async (e) => {
    e.preventDefault();
    if (!editingEntry) return;
    try {
      await api.patch(`/dictionary/entries/${editingEntry.id}`, {
        translated_text: editingEntry.translated_text,
        category_id: editingEntry.category_id || null,
      });
      setEditingEntry(null);
      loadFavorites();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка редактирования');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/dictionary/categories', { name: newCatName, color_hex: newCatColor });
      setNewCatName('');
      setNewCatModal(false);
      loadCategories();
      loadFavorites();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const email = (authEmail || '').trim().toLowerCase();
    if (!email) {
      setAuthError('Пожалуйста, укажите адрес электронной почты');
      return;
    }

    if (authModal === 'register') {
      if (!authPassword) {
        setAuthError('Пожалуйста, введите пароль');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('Пароль должен содержать минимум 6 символов');
        return;
      }
      if (authPassword !== authPasswordConfirm) {
        setAuthError('Пароли не совпадают. Проверьте повтор пароля');
        return;
      }
    } else if (authModal === 'login') {
      if (!authPassword) {
        setAuthError('Пожалуйста, введите пароль');
        return;
      }
    } else if (authModal === 'verify') {
      if (!verifyCode || verifyCode.trim().length < 6) {
        setAuthError('Введите 6-значный код из Google Authenticator');
        return;
      }
    } else if (authModal === 'forgot_password') {
      if (!verifyCode || verifyCode.trim().length < 6) {
        setAuthError('Введите 6-значный код из Google Authenticator');
        return;
      }
      if (!authPassword) {
        setAuthError('Пожалуйста, введите новый пароль');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('Пароль должен содержать минимум 6 символов');
        return;
      }
      if (authPassword !== authPasswordConfirm) {
        setAuthError('Пароли не совпадают. Проверьте повтор пароля');
        return;
      }
    }

    setAuthLoading(true);
    try {
      if (authModal === 'login') {
        const res = await api.post('/auth/login', { email, password: authPassword });
        localStorage.setItem('flow_token', res.data.access_token);
        setUser(res.data.user);
        setAuthModal(null);
        setAuthPassword('');
      } else if (authModal === 'register') {
        const res = await api.post('/auth/register', {
          email,
          password: authPassword,
          password_confirm: authPasswordConfirm,
        });
        if (res.data.qr_code_url) {
          setQrCodeUrl(res.data.qr_code_url);
          setTotpSecret(res.data.secret_key || '');
          setDemoCode(res.data.demo_code || '');
          setVerifyCode('');
          setAuthPasswordConfirm('');
          setAuthModal('verify');
          setAuthSuccess('Отсканируйте QR-код в Google Authenticator или скопируйте ключ:');
        } else if (res.data.access_token) {
          localStorage.setItem('flow_token', res.data.access_token);
          setUser(res.data.user);
          setAuthModal(null);
          setAuthPassword('');
          setAuthPasswordConfirm('');
        } else {
          setAuthSuccess(res.data.message || 'Регистрация успешна! Теперь вы можете войти.');
          setAuthModal('login');
        }
      } else if (authModal === 'verify') {
        const res = await api.post('/auth/verify-code', { email, code: verifyCode.trim() });
        if (res.data.access_token) {
          localStorage.setItem('flow_token', res.data.access_token);
          setUser(res.data.user);
          setAuthModal(null);
          setVerifyCode('');
          setAuthPassword('');
          setAuthPasswordConfirm('');
        } else {
          const loginRes = await api.post('/auth/login', { email, password: authPassword });
          localStorage.setItem('flow_token', loginRes.data.access_token);
          setUser(loginRes.data.user);
          setAuthModal(null);
          setVerifyCode('');
          setAuthPassword('');
          setAuthPasswordConfirm('');
        }
      } else if (authModal === 'forgot_password') {
        const res = await api.post('/auth/reset-password', {
          email,
          code: verifyCode.trim(),
          new_password: authPassword,
          new_password_confirm: authPasswordConfirm,
        });
        if (res.data.access_token) {
          localStorage.setItem('flow_token', res.data.access_token);
          setUser(res.data.user);
          setAuthModal(null);
          setAuthPassword('');
          setAuthPasswordConfirm('');
          setVerifyCode('');
          setAuthSuccess('Пароль успешно изменен! Вход выполнен.');
        } else {
          setAuthSuccess(res.data.message || 'Пароль успешно изменен!');
          setAuthModal('login');
          setAuthPassword('');
          setAuthPasswordConfirm('');
          setVerifyCode('');
        }
      }
    } catch (err) {
      let errorMsg = 'Произошла ошибка при аутентификации. Проверьте введенные данные.';
      if (err.response?.status === 404 && (typeof err.response.data === 'string' && (err.response.data.includes('404') || err.response.data.includes('<!doctype html>')))) {
        errorMsg = 'Сервер бэкенда недоступен на этом домене. Запустите бэкенд или проверьте статус Render.';
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        errorMsg = 'Не удалось связаться с облачным сервером. Подождите 10-15 секунд (бесплатный сервер Render может выходить из спящего режима) и нажмите еще раз.';
      } else if (err.response?.data?.details && Array.isArray(err.response.data.details) && err.response.data.details.length > 0) {
        errorMsg = err.response.data.details.join('; ');
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      }
      setAuthError(errorMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const statsRes = await api.get('/admin/stats');
      setAdminStats(statsRes.data);
      const usersRes = await api.get('/admin/users?page=1&page_size=50');
      setAdminUsers(usersRes.data);
    } catch (_) {}
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/toggle-status`);
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.data.is_active } : u));
      const statsRes = await api.get('/admin/stats');
      setAdminStats(statsRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка изменения статуса пользователя');
    }
  };

  useEffect(() => {
    if (showAdmin && user?.role === 'admin') loadAdminData();
  }, [showAdmin, user]);

  const activeSourceLang = SOURCE_LANGUAGES.find(l => l.code === sourceLang) || SOURCE_LANGUAGES[0];
  const detectedLangObj = TARGET_LANGUAGES.find(l => l.code === detectedLang) || TARGET_LANGUAGES[0];
  const activeTargetLang = TARGET_LANGUAGES.find(l => l.code === targetLang) || TARGET_LANGUAGES[1];
  const currentFlashcard = entries[currentCardIndex];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] dark:bg-gradient-to-b dark:from-[#0B0C10] dark:via-[#070709] dark:to-[#000000] text-[#1C1C1E] dark:text-[#F8FAFC] transition-colors duration-500 font-sans pb-32 overflow-x-hidden selection:bg-white/20 selection:text-white">
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={(e) => processImageFile(e.target.files[0])} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={(e) => processDocumentFile(e.target.files[0])} 
        accept=".txt,.md,.json,.csv,.srt,.pdf" 
        className="hidden" 
      />

      {/* ================= MONOCHROME TITANIUM AMBIENT LIGHTING ================= */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        
        {/* Dynamic Cursor Spotlight (GPU accelerated via CSS variables) */}
        <div 
          className="absolute inset-0 transition-opacity duration-300 opacity-60 dark:opacity-40"
          style={{
            background: `radial-gradient(650px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}, transparent 65%)`
          }}
        />

        {/* Floating Glowing Titanium / Polar Orbs */}
        <div className="absolute -top-32 -left-20 w-[44rem] h-[44rem] rounded-full bg-gradient-to-br from-slate-400/15 via-slate-300/10 to-transparent dark:from-white/10 dark:via-slate-400/8 dark:to-transparent blur-[85px] animate-orb-1" />
        
        <div className="absolute top-1/6 -right-28 w-[46rem] h-[46rem] rounded-full bg-gradient-to-bl from-slate-300/15 via-slate-400/10 to-transparent dark:from-slate-200/10 dark:via-white/6 dark:to-transparent blur-[90px] animate-orb-2" />
        
        <div className="absolute -bottom-24 left-1/5 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-slate-200/15 via-slate-400/10 to-transparent dark:from-white/8 dark:via-slate-500/6 dark:to-transparent blur-[85px] animate-orb-3" />

        {/* Ambient Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55rem] h-[35rem] rounded-full bg-gradient-to-r from-slate-200/20 via-white/10 to-slate-300/15 dark:from-white/6 dark:via-slate-400/4 dark:to-transparent blur-[95px] pointer-events-none" />

        {/* Micro-dot grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* ================= FROSTED GLASS BAR ================= */}
      <header className="sticky top-0 z-40 backdrop-blur-3xl bg-white/70 dark:bg-[#0E0E12]/80 border-b border-black/[0.06] dark:border-white/[0.08] transition-all duration-300 safe-top">
        <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Title (Crisp, High Contrast in Dark Mode, Minimalist Typography) */}
          <div className="flex items-baseline gap-1.5 select-none py-1">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">Flow</span>
            <span className="text-xl sm:text-2xl font-normal tracking-tight text-neutral-400 dark:text-neutral-500">Translate</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            
            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShortcutsModal(true)}
              className="p-1.5 sm:p-2 rounded-full text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white transition-all spring-press apple-glass-pill"
              title="Горячие клавиши (Ctrl + /)"
            >
              <Keyboard size={15} />
            </button>

            {/* Apple Segmented Theme Switcher */}
            <div className="flex items-center apple-glass-pill p-1 rounded-full">
              <button
                onClick={() => toggleTheme('light')}
                className={`p-1.5 rounded-full transition-all duration-200 spring-press ${
                  theme === 'light' 
                    ? 'apple-tab-active text-amber-500 scale-100' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white scale-95'
                }`}
                title="Светлая тема"
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => toggleTheme('dark')}
                className={`p-1.5 rounded-full transition-all duration-200 spring-press ${
                  theme === 'dark' 
                    ? 'apple-tab-active scale-100' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white scale-95'
                }`}
                title="Темная тема"
              >
                <Moon size={14} />
              </button>
            </div>

            {/* User Profile / Login */}
            {user ? (
              <div className="flex items-center gap-2">
                {user.role === 'admin' && (
                  <button
                    onClick={() => setShowAdmin(!showAdmin)}
                    className={`apple-icon-btn p-2 rounded-full text-xs font-semibold spring-press ${
                      showAdmin 
                        ? 'apple-btn-primary !text-white' 
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                    }`}
                    title="Панель администратора"
                  >
                    <Shield size={16} />
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 apple-glass-pill px-3 py-1.5 rounded-full neon-border-hover">
                  <div className="w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px] font-bold uppercase shadow-sm">
                    {user.email[0]}
                  </div>
                  <span className="text-xs font-medium text-[#1C1C1E] dark:text-[#F5F5F7] max-w-[110px] truncate">
                    {user.email.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem('flow_token'); setUser(null); }}
                  className="apple-icon-btn text-[#8E8E93] hover:text-rose-500 p-2 rounded-full spring-press"
                  title="Выйти"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthModal('login'); setAuthError(''); }}
                className="text-xs font-semibold tracking-tight apple-btn-primary px-4 py-2 rounded-full spring-press"
              >
                Войти
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-[1380px] mx-auto px-3.5 sm:px-6 lg:px-8 mt-3 sm:mt-6 space-y-4 sm:space-y-6">

        {/* Dynamic Activity Capsule (Floating Dynamic Island - zero layout shift) */}
        {(isOcrProcessing || isTranslating || isSpeakingSource || isSpeakingTarget) && (
          <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="ios-glass px-4 py-1.5 rounded-full flex items-center gap-2.5 shadow-lg border border-black/10 dark:border-white/15 text-[11px] sm:text-xs font-medium max-w-full truncate bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl">
              {isOcrProcessing ? (
                <>
                  <div className="relative flex items-center justify-center flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping absolute" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 truncate">
                    <Camera size={13} className="animate-pulse flex-shrink-0" />
                    <span className="mono-label tracking-wider">{ocrStatusText || 'OCR Cканирование...'}</span>
                  </span>
                </>
              ) : isTranslating ? (
                <>
                  <div className="relative flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-black dark:bg-white animate-ping absolute" />
                    <div className="w-2 h-2 rounded-full bg-black dark:bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                  </div>
                  <span className="text-black dark:text-white font-semibold flex items-center gap-1.5 truncate">
                    <RefreshCw size={12} className="animate-spin flex-shrink-0" />
                    <span className="mono-label tracking-wider">Перевод...</span>
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-0.5 h-4 px-1 flex-shrink-0">
                    <span className="w-1 bg-black/80 dark:bg-white rounded-full sound-bar shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                    <span className="w-1 bg-black/60 dark:bg-slate-300 rounded-full sound-bar shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                    <span className="w-1 bg-black/40 dark:bg-slate-400 rounded-full sound-bar" />
                    <span className="w-1 bg-black/70 dark:bg-white rounded-full sound-bar shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                  </div>
                  <span className="text-black dark:text-white font-semibold truncate mono-label tracking-wider">Озвучивание речи</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Apple Segmented Mode Switcher (Centered & Lowered) */}
        <div className="flex items-center justify-center w-full overflow-x-auto no-scrollbar pt-4 sm:pt-8 pb-1 sm:pb-2 px-1 touch-pan-x">
          <div className="apple-segmented-pill flex items-center gap-1 border border-black/[0.04] dark:border-white/[0.08] p-1 rounded-full flex-nowrap">
            <button
              onClick={() => { setActiveMode('text'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'text' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
            >
              <Edit3 size={13} className={activeMode === 'text' ? 'text-current' : ''} />
              <span>Текст</span>
            </button>
            <button
              onClick={() => { setActiveMode('image'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'image' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Режим Фото"
            >
              <Camera size={13} className={activeMode === 'image' ? 'text-current' : ''} />
              <span>Фото</span>
            </button>
            <button
              onClick={() => { setActiveMode('doc'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'doc' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Режим Файлы"
            >
              <FileText size={13} className={activeMode === 'doc' ? 'text-current' : ''} />
              <span>Файлы</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('url');
                setUrlModal(true);
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'url' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Перевести веб-страницу"
            >
              <Globe size={13} className={activeMode === 'url' ? 'text-current' : ''} />
              <span>Ссылка</span>
            </button>
            <button
              onClick={() => { setActiveMode('dialogue'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'dialogue' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Синхронный диалог"
            >
              <MessageSquare size={13} className={activeMode === 'dialogue' ? 'text-current' : ''} />
              <span>Диалог</span>
            </button>
            <button
              onClick={() => { setActiveMode('rap'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'rap' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Рэп-треки"
            >
              <Music size={13} className={activeMode === 'rap' ? 'text-current' : ''} />
              <span>Рэп-треки</span>
            </button>
          </div>
        </div>

        {/* Uploaded File Banner */}
        {loadedFile && (
          <div className="ios-glass px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center justify-between border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 animate-in fade-in">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {loadedFile.type === 'image' ? <Camera size={16} className="text-black dark:text-white flex-shrink-0" /> : loadedFile.type === 'url' ? <Globe size={16} className="text-black dark:text-white flex-shrink-0" /> : <FileCheck size={16} className="text-black dark:text-white flex-shrink-0" />}
              <span className="text-xs font-bold text-[#1C1C1E] dark:text-white truncate max-w-[160px] sm:max-w-xs">{loadedFile.name}</span>
              <span className="text-[10px] text-[#8E8E93] bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 rounded-full flex-shrink-0">{loadedFile.size}</span>
            </div>
            <button 
              onClick={handleClearLoadedContent}
              className="text-[#8E8E93] hover:text-rose-500 p-1 rounded-full transition-colors flex-shrink-0"
              title="Удалить файл"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* OCR Progress Bar Banner */}
        {isOcrProcessing && (
          <div className="ios-glass p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-black dark:text-white">
              <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> {ocrStatusText}</span>
              <span className="mono-label text-black dark:text-white">{ocrProgress}%</span>
            </div>
            <div className="w-full bg-black/[0.05] dark:bg-white/[0.1] rounded-full h-1 overflow-hidden">
              <div 
                className="progress-bar-glow h-full transition-all duration-200"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* АДМИНИСТРАТИВНАЯ ПАНЕЛЬ */}
        {showAdmin && user?.role === 'admin' && (
          <div className="ios-glass ios-card-specular rounded-[32px] p-6 space-y-5 shadow-lg animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-black dark:text-white" />
                <h3 className="font-semibold text-xs tracking-wider uppercase text-[#8E8E93]">Панель управления</h3>
              </div>
              <button onClick={() => setShowAdmin(false)} className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"><X size={16} /></button>
            </div>
            {adminStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/80 dark:bg-white/[0.04] p-5 rounded-[24px] border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Всего пользователей</span>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight">{adminStats.total_users}</p>
                </div>
                <div className="bg-white/80 dark:bg-white/[0.04] p-5 rounded-[24px] border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Активные аккаунты</span>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">{adminStats.active_users}</p>
                </div>
                <div className="bg-white/80 dark:bg-white/[0.04] p-5 rounded-[24px] border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Сохранено в словаре</span>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight text-black dark:text-white">{adminStats.total_saved_words}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= СЕКЦИЯ 1: TRANSLATION ================= */}
        <section className="space-y-4">
          
          {/* Apple Segmented Language Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-black dark:text-white shadow-[0_0_12px_rgba(255,255,255,0.15)] border border-black/10 dark:border-white/15">
                <Languages size={15} />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white tracking-tight-premium">
                Переводчик
              </h2>
            </div>

            {/* Apple Glass Language Switcher Pill */}
            <div className="flex items-center apple-glass-pill neon-border-hover p-1 rounded-full shadow-sm">
              <div className="relative">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-3 sm:px-4 py-1.5 rounded-full cursor-pointer transition-all pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
                >
                  {SOURCE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E]">
                      {l.code === 'auto' 
                        ? (sourceLang === 'auto' && detectedLangObj 
                            ? `Авто (${detectedLangObj.label})` 
                            : 'Автоопределение')
                        : `${l.flag} ${l.label}`}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-[#8E8E93]">▾</span>
              </div>

              <button
                onClick={swapLanguages}
                className={`apple-icon-btn spring-press glow-card p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white transition-all duration-300 ${isSwapping ? 'rotate-180 scale-90 text-black dark:text-white' : ''}`}
                title="Поменять языки местами"
              >
                <ArrowRightLeft size={13} />
              </button>

              <div className="relative">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-3 sm:px-4 py-1.5 rounded-full cursor-pointer transition-all pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
                >
                  {TARGET_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E]">
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-[#8E8E93]">▾</span>
              </div>
            </div>
          </div>

          {/* Audio element for Rap / Audio tracks */}
          <audio
            ref={chipinkosAudioRef}
            src={currentAudioTrack.src}
            loop
            preload="auto"
            onPlay={() => setIsPlayingChipinkos(true)}
            onPause={() => setIsPlayingChipinkos(false)}
            onEnded={() => setIsPlayingChipinkos(false)}
            onError={(e) => {
              console.error('Audio load error:', e);
              setIsPlayingChipinkos(false);
            }}
          />

          {/* Translation Domain / Context Chips */}
          {activeMode !== 'dialogue' && activeMode !== 'rap' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <span className="text-[11px] font-bold text-[#8E8E93] mr-1 uppercase tracking-wider hidden sm:inline flex-shrink-0">
                Контекст:
              </span>
              {TRANSLATION_CONTEXTS.map(ctx => (
                <button
                  key={ctx.id}
                  onClick={() => handleSelectContext(ctx.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center flex-shrink-0 active:scale-95 ${
                    selectedContext === ctx.id
                      ? 'apple-tab-active scale-[1.02]'
                      : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-black/[0.03] dark:bg-white/[0.06]'
                  }`}
                  title={ctx.desc}
                >
                  <span>{ctx.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* DIALOGUE MODE (Monochrome Face-to-Face Live Conversation) */}
          {activeMode === 'dialogue' ? (
            <div className="ios-glass ios-card-specular neon-border-hover rounded-[24px] sm:rounded-[28px] p-4 sm:p-6 shadow-xl space-y-4">
              {/* Dialogue Header Controls */}
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06] gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                    Режим синхронного диалога
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93] dark:text-[#A1A1AA] border border-black/10 dark:border-white/10">
                    Live
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoSpeakDialogue(!autoSpeakDialogue)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                      autoSpeakDialogue 
                        ? 'apple-btn-primary !text-white' 
                        : 'apple-btn-glass text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                    }`}
                    title="Автоматически озвучивать перевод для собеседника"
                  >
                    <Volume2 size={13} />
                    <span className="hidden sm:inline">Авто-озвучка:</span>
                    <span>{autoSpeakDialogue ? 'Вкл' : 'Выкл'}</span>
                  </button>

                  {dialogueMessages.length > 0 && (
                    <button
                      onClick={() => setDialogueMessages([])}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-full text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1"
                      title="Очистить историю диалога"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Очистить</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div className="min-h-[220px] max-h-[360px] overflow-y-auto space-y-3 p-2 no-scrollbar">
                {dialogueMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mx-auto">
                      <MessageSquare size={22} />
                    </div>
                    <p className="text-sm font-semibold text-[#1C1C1E] dark:text-white">
                      Диалог двух собеседников
                    </p>
                    <p className="text-xs text-[#8E8E93] max-w-sm mx-auto">
                      Нажмите кнопку микрофона снизу и говорите на своем языке. Перевод отобразится в чате и будет озвучен собеседнику.
                    </p>
                  </div>
                ) : (
                  dialogueMessages.map((msg) => {
                    const isLeft = msg.sender === 'left';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isLeft ? 'items-start' : 'items-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                      >
                        <div className={`max-w-[88%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-2xl sm:rounded-[22px] shadow-sm transition-all ${
                          isLeft 
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-br-sm' 
                            : 'bg-black/5 dark:bg-white/[0.08] text-[#1C1C1E] dark:text-white border border-black/10 dark:border-white/10 rounded-bl-sm'
                        }`}>
                          <div className={`flex items-center justify-between gap-3 text-[10px] pb-1 mb-1 border-b ${
                            isLeft 
                              ? 'border-white/20 dark:border-black/15 text-neutral-300 dark:text-neutral-600' 
                              : 'border-black/10 dark:border-white/15 text-[#8E8E93] dark:text-[#A1A1AA]'
                          }`}>
                            <span className="font-bold uppercase tracking-wider">
                              {isLeft 
                                ? (sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.label : 'Авто') : activeSourceLang.label) 
                                : activeTargetLang.label}
                            </span>
                            <span className="opacity-90">{msg.timestamp}</span>
                          </div>
                          
                          {/* Original spoken text */}
                          <p className={`text-xs sm:text-sm font-medium leading-relaxed ${
                            isLeft ? 'text-white/90 dark:text-neutral-900/90' : 'text-[#3A3A3C] dark:text-white/90'
                          }`}>
                            {msg.text}
                          </p>
                          
                          {/* Translated text */}
                          <div className={`mt-2 pt-2 border-t flex items-start justify-between gap-2 ${
                            isLeft ? 'border-white/20 dark:border-black/15 text-white dark:text-neutral-900' : 'border-black/10 dark:border-white/15 text-[#1C1C1E] dark:text-white'
                          }`}>
                            <p className="text-sm sm:text-base font-bold leading-snug">
                              {msg.translatedText}
                            </p>
                            <button
                              onClick={() => speak(msg.translatedText, msg.targetLang, true)}
                              className={`p-1 rounded-full flex-shrink-0 transition-colors ${
                                isLeft 
                                  ? 'hover:bg-white/20 dark:hover:bg-black/10 text-white dark:text-neutral-900' 
                                  : 'hover:bg-black/10 dark:hover:bg-white/20 text-[#1C1C1E] dark:text-white'
                              }`}
                              title="Озвучить"
                            >
                              <Volume2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Split Dual-Microphone Controls for Two Speakers */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                {/* Speaker 1 (Source Lang) */}
                <div className="ios-glass p-3.5 sm:p-4 rounded-[22px] min-h-[145px] sm:min-h-[160px] flex flex-col items-center justify-between border border-black/[0.06] dark:border-white/[0.08] text-center shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E] dark:text-white">
                    <span>{sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.flag : '') : activeSourceLang.flag}</span>
                    <span className="truncate max-w-[90px] sm:max-w-none">{sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.label : 'Авто') : activeSourceLang.label}</span>
                  </div>
                  <button
                    onClick={() => startDialogueRecognition('left')}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                      isDialogueListeningLeft
                        ? 'bg-rose-500 text-white shadow-rose-500/40 animate-mic-recording scale-110'
                        : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 shadow-sm'
                    }`}
                    title="Говорить на первом языке"
                  >
                    {isDialogueListeningLeft ? <MicOff size={22} className="sm:size-6" /> : <Mic size={22} className="sm:size-6" />}
                  </button>
                  <span className="text-[11px] font-semibold text-[#8E8E93]">
                    {isDialogueListeningLeft ? 'Слушаю...' : 'Говорить'}
                  </span>
                </div>

                {/* Speaker 2 (Target Lang) */}
                <div className="ios-glass p-3.5 sm:p-4 rounded-[22px] min-h-[145px] sm:min-h-[160px] flex flex-col items-center justify-between border border-black/[0.06] dark:border-white/[0.08] text-center shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E] dark:text-white">
                    <span>{activeTargetLang.flag}</span>
                    <span className="truncate max-w-[90px] sm:max-w-none">{activeTargetLang.label}</span>
                  </div>
                  <button
                    onClick={() => startDialogueRecognition('right')}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                      isDialogueListeningRight
                        ? 'bg-rose-500 text-white shadow-rose-500/40 animate-mic-recording scale-110'
                        : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95 shadow-sm'
                    }`}
                    title="Говорить на втором языке"
                  >
                    {isDialogueListeningRight ? <MicOff size={22} className="sm:size-6" /> : <Mic size={22} className="sm:size-6" />}
                  </button>
                  <span className="text-[11px] font-semibold text-[#8E8E93]">
                    {isDialogueListeningRight ? 'Слушаю...' : 'Говорить'}
                  </span>
                </div>
              </div>
            </div>
          ) : activeMode === 'rap' ? (
            <div className="space-y-4 animate-in fade-in">
              {/* Music Player Bar with Track Selector */}
              <div className="ios-glass ios-card-specular rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 flex flex-col gap-3 border border-black/10 dark:border-white/10 shadow-lg relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0">
                      <Music size={20} className={isPlayingChipinkos ? 'animate-pulse' : ''} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white truncate">
                          {currentAudioTrack.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/15 text-black dark:text-white border border-black/10 dark:border-white/20 flex-shrink-0">
                          {currentAudioTrack.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-xs text-[#8E8E93]">
                        <div className="flex items-end gap-0.5 h-3">
                          <span className={`w-0.5 bg-black dark:bg-white rounded-full transition-all ${isPlayingChipinkos ? 'h-3 animate-pulse' : 'h-1'}`} />
                          <span className={`w-0.5 bg-black dark:bg-white rounded-full transition-all ${isPlayingChipinkos ? 'h-2 animate-bounce' : 'h-1'}`} />
                          <span className={`w-0.5 bg-black dark:bg-white rounded-full transition-all ${isPlayingChipinkos ? 'h-3.5 animate-pulse' : 'h-1'}`} />
                          <span className={`w-0.5 bg-black dark:bg-white rounded-full transition-all ${isPlayingChipinkos ? 'h-1.5 animate-bounce' : 'h-1'}`} />
                        </div>
                        <span>{isPlayingChipinkos ? 'Воспроизведение активно' : 'Нажмите «Слушать» для включения звука'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Player Controls */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={toggleChipinkosAudio}
                      className="apple-btn-primary px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-md active:scale-95"
                      title={isPlayingChipinkos ? 'Пауза' : `Включить: ${currentAudioTrack.title}`}
                    >
                      {isPlayingChipinkos ? <Pause size={14} /> : <Play size={14} />}
                      <span>{isPlayingChipinkos ? 'Пауза' : 'Слушать'}</span>
                    </button>
                    <button
                      onClick={toggleChipinkosMute}
                      className="apple-btn-glass p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                      title={isChipinkosMuted ? 'Включить звук' : 'Выключить звук'}
                    >
                      {isChipinkosMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                  </div>
                </div>

                {/* Audio Track Selector Pills */}
                <div className="w-full flex items-center gap-1.5 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08] overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mr-1 flex-shrink-0">
                    Аудио:
                  </span>
                  {RAP_AUDIO_TRACKS.map(track => (
                    <button
                      key={track.id}
                      onClick={() => handleSelectAudioTrack(track.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0 active:scale-95 ${
                        selectedAudioTrack === track.id
                          ? 'apple-tab-active scale-[1.02]'
                          : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-black/[0.03] dark:bg-white/[0.06]'
                      }`}
                    >
                      <span>{track.title}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-bold opacity-80">
                        {track.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider mr-1">
                  Примеры:
                </span>
                <button
                  onClick={() => setRapLyricsText(CHIPINKOS_PRESET_LYRICS)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold apple-btn-glass text-black dark:text-white hover:scale-[1.02] active:scale-95"
                >
                  Чипинкос (рэп)
                </button>
                <button
                  onClick={() => setRapLyricsText(MOAN_PRESET_LYRICS)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold apple-btn-glass text-black dark:text-white hover:scale-[1.02] active:scale-95"
                >
                  Стоны (18+)
                </button>
                <button
                  onClick={() => setRapLyricsText(POP_BALLAD_PRESET_LYRICS)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold apple-btn-glass text-black dark:text-white hover:scale-[1.02] active:scale-95"
                >
                  Лирический текст
                </button>
                <button
                  onClick={() => setRapLyricsText('')}
                  className="px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#8E8E93] hover:text-rose-500"
                >
                  Очистить
                </button>
              </div>

              {/* Genre Determination Card */}
              {hipHopAnalysis && (
                <div className={`ios-glass rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 border transition-all shadow-md ${
                  hipHopAnalysis.isHipHop
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05]'
                    : 'border-neutral-400/20 bg-neutral-500/[0.02] dark:bg-neutral-500/[0.04]'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${hipHopAnalysis.isHipHop ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                          {hipHopAnalysis.genreTitle}
                        </h3>
                      </div>
                      <p className="text-xs text-[#8E8E93] pt-1">
                        {hipHopAnalysis.genreDescription}
                      </p>
                    </div>

                    {hipHopAnalysis.markers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {hipHopAnalysis.markers.map(m => (
                          <span key={m} className="text-xs font-medium px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-neutral-800 dark:text-neutral-200 border border-black/10 dark:border-white/10">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Side-by-Side Lyrics Editor & Translator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lyrics Input */}
                <div className="ios-glass ios-card-specular rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between shadow-lg min-h-[280px]">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                        Текст трека
                      </span>
                      <span className="text-[10px] text-[#8E8E93]">
                        {rapLyricsText.length} симв.
                      </span>
                    </div>

                    <textarea
                      value={rapLyricsText}
                      onChange={(e) => setRapLyricsText(e.target.value)}
                      placeholder="Вставьте или напишите текст трека..."
                      rows={8}
                      className="w-full bg-transparent resize-none focus:outline-none text-base sm:text-lg font-medium leading-relaxed text-[#1C1C1E] dark:text-white placeholder-[#8E8E93]"
                    />
                  </div>
                </div>

                {/* Lyrics English Translation */}
                <div className="bg-[#F1F3F4] dark:bg-[#1E1F20] border border-black/[0.06] dark:border-white/[0.06] rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between shadow-sm min-h-[280px]">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                        Перевод на английский язык
                      </span>
                      <div className="flex items-center gap-2">
                        {rapTranslation && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(rapTranslation);
                            }}
                            className="apple-icon-btn p-1.5 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                            title="Скопировать перевод"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`transition-opacity duration-200 ${isTranslatingRap ? 'opacity-65' : 'opacity-100'}`}>
                      {isTranslatingRap && !rapTranslation ? (
                        <div className="flex items-center gap-2 py-6 text-[#8E8E93]">
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Переводим трек...</span>
                        </div>
                      ) : (
                        <p className="text-base sm:text-lg font-medium leading-relaxed text-[#1C1C1E] dark:text-white whitespace-pre-wrap select-text">
                          {rapTranslation || <span className="text-[#8E8E93] font-normal">Перевод трека появится здесь...</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Cards Grid with Ambient Radial Glow */
            <div className="relative">
              {/* Subtle ambient glow behind translator cards */}
              <div className="absolute -inset-3 sm:-inset-4 bg-gradient-to-r from-white/10 via-slate-400/5 to-white/10 dark:from-white/8 dark:via-slate-400/4 dark:to-white/8 rounded-[40px] blur-2xl pointer-events-none opacity-70 dark:opacity-50" />

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Source Card (Apple & Google UI with Live Text, Files, and Safari Reader) */}
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    if (file.type.startsWith('image/')) processImageFile(file);
                    else processDocumentFile(file);
                  }
                }}
                className={`ios-glass ios-card-specular neon-border-hover rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 min-h-[250px] sm:min-h-[290px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl focus-within:ring-2 focus-within:ring-black/20 dark:focus-within:ring-white/30 relative ${isDragging ? 'ring-4 ring-black/40 dark:ring-white/40 bg-black/5 dark:bg-white/5 scale-[1.01]' : ''}`}
              >
              {isDragging && (
                <div className="absolute inset-0 z-30 backdrop-blur-md bg-white/80 dark:bg-black/80 rounded-[28px] sm:rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-3 text-black dark:text-white font-bold animate-in fade-in p-4 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center animate-bounce">
                    <UploadCloud size={28} className="sm:size-9" />
                  </div>
                  <span className="text-xs sm:text-sm tracking-tight">Отпустите для анализа и перевода</span>
                </div>
              )}

              <div>
                {/* Source Card Header with Mode Badges */}
                <div className="flex flex-wrap items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-black/[0.04] dark:border-white/[0.06] gap-1.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    {sourceLang === 'auto' ? (
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                        <span className="hidden xs:inline">Авто:</span>
                        <span className="text-[10px] font-bold text-black dark:text-white bg-black/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-black/10 dark:border-white/15 flex items-center gap-1">
                          {detectedLangObj.flag} {detectedLangObj.label}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                        {activeSourceLang.flag} {activeSourceLang.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {activeMode === 'image' && (
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-black dark:text-white apple-btn-glass rounded-full transition-all flex items-center gap-1"
                        title="Выбрать другое фото"
                      >
                        <Camera size={13} /> <span>{imagePreviewUrl ? 'Заменить' : 'Выбрать'}</span>
                      </button>
                    )}
                    {activeMode === 'doc' && (
                      <button
                        onClick={() => docInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-black dark:text-white apple-btn-glass rounded-full transition-all flex items-center gap-1"
                        title="Выбрать другой документ"
                      >
                        <UploadCloud size={13} /> <span>{loadedFile ? 'Заменить' : 'Выбрать'}</span>
                      </button>
                    )}
                    {activeMode === 'url' && (
                      <button
                        onClick={() => setUrlModal(true)}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-black dark:text-white apple-btn-glass rounded-full transition-all flex items-center gap-1"
                        title="Ввести другой адрес"
                      >
                        <Globe size={13} /> <span>{loadedFile ? 'Сменить' : 'Ввести URL'}</span>
                      </button>
                    )}
                    {(sourceText || imagePreviewUrl || loadedFile) && (
                      <button 
                        onClick={handleClearLoadedContent}
                        className="apple-icon-btn text-[#8E8E93] hover:text-rose-500 p-1.5 rounded-full"
                        title="Очистить"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* MODE: IMAGE (Google Lens & Live Text Viewfinder) */}
                {activeMode === 'image' && (
                  <div className="space-y-3 mb-2">
                    {isCameraActive ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black border border-black/10 dark:border-white/10 p-3 flex flex-col items-center justify-center animate-in fade-in">
                        <div className="relative w-full max-h-72 overflow-hidden rounded-xl flex items-center justify-center bg-black/60">
                          <video ref={videoRef} autoPlay playsInline className="w-full max-h-72 rounded-xl object-cover" />
                          <span className="viewfinder-bracket top-3 left-3 border-t-2 border-l-2 rounded-tl border-white" />
                          <span className="viewfinder-bracket top-3 right-3 border-t-2 border-r-2 rounded-tr border-white" />
                          <span className="viewfinder-bracket bottom-3 left-3 border-b-2 border-l-2 rounded-bl border-white" />
                          <span className="viewfinder-bracket bottom-3 right-3 border-b-2 border-r-2 rounded-br border-white" />
                        </div>

                        <div className="flex items-center gap-3 pt-3">
                          <button
                            onClick={captureCameraFrame}
                            className="apple-btn-primary px-5 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95"
                          >
                            <Camera size={14} /> <span>Сделать снимок</span>
                          </button>
                          <button
                            onClick={stopCamera}
                            className="apple-btn-glass px-4 py-2 rounded-full font-semibold text-xs text-white hover:text-rose-400 active:scale-95"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : imagePreviewUrl ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 p-3 sm:p-4 flex flex-col items-center animate-in fade-in">
                        {/* Lens Toolbar */}
                        <div className="w-full flex flex-wrap items-center justify-between pb-2.5 mb-2.5 border-b border-black/[0.05] dark:border-white/[0.08] gap-2 text-xs">
                          <div className="flex items-center gap-2 font-bold text-[#1C1C1E] dark:text-white">
                            <Scan size={15} className="text-black dark:text-white" />
                            <span>Объектив</span>
                            {((rawOcrData.words && rawOcrData.words.length > 0) || ocrBlocks.length > 0) && (
                              <span className="text-[10px] px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-full text-[#8E8E93] font-semibold">
                                {(rawOcrData.words?.length || ocrBlocks.length)} слов распознано
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {selectedSnippet && (
                              <button
                                onClick={handleResetToFullText}
                                className="text-[11px] font-semibold text-black dark:text-white underline hover:opacity-80 transition-opacity"
                                title="Вернуть весь исходный текст фото"
                              >
                                Весь текст фото
                              </button>
                            )}

                            {fullOcrText && (
                              <button
                                onClick={() => handleCopyLensText(fullOcrText, 'all')}
                                className="px-2.5 py-1 rounded-full font-semibold apple-btn-glass text-[11px] text-black dark:text-white flex items-center gap-1 transition-all active:scale-95"
                                title="Скопировать весь распознанный текст изображения"
                              >
                                {copiedLensId === 'all' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                <span>{copiedLensId === 'all' ? 'Скопировано!' : 'Копировать всё'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive Live Text Stage: User can highlight words with mouse cursor */}
                        <div 
                          className="live-text-container select-text"
                          onMouseUp={handleMouseUpSelection}
                        >
                          {/* Laser Scan Beam */}
                          {isOcrProcessing && <div className="lens-laser-beam" />}

                          <img 
                            src={imagePreviewUrl} 
                            alt="Фото для распознавания" 
                            className={`max-h-[300px] sm:max-h-[380px] w-auto object-contain rounded-xl block transition-all duration-300 pointer-events-none select-none ${isOcrProcessing ? 'opacity-70 blur-[1px]' : ''}`} 
                          />

                          {/* Live Text Overlay: Exact selectable spans on top of words */}
                          {imageNaturalDims.width > 0 && imageNaturalDims.height > 0 && !isOcrProcessing && (
                            <div 
                              className="live-text-overlay select-text"
                              onMouseUp={handleMouseUpSelection}
                            >
                              {(rawOcrData.words && rawOcrData.words.length > 0 ? rawOcrData.words : ocrBlocks).map((w) => {
                                const left = (w.bbox.x0 / imageNaturalDims.width) * 100;
                                const top = (w.bbox.y0 / imageNaturalDims.height) * 100;
                                const width = ((w.bbox.x1 - w.bbox.x0) / imageNaturalDims.width) * 100;
                                const height = ((w.bbox.y1 - w.bbox.y0) / imageNaturalDims.height) * 100;

                                return (
                                  <span
                                    key={w.id}
                                    onClick={(e) => { e.stopPropagation(); handleWordClick(w.text); }}
                                    style={{
                                      left: `${left}%`,
                                      top: `${top}%`,
                                      width: `${Math.max(1.2, width)}%`,
                                      height: `${Math.max(2, height)}%`,
                                      fontSize: `${Math.max(11, Math.min(22, height * 2.6))}px`,
                                      lineHeight: `${Math.max(12, height * 2.6)}px`
                                    }}
                                    className="live-text-word"
                                    title="Выделите мышью или нажмите для мгновенного перевода"
                                  >
                                    {w.text}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Floating Indicator when a selection is active */}
                          {selectedSnippet && !isOcrProcessing && (
                            <div className="live-text-badge animate-in fade-in zoom-in-95 duration-150">
                              <Check size={12} className="text-emerald-400" />
                              <span className="truncate max-w-[200px]">Выделено: «{selectedSnippet}»</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleResetToFullText(); }}
                                className="ml-1 text-[10px] underline text-[#AEAEB2] hover:text-white"
                              >
                                Сбросить
                              </button>
                            </div>
                          )}

                          {/* OCR Scanning Overlay Indicator */}
                          {isOcrProcessing && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-2 text-center z-30">
                              <div className="flex items-center gap-2 bg-black/75 px-3.5 py-1.5 rounded-full border border-white/20 shadow-lg">
                                <Loader2 size={16} className="animate-spin text-white" />
                                <span className="text-xs font-semibold truncate">{ocrStatusText || 'Сканирование текста...'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Hint Footer */}
                        <div className="w-full flex items-center justify-center pt-2 mt-1 text-[11px] text-[#8E8E93] text-center">
                          <span>
                            Выделите курсором мыши любые слова прямо на фото или в поле ниже — они сразу переведутся
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-5 sm:p-7 flex flex-col items-center justify-center text-center transition-all bg-black/[0.01] dark:bg-white/[0.01]">
                        <span className="viewfinder-bracket top-2.5 left-2.5 border-t-2 border-l-2 rounded-tl border-black/30 dark:border-white/30" />
                        <span className="viewfinder-bracket top-2.5 right-2.5 border-t-2 border-r-2 rounded-tr border-black/30 dark:border-white/30" />
                        <span className="viewfinder-bracket bottom-2.5 left-2.5 border-b-2 border-l-2 rounded-bl border-black/30 dark:border-white/30" />
                        <span className="viewfinder-bracket bottom-2.5 right-2.5 border-b-2 border-r-2 rounded-br border-black/30 dark:border-white/30" />

                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mb-2.5">
                          <Scan size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Google Объектив (Lens Scanner)
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-3 leading-relaxed">
                          Распознавание строк и слов с интерактивным выделением и AR-переводом
                        </p>

                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="apple-btn-primary px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Camera size={13} /> <span>Выбрать фото</span>
                          </button>
                          <button
                            onClick={startCamera}
                            disabled={isCameraLoading}
                            className="apple-btn-glass px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 text-black dark:text-white active:scale-95"
                          >
                            {isCameraLoading ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
                            <span>Камера</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedSnippet && (
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs text-[#1C1C1E] dark:text-white animate-in fade-in">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
                          <span className="font-semibold truncate">Перевод выделенного: «{selectedSnippet}»</span>
                        </div>
                        <button
                          onClick={handleResetToFullText}
                          className="text-[11px] font-bold underline hover:opacity-75 transition-opacity flex-shrink-0 ml-2"
                        >
                          Вернуть всё фото
                        </button>
                      </div>
                    )}

                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceText}
                      onMouseUp={(e) => {
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        if (start !== undefined && end !== undefined && end > start) {
                          const sel = e.target.value.substring(start, end).trim();
                          if (sel && sel.length > 0 && sel !== sourceText) {
                            setSourceText(sel);
                            setSelectedSnippet(sel);
                          }
                        }
                      }}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Распознанный текст появится здесь..."
                      maxLength={2000}
                      style={{ minHeight: '130px' }}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white overflow-hidden select-text"
                    />
                  </div>
                )}

                {/* MODE: DOCUMENT */}
                {activeMode === 'doc' && (
                  <div className="space-y-2.5 sm:space-y-3 mb-2">
                    {loadedFile && (loadedFile.type === 'doc' || loadedFile.type === 'pdf') ? (
                      <div className="p-3 sm:p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
                            {loadedFile.ext || 'DOC'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1C1C1E] dark:text-white truncate max-w-[140px] sm:max-w-xs">{loadedFile.name}</p>
                            <p className="text-[10px] text-[#8E8E93]">{loadedFile.size} · {sourceText.length} симв.</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-neutral-800 dark:text-neutral-200 flex items-center gap-1 border border-black/10 dark:border-white/15 flex-shrink-0">
                          <Check size={11} /> <span>Готово</span>
                        </span>
                      </div>
                    ) : (
                      <div 
                        onClick={() => docInputRef.current?.click()}
                        className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 hover:border-black/40 dark:hover:border-white/40 p-5 sm:p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group active:scale-[0.99]"
                      >
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                          <FileText size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Перевод документов
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2.5 leading-relaxed">
                          Выберите файл документа для извлечения и перевода текста
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
                          {['PDF', 'TXT', 'MD', 'JSON', 'CSV', 'SRT'].map((ext) => (
                            <span key={ext} className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93] dark:text-[#A1A1AA] border border-black/5 dark:border-white/10">
                              {ext}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Текст документа для перевода..."
                      maxLength={2000}
                      style={{ minHeight: '130px' }}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white overflow-hidden"
                    />
                  </div>
                )}

                {/* MODE: URL */}
                {activeMode === 'url' && (
                  <div className="space-y-2.5 sm:space-y-3 mb-2">
                    {loadedFile && loadedFile.type === 'url' ? (
                      <div className="p-3 sm:p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            <Compass size={18} className="sm:size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#1C1C1E] dark:text-white truncate max-w-[140px] sm:max-w-xs">{loadedFile.name}</span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#8E8E93] dark:text-[#A1A1AA] flex-shrink-0">Статья</span>
                            </div>
                            <p className="text-[10px] text-[#8E8E93]">
                              ~{Math.max(1, Math.round(sourceText.split(/\s+/).filter(Boolean).length / 150))} мин · {sourceText.split(/\s+/).filter(Boolean).length} слов
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setUrlModal(true)}
                          className="text-xs font-semibold px-3 py-1 rounded-full apple-btn-glass text-black dark:text-white transition-all flex-shrink-0"
                        >
                          Сменить
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setUrlModal(true)}
                        className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 hover:border-black/40 dark:hover:border-white/40 p-5 sm:p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group active:scale-[0.99]"
                      >
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                          <Globe size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Перевод веб-страницы по ссылке
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2.5 leading-relaxed">
                          Введите URL-адрес статьи или новости для извлечения чистого текста
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-black dark:text-white font-semibold">
                          <span>Ввести адрес</span> <ArrowUpRight size={13} />
                        </div>
                      </div>
                    )}

                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Текст статьи для перевода..."
                      maxLength={2000}
                      style={{ minHeight: '130px' }}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white overflow-hidden"
                    />
                  </div>
                )}

                {/* MODE: STANDARD TEXT */}
                {activeMode === 'text' && (
                  <textarea
                    ref={sourceTextareaRef}
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Введите текст или перетащите фото / документ сюда..."
                    maxLength={2000}
                    style={{ minHeight: '160px' }}
                    className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white overflow-hidden"
                  />
                )}
              </div>

              {/* Source Card Footer */}
              <div className="flex flex-wrap items-center justify-between pt-3 sm:pt-4 border-t border-black/[0.04] dark:border-white/[0.06] gap-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => speak(sourceText, sourceLang === 'auto' ? detectedLang : sourceLang, false)}
                    disabled={!sourceText.trim()}
                    className={`apple-icon-btn p-2 rounded-full transition-all duration-200 ${
                      isSpeakingSource
                        ? 'apple-btn-primary !text-white scale-105'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white disabled:opacity-20'
                    }`}
                    title="Озвучить оригинал"
                  >
                    <Volume2 size={17} />
                  </button>

                  <button
                    onClick={toggleVoiceInput}
                    className={`apple-icon-btn p-2 rounded-full transition-all duration-200 ${
                      isListening
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105 animate-pulse'
                        : 'text-[#8E8E93] hover:text-black dark:text-white dark:hover:text-white'
                    }`}
                    title={isListening ? "Остановить диктовку" : "Голосовой ввод (Диктовка речи)"}
                  >
                    {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                  </button>

                  {isListening && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-semibold animate-in fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="hidden xs:inline">Диктовка...</span>
                    </div>
                  )}

                  {micError && !isListening && (
                    <span className="text-[11px] text-rose-500 font-medium animate-in fade-in">
                      {micError}
                    </span>
                  )}

                  <span className={`text-[11px] font-medium ${sourceText.length >= 2000 ? 'text-amber-500 font-semibold' : 'text-[#8E8E93]'}`}>
                    {sourceText.length} / 2000 <span className="hidden xs:inline">символов</span><span className="xs:hidden">симв.</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => performTranslation()}
                    disabled={!sourceText.trim() || isTranslating}
                    className="apple-btn-primary px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                    title="Выполнить перевод"
                  >
                    {isTranslating ? <RefreshCw size={12} className="animate-spin" /> : <Languages size={12} />}
                    <span>Перевести</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Card (Distinct Surface Color matching Google Translate Reference) */}
            <div className="bg-[#F1F3F4] dark:bg-[#1E1F20] border border-black/[0.06] dark:border-white/[0.06] rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 min-h-[250px] sm:min-h-[290px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl relative overflow-hidden shadow-sm">
              
              {isTranslating && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between pb-2.5 sm:pb-3 mb-2 sm:mb-2.5 border-b border-black/[0.04] dark:border-white/[0.06] gap-2">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                    {activeTargetLang.flag} {activeTargetLang.label}
                  </span>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {translatedText && (
                      <button
                        onClick={handleDownloadTranslation}
                        className="text-[11px] sm:text-xs font-semibold px-3 sm:px-3.5 py-1.5 rounded-full apple-btn-primary flex items-center gap-1.5"
                        title="Скачать перевод в файл .txt"
                      >
                        <Download size={13} /> <span>Скачать</span><span className="hidden sm:inline">&nbsp;.txt</span>
                      </button>
                    )}
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/15 uppercase tracking-wider">
                      Результат
                    </span>
                  </div>
                </div>

                <div className={`transition-opacity duration-200 ${isTranslating && translatedText ? 'opacity-65' : 'opacity-100'}`}>
                  {isTranslating && !translatedText ? (
                    <div className="flex items-center gap-3 py-6 text-[#8E8E93]">
                      <div className="w-5 h-5 rounded-full border-2 border-black dark:border-white border-t-transparent animate-spin" />
                      <span className="text-base sm:text-lg font-medium text-[#8E8E93]">Переводим текст...</span>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1C1C1E] dark:text-white select-text leading-snug tracking-tight break-words whitespace-pre-wrap">
                        {translatedText || <span className="text-[#8E8E93] dark:text-[#5F6368] font-normal">Перевод</span>}
                      </h3>

                      {/* Contextual translation variants for American English speakers */}
                      {contextVariants && contextVariants.length > 0 && activeMode !== 'dialogue' && activeMode !== 'rap' && (
                        <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5 animate-in fade-in">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                              Варианты перевода в контексте
                            </span>
                            {selectedContext !== 'general' && activeContextObj && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#1C1C1E] dark:text-white border border-black/10 dark:border-white/10">
                                {activeContextObj.label}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {contextVariants.map((item, idx) => {
                              const catLabel = item.category === 'idioms' ? 'Идиома'
                                : item.category === 'slang' ? 'Сленг'
                                : item.category === 'business' ? 'Бизнес'
                                : item.category === 'culinary' ? 'Кулинария'
                                : item.category === 'it' ? 'IT'
                                : 'Разговорный';

                              const isCurrent = translatedText?.toLowerCase().trim() === item.phrase.toLowerCase().trim();

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setTranslatedText(item.phrase)}
                                  className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                    isCurrent
                                      ? 'bg-black/10 dark:bg-white/15 border-black/20 dark:border-white/30 shadow-sm'
                                      : 'bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] border-black/[0.06] dark:border-white/[0.08]'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm sm:text-base font-semibold text-[#1C1C1E] dark:text-white">
                                        {item.phrase}
                                      </span>
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[#8E8E93] dark:text-[#A1A1AA]">
                                        {catLabel}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#8E8E93] dark:text-[#A1A1AA] pt-0.5 leading-snug">
                                      {item.meaning}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 flex-shrink-0 self-end sm:self-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(item.phrase);
                                      }}
                                      className="p-1 rounded-md text-[#8E8E93] hover:text-black dark:hover:text-white transition-colors"
                                      title="Скопировать этот вариант"
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTranslatedText(item.phrase);
                                      }}
                                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1C1C1E] dark:text-white transition-colors"
                                      title="Выбрать этот перевод"
                                    >
                                      Выбрать
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Card Footer */}
              <div className="flex flex-wrap items-center justify-between pt-3 sm:pt-4 border-t border-black/[0.04] dark:border-white/[0.06] gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => speak(translatedText, targetLang, true)}
                    disabled={!translatedText}
                    className={`apple-icon-btn p-2 rounded-full transition-all duration-200 ${
                      isSpeakingTarget
                        ? 'apple-btn-primary !text-white scale-105'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white disabled:opacity-20'
                    }`}
                    title="Озвучить перевод"
                  >
                    <Volume2 size={17} />
                  </button>
                  <button
                    onClick={copyTranslation}
                    disabled={!translatedText}
                    className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white disabled:opacity-20 transition-all"
                    title="Скопировать"
                  >
                    {copied ? <Check size={17} className="text-emerald-500" /> : <Copy size={17} />}
                  </button>
                  {copied && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                      Скопировано
                    </span>
                  )}
                </div>

                <button
                  onClick={toggleFavorite}
                  disabled={!translatedText}
                  className={`apple-icon-btn p-2 rounded-full transition-all ${
                    isInDictionary 
                      ? 'text-amber-500 !border-amber-400/40 bg-amber-500/10 scale-105' 
                      : 'text-[#8E8E93] hover:text-amber-500'
                  }`}
                  title={isInDictionary ? "Удалить из Favorites" : "Сохранить в Favorites"}
                >
                  <Star size={18} fill={isInDictionary ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

      </section>

        {/* ================= СЕКЦИЯ 2: ИСТОРИЯ И СОХРАНЕННЫЕ (КРУГЛЫЕ КНОПКИ ПО ЦЕНТРУ КАК В РЕФЕРЕНСЕ) ================= */}
        <section className="space-y-6 pt-3 sm:pt-6 pb-12">
          
          {/* Centered Circular Action Buttons (Google Translate Reference Style) */}
          <div className="flex items-center justify-center gap-10 sm:gap-14 py-2">
            
            {/* 1. Кнопка "История" */}
            <div className="flex flex-col items-center gap-2 group">
              <button
                type="button"
                onClick={() => setActiveBottomTab(activeBottomTab === 'history' ? null : 'history')}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 spring-press relative ${
                  activeBottomTab === 'history'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg scale-105 ring-2 ring-black/20 dark:ring-white/40'
                    : 'apple-btn-glass text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/30 hover:scale-105'
                }`}
                title={activeBottomTab === 'history' ? 'Свернуть историю' : 'Открыть историю переводов'}
              >
                <History size={20} className="sm:size-[22px] transition-transform group-hover:rotate-[-8deg]" />
                {recentHistory.length > 0 && (
                  <span className={`absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 min-w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                    activeBottomTab === 'history'
                      ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
                      : 'bg-black/10 dark:bg-white/20 text-neutral-800 dark:text-neutral-200'
                  }`}>
                    {recentHistory.length}
                  </span>
                )}
              </button>
              <span className={`text-xs font-medium tracking-tight select-none transition-colors ${
                activeBottomTab === 'history'
                  ? 'text-neutral-900 dark:text-white font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white'
              }`}>
                История
              </span>
            </div>

            {/* 2. Кнопка "Сохраненные" */}
            <div className="flex flex-col items-center gap-2 group">
              <button
                type="button"
                onClick={() => setActiveBottomTab(activeBottomTab === 'favorites' ? null : 'favorites')}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 spring-press relative ${
                  activeBottomTab === 'favorites'
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg scale-105 ring-2 ring-black/20 dark:ring-white/40'
                    : 'apple-btn-glass text-[#8E8E93] hover:text-amber-500 dark:hover:text-amber-400 border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/30 hover:scale-105'
                }`}
                title={activeBottomTab === 'favorites' ? 'Свернуть сохраненные' : 'Открыть сохраненные слова'}
              >
                <Star 
                  size={20} 
                  className={`sm:size-[22px] transition-transform group-hover:scale-110 ${activeBottomTab === 'favorites' ? 'text-amber-400' : ''}`}
                  fill={activeBottomTab === 'favorites' ? 'currentColor' : 'none'} 
                />
                {totalEntries > 0 && (
                  <span className={`absolute -top-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 min-w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${
                    activeBottomTab === 'favorites'
                      ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black'
                      : 'bg-black/10 dark:bg-white/20 text-neutral-800 dark:text-neutral-200'
                  }`}>
                    {totalEntries}
                  </span>
                )}
              </button>
              <span className={`text-xs font-medium tracking-tight select-none transition-colors ${
                activeBottomTab === 'favorites'
                  ? 'text-neutral-900 dark:text-white font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white'
              }`}>
                Сохраненные
              </span>
            </div>

          </div>

          {/* Action Toolbar & Panel (Rendered below circles when open) */}
          {activeBottomTab && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.08] animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                  {activeBottomTab === 'favorites' ? 'Сохраненные слова' : 'История переводов'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                  {activeBottomTab === 'favorites' ? totalEntries : recentHistory.length}
                </span>
              </div>

              {activeBottomTab === 'favorites' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Study Mode Button */}
                  {entries.length > 0 && (
                    <button
                      onClick={() => { setCurrentCardIndex(0); setIsCardFlipped(false); setFlashcardModal(true); }}
                      className="text-xs font-semibold apple-btn-primary px-3.5 sm:px-4 py-1.5 rounded-full flex items-center gap-1.5 spring-press"
                    >
                      <RotateCw size={13} /> Учить слова
                    </button>
                  )}

                  {/* View Mode Toggle */}
                  <div className="flex items-center apple-glass-pill p-1 rounded-full">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-full transition-all spring-press ${viewMode === 'list' ? 'apple-tab-active text-black dark:text-white' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                      title="Список"
                    >
                      <ListFilter size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-full transition-all spring-press ${viewMode === 'grid' ? 'apple-tab-active text-black dark:text-white' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                      title="Сетка"
                    >
                      <LayoutGrid size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className={`apple-icon-btn p-2 rounded-full text-xs font-semibold spring-press ${
                      showSearch 
                        ? 'apple-btn-primary !text-white' 
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                    }`}
                    title="Поиск"
                  >
                    <Search size={15} />
                  </button>

                  {categories.length > 0 && (
                    <div className="relative">
                      <select
                        value={filterCat}
                        onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
                        className="appearance-none apple-btn-glass text-xs font-semibold px-3 py-1.5 rounded-full focus:outline-none cursor-pointer pr-6 text-[#1C1C1E] dark:text-white"
                      >
                        <option value="" className="dark:bg-[#1C1C1E]">Все теги</option>
                        {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                      </select>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-[#8E8E93]">▾</span>
                    </div>
                  )}

                  <button
                    onClick={() => setNewCatModal(true)}
                    className="text-xs font-semibold text-black dark:text-white apple-btn-glass px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap spring-press"
                  >
                    + Тег
                  </button>

                  {/* CSV Export Button */}
                  {entries.length > 0 && (
                    <button
                      onClick={handleExportCsv}
                      className="text-xs font-semibold text-black dark:text-white apple-btn-glass px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap spring-press flex items-center gap-1.5"
                      title="Экспорт сохраненных слов в формате CSV (Excel, Anki)"
                    >
                      <Download size={13} /> Экспорт
                    </button>
                  )}

                  {/* Explicit Collapse button */}
                  <button
                    onClick={() => setActiveBottomTab(null)}
                    className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white spring-press"
                    title="Скрыть панель"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : activeBottomTab === 'history' ? (
                /* History controls */
                <div className="flex items-center gap-2">
                  {recentHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1.5 spring-press"
                      title="Очистить историю переводов"
                    >
                      <Trash2 size={13} />
                      <span>Очистить историю</span>
                    </button>
                  )}

                  {/* Explicit Collapse button */}
                  <button
                    onClick={() => setActiveBottomTab(null)}
                    className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white spring-press"
                    title="Скрыть панель"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 1: FAVORITES CONTENT */}
          {activeBottomTab === 'favorites' && (
            <>
              {/* Spotlight Search Bar */}
              {showSearch && (
                <div className="relative animate-in fade-in duration-200">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                  <input
                    type="text"
                    placeholder="Поиск по сохраненным карточкам..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-11 pr-4 py-3 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white"
                  />
                </div>
              )}

              {/* Favorites List / Grid */}
              <div className="ios-glass rounded-[32px] p-3 sm:p-4 space-y-3 shadow-md border border-black/[0.05] dark:border-white/[0.08]">
                {entries.length === 0 ? (
                  <div className="py-14 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mx-auto text-[#8E8E93]">
                      <Star size={22} />
                    </div>
                    <p className="text-sm font-semibold text-[#1C1C1E] dark:text-white">
                      {user ? "Нет слов в Favorites" : "Войдите в аккаунт"}
                    </p>
                    <p className="text-xs text-[#8E8E93] max-w-xs mx-auto">
                      {user ? "Нажмите звездочку на карточке перевода, чтобы добавить слово в словарь." : "Авторизуйтесь для синхронизации слов между устройствами."}
                    </p>
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="space-y-2">
                    {entries.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] px-5 py-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3 group transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04] hover-lift neon-border-hover overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0 sm:max-w-[48%] overflow-hidden flex-shrink-0 sm:flex-shrink">
                            <span className="font-bold text-sm sm:text-base text-[#1C1C1E] dark:text-white truncate tracking-tight min-w-0">
                              {item.source_text}
                            </span>
                            {item.category_name && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: item.category_color || '#71717A' }}
                              >
                                {item.category_name}
                              </span>
                            )}
                          </div>
                          <span className="hidden sm:inline text-[#8E8E93] font-light flex-shrink-0">→</span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <span className="font-semibold text-sm sm:text-base text-black dark:text-white truncate tracking-tight block">
                              {item.translated_text}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => speak(item.translated_text, item.target_lang, true)}
                            className="apple-icon-btn text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-2 rounded-full"
                            title="Озвучить"
                          >
                            <Volume2 size={16} />
                          </button>
                          <button
                            onClick={() => setEditingEntry(item)}
                            className="apple-icon-btn text-[#8E8E93] hover:text-black dark:text-white p-2 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Редактировать"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => deleteFavorite(item.id)}
                            className="apple-icon-btn text-amber-500 hover:text-rose-500 p-2 rounded-full"
                            title="Удалить из Favorites"
                          >
                            <Star size={17} fill="currentColor" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entries.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] p-5 rounded-[24px] shadow-sm flex flex-col justify-between transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04] relative group hover-lift neon-border-hover"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            {item.category_name ? (
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white shadow-sm"
                                style={{ backgroundColor: item.category_color || '#71717A' }}
                              >
                                {item.category_name}
                              </span>
                            ) : <span />}
                            <button
                              onClick={() => deleteFavorite(item.id)}
                              className="apple-icon-btn text-amber-500 hover:text-rose-500 p-1.5 rounded-full"
                              title="Удалить из Favorites"
                            >
                              <Star size={16} fill="currentColor" />
                            </button>
                          </div>
                          <p className="font-bold text-lg text-[#1C1C1E] dark:text-white tracking-tight">
                            {item.source_text}
                          </p>
                          <p className="font-medium text-sm text-[#8E8E93] dark:text-[#AEAEB2] mt-1">
                            {item.translated_text}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 mt-2 border-t border-black/[0.03] dark:border-white/[0.04]">
                          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase">
                            {item.source_lang} → {item.target_lang}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => speak(item.translated_text, item.target_lang, true)}
                              className="apple-icon-btn text-[#8E8E93] hover:text-black dark:text-white p-1.5 rounded-full"
                              title="Озвучить"
                            >
                              <Volume2 size={16} />
                            </button>
                            <button
                              onClick={() => setEditingEntry(item)}
                              className="apple-icon-btn text-[#8E8E93] hover:text-black dark:text-white p-1.5 rounded-full"
                              title="Редактировать"
                            >
                              <Edit3 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 py-3 text-xs font-semibold text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06]">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="apple-btn-glass rounded-full px-3 py-1 hover:text-black dark:text-white disabled:opacity-20 transition-all">← Назад</button>
                    <span className="apple-glass-pill px-3 py-1 rounded-full text-xs font-semibold">{page} из {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="apple-btn-glass rounded-full px-3 py-1 hover:text-black dark:text-white disabled:opacity-20 transition-all">Вперед →</button>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!user) { setAuthModal('login'); return; }
                    setManualModal(true);
                  }}
                  className="w-full py-3 text-center text-xs font-semibold text-black dark:text-white apple-btn-glass rounded-2xl transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusCircle size={14} />
                  Добавить карточку вручную
                </button>
              </div>
            </>
          )}

          {/* TAB 2: RECENT HISTORY CONTENT */}
          {activeBottomTab === 'history' && (
            <div className="ios-glass rounded-[32px] p-3 sm:p-4 space-y-3 shadow-md border border-black/[0.05] dark:border-white/[0.08]">
              {recentHistory.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center mx-auto text-[#8E8E93]">
                    <History size={22} />
                  </div>
                  <p className="text-sm font-semibold text-[#1C1C1E] dark:text-white">
                    История переводов пуста
                  </p>
                  <p className="text-xs text-[#8E8E93] max-w-xs mx-auto">
                    Каждый новый перевод автоматически сохраняется здесь, чтобы вы могли вернуться к нему в один клик.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] p-4 sm:p-5 rounded-2xl shadow-sm transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04] hover-lift neon-border-hover space-y-3"
                    >
                      {/* Header of history card: Language pill + Timestamp + Action buttons */}
                      <div className="flex items-center justify-between gap-2 border-b border-black/[0.04] dark:border-white/[0.04] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="mono-label text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/15">
                            {item.source_lang} → {item.target_lang}
                          </span>
                          {item.timestamp && (
                            <span className="text-[10px] text-[#8E8E93]">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => speak(item.translated_text || item.source_text, item.target_lang, true)}
                            className="apple-icon-btn spring-press text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"
                            title="Озвучить перевод"
                          >
                            <Volume2 size={15} />
                          </button>
                          <button
                            onClick={() => restoreFromHistory(item)}
                            className="apple-btn-glass spring-press text-xs font-semibold px-3 py-1 rounded-full text-black dark:text-white hover:scale-105 transition-all flex items-center gap-1"
                            title="Восстановить в карточки"
                          >
                            <RotateCw size={12} />
                            <span>Открыть</span>
                          </button>
                        </div>
                      </div>

                      {/* Content of history card: Stretches vertically, wraps all words cleanly, adapts to window */}
                      <div 
                        onClick={() => restoreFromHistory(item)}
                        className="cursor-pointer space-y-2 group"
                        title="Нажмите, чтобы открыть этот перевод в редакторе"
                      >
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-0.5">Исходный текст</p>
                          <p className="font-bold text-sm sm:text-base text-[#1C1C1E] dark:text-white tracking-tight break-words whitespace-pre-wrap leading-relaxed">
                            {item.source_text}
                          </p>
                        </div>

                        {item.translated_text && (
                          <div className="pt-2 border-t border-black/[0.03] dark:border-white/[0.04]">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-0.5">Перевод</p>
                            <p className="font-semibold text-sm sm:text-base text-black/90 dark:text-white/90 tracking-tight break-words whitespace-pre-wrap leading-relaxed">
                              {item.translated_text}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </section>

      </main>

      {/* ================= URL TRANSLATION MODAL ================= */}
      {urlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 w-full max-w-lg border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-3.5 mb-3.5 sm:mb-4 border-b border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-black dark:text-white" />
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                  Перевод веб-страницы
                </h3>
              </div>
              <button 
                onClick={() => setUrlModal(false)} 
                className="apple-icon-btn text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-3.5 sm:mb-4">
              <p className="text-[11px] sm:text-xs text-[#8E8E93]">
                Извлечение и перевод основного текста веб-страницы без рекламы
              </p>
            </div>

            {urlError && (
              <div className="p-3 mb-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20 animate-in fade-in">
                {urlError}
              </div>
            )}

            <form onSubmit={handleUrlExtract} className="space-y-3.5 sm:space-y-4">
              {/* Safari Smart Search Address Bar */}
              <div className="relative flex items-center apple-glass-input rounded-2xl px-3 sm:px-3.5 py-2.5 transition-all">
                <Lock size={14} className="text-[#8E8E93] mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="text-xs font-mono text-[#8E8E93] mr-1 select-none">https://</span>
                <input
                  type="text"
                  required
                  placeholder="en.wikipedia.org/wiki/..."
                  value={inputUrl.replace(/^https?:\/\//, '')}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setInputUrl(val.startsWith('http') ? val : `https://${val}`);
                  }}
                  className="w-full bg-transparent text-sm sm:text-xs font-mono font-medium focus:outline-none text-[#1C1C1E] dark:text-white"
                />
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => setInputUrl('')}
                    className="apple-icon-btn text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 ml-1"
                  >
                    <X size={12} />
                  </button>
                )}
                <div className="ml-2 pl-2 border-l border-black/[0.08] dark:border-white/[0.1] text-black dark:text-white font-bold text-[11px] select-none">
                  aA
                </div>
              </div>

              {/* Bookmarks / Speed Dial Grid */}
              <div>
                <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-2">Примеры сайтов:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {URL_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInputUrl(p.url)}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        inputUrl === p.url 
                          ? 'border-black dark:border-white bg-black/5 dark:bg-white/10 text-neutral-900 dark:text-white' 
                          : 'apple-btn-glass text-[#8E8E93] hover:text-neutral-900 dark:hover:text-white border-black/[0.06] dark:border-white/[0.08]'
                      }`}
                    >
                      <Globe size={16} className="mt-0.5 flex-shrink-0 text-black dark:text-white" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold block text-[#1C1C1E] dark:text-white truncate">{p.label}</span>
                        <span className="text-[10px] text-[#8E8E93] block truncate">{p.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isUrlLoading || !inputUrl.trim()}
                className="w-full apple-btn-primary font-semibold py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUrlLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Загрузка и очистка статьи...</span>
                  </>
                ) : (
                  <>
                    <BookOpen size={15} />
                    <span>Извлечь и перевести</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= FLASHCARDS STUDY MODAL ================= */}
      {flashcardModal && currentFlashcard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between text-white px-2">
              <span className="text-xs font-bold tracking-wider uppercase opacity-80">
                Карточка {currentCardIndex + 1} из {entries.length}
              </span>
              <button 
                onClick={() => setFlashcardModal(false)} 
                className="apple-icon-btn p-1.5 rounded-full text-[#1C1C1E] dark:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3D Flip Card */}
            <div 
              onClick={() => setIsCardFlipped(!isCardFlipped)}
              className="perspective-1000 w-full h-64 sm:h-72 cursor-pointer select-none"
            >
              <div className={`w-full h-full duration-500 transform-style-3d relative transition-transform ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front Side */}
                <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 w-full h-full flex flex-col justify-between absolute inset-0 backface-hidden shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white uppercase tracking-wider">
                      Оригинал ({currentFlashcard.source_lang})
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(currentFlashcard.source_text, currentFlashcard.source_lang); }}
                      className="apple-icon-btn p-2 rounded-full"
                    >
                      <Volume2 size={18} className="text-[#8E8E93]" />
                    </button>
                  </div>

                  <div className="text-center py-2 sm:py-4">
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1C1C1E] dark:text-white break-words">
                      {currentFlashcard.source_text}
                    </p>
                  </div>

                  <p className="text-center text-xs text-[#8E8E93] font-medium">
                    Нажмите, чтобы перевернуть карточку ↺
                  </p>
                </div>

                {/* Back Side */}
                <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 w-full h-full flex flex-col justify-between absolute inset-0 backface-hidden rotate-y-180 shadow-2xl border-2 black/10 dark:border-white/15">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Перевод ({currentFlashcard.target_lang})
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(currentFlashcard.translated_text, currentFlashcard.target_lang, true); }}
                      className="apple-icon-btn p-2 rounded-full"
                    >
                      <Volume2 size={18} className="text-[#8E8E93]" />
                    </button>
                  </div>

                  <div className="text-center py-2 sm:py-4">
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black dark:text-white break-words">
                      {currentFlashcard.translated_text}
                    </p>
                    {currentFlashcard.notes && (
                      <p className="text-xs text-[#8E8E93] mt-2 italic">"{currentFlashcard.notes}"</p>
                    )}
                  </div>

                  <div className="flex justify-center">
                    {currentFlashcard.category_name && (
                      <span
                        className="text-[10px] font-bold px-3 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: currentFlashcard.category_color || '#71717A' }}
                      >
                        {currentFlashcard.category_name}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Flashcard Controls */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                disabled={currentCardIndex <= 0}
                onClick={() => { setCurrentCardIndex(i => i - 1); setIsCardFlipped(false); }}
                className="apple-btn-glass flex-1 py-3 sm:py-3.5 rounded-2xl font-semibold text-xs sm:text-sm disabled:opacity-30 flex items-center justify-center gap-1 text-[#1C1C1E] dark:text-white transition-all"
              >
                <ChevronLeft size={16} /> Назад
              </button>
              <button
                onClick={() => {
                  if (currentCardIndex < entries.length - 1) {
                    setCurrentCardIndex(i => i + 1);
                    setIsCardFlipped(false);
                  } else {
                    setFlashcardModal(false);
                  }
                }}
                className="apple-btn-primary flex-1 py-3 sm:py-3.5 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all"
              >
                {currentCardIndex < entries.length - 1 ? 'Дальше' : 'Завершить'} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Auth Modal */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm">
            {/* Ambient modal spotlight glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-black dark:from-white/25 via-slate-400/10 to-transparent rounded-[44px] blur-2xl pointer-events-none opacity-80" />

            <div className="relative ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full border border-black/10 dark:border-white/10 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
              <button 
                onClick={() => setAuthModal(null)} 
                className="apple-icon-btn spring-press absolute right-3.5 top-3.5 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-2 rounded-full w-9 h-9 flex items-center justify-center"
                title="Закрыть"
              >
                <X size={18} />
              </button>
              
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 text-[#1C1C1E] dark:text-white tracking-tight-premium">
                {authModal === 'login' ? 'Вход в аккаунт' : authModal === 'register' ? 'Регистрация' : authModal === 'forgot_password' ? 'Сброс пароля' : 'Google Authenticator'}
              </h3>
            <p className="text-xs text-[#8E8E93] mb-4 sm:mb-5">
              {authModal === 'login' 
                ? 'Войдите для доступа к персональному словарю' 
                : authModal === 'register' 
                  ? 'Создайте бесплатный аккаунт Flow Translate' 
                  : authModal === 'forgot_password'
                    ? 'Введите email, код из Google Authenticator и новый пароль'
                    : 'Двухфакторное подтверждение регистрации'}
            </p>

            {authError && <div className="p-3 mb-4 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20">{authError}</div>}
            {authSuccess && <div className="p-3 mb-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">{authSuccess}</div>}

            <form onSubmit={handleAuth} noValidate className="space-y-3.5">
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input 
                      type="email" 
                      required 
                      value={authEmail} 
                      onChange={e => setAuthEmail(e.target.value)} 
                      className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-base sm:text-sm focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="user@gmail.com" 
                    />
                  </div>
                </div>
              )}

              {authModal === 'forgot_password' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
                    Код из Google Authenticator (6 цифр)
                  </label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input 
                      type="text" 
                      maxLength={6} 
                      pattern="[0-9]*"
                      inputMode="numeric"
                      required 
                      value={verifyCode} 
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))} 
                      className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-base sm:text-sm tracking-widest font-mono font-bold focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="123456" 
                    />
                  </div>
                </div>
              )}

              {authModal !== 'verify' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                      {authModal === 'register' ? 'Пароль (минимум 6 символов)' : authModal === 'forgot_password' ? 'Новый пароль (минимум 6 символов)' : 'Пароль'}
                    </label>
                    {authModal === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => { 
                          setAuthModal('forgot_password'); 
                          setAuthError(''); 
                          setAuthSuccess(''); 
                          setAuthPassword(''); 
                          setAuthPasswordConfirm(''); 
                          setVerifyCode(''); 
                        }} 
                        className="text-[11px] font-semibold text-black dark:text-white hover:underline cursor-pointer"
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input 
                      type="password" 
                      required 
                      value={authPassword} 
                      onChange={e => setAuthPassword(e.target.value)} 
                      className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-base sm:text-sm focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              )}
              {(authModal === 'register' || authModal === 'forgot_password') && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
                    {authModal === 'forgot_password' ? 'Повтор нового пароля' : 'Повтор пароля'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input 
                      type="password" 
                      required 
                      value={authPasswordConfirm} 
                      onChange={e => setAuthPasswordConfirm(e.target.value)} 
                      className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-base sm:text-sm focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              )}

              {authModal === 'verify' && (
                <div className="space-y-3.5 text-center">
                  {qrCodeUrl && (
                    <div className="bg-white p-3 rounded-2xl inline-block border border-black/[0.08] shadow-md mx-auto">
                      <img src={qrCodeUrl} alt="Google Authenticator QR Code" className="w-44 h-44 mx-auto rounded-xl select-none" />
                    </div>
                  )}

                  {totpSecret && (
                    <div className="text-left space-y-1 bg-black/[0.03] dark:bg-white/[0.04] p-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Ключ для ручного ввода</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(totpSecret);
                            setIsCopiedSecret(true);
                            setTimeout(() => setIsCopiedSecret(false), 2000);
                          }}
                          className="text-[10px] font-bold text-black dark:text-white flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          {isCopiedSecret ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          {isCopiedSecret ? 'Скопировано!' : 'Копировать'}
                        </button>
                      </div>
                      <code className="text-xs font-mono font-bold text-[#1C1C1E] dark:text-white block truncate select-all">
                        {totpSecret}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    Отсканируйте QR-код в <b>Google Authenticator</b> и введите 6-значный код:
                  </p>

                  <div>
                    <input 
                      type="text" 
                      maxLength={6} 
                      pattern="[0-9]*"
                      inputMode="numeric"
                      autoFocus
                      required 
                      value={verifyCode} 
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))} 
                      className="w-full py-3 apple-glass-input rounded-2xl text-center font-bold text-2xl tracking-[0.4em] focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="000000" 
                    />
                  </div>

                  {demoCode && (
                    <div className="pt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-[#8E8E93]">
                      <span>Код для быстрой проверки:</span>
                      <button
                        type="button"
                        onClick={() => setVerifyCode(demoCode)}
                        className="font-mono font-bold text-black dark:text-white hover:underline cursor-pointer"
                        title="Нажмите, чтобы автоматически вставить код"
                      >
                        {demoCode}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {authError && (
                <div className="p-3 my-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20 text-center animate-in fade-in">
                  <p>{authError}</p>
                  {authError.includes('уже зарегистрирован') && (
                    <button
                      type="button"
                      onClick={() => { setAuthModal('login'); setAuthError(''); setAuthSuccess('Введите ваш пароль для входа'); }}
                      className="mt-2 inline-block px-3 py-1 rounded-xl bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold transition-all cursor-pointer spring-press"
                    >
                      Перейти ко входу →
                    </button>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full apple-btn-primary spring-press glow-card font-semibold py-3 rounded-2xl text-sm mt-3 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {authLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>
                      {authModal === 'login' 
                        ? 'Вход...' 
                        : authModal === 'register' 
                          ? 'Создание аккаунта...' 
                          : authModal === 'forgot_password'
                            ? 'Сброс пароля...'
                            : 'Проверка кода...'}
                    </span>
                  </>
                ) : (
                  authModal === 'login' 
                    ? 'Войти' 
                    : authModal === 'register' 
                      ? 'Создать аккаунт' 
                      : authModal === 'forgot_password'
                        ? 'Сбросить пароль и войти'
                        : 'Подтвердить и войти'
                )}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-[#8E8E93]">
              {authModal === 'login' ? (
                <span>Нет аккаунта? <button type="button" onClick={() => { setAuthModal('register'); setAuthError(''); setAuthSuccess(''); }} className="font-semibold text-black dark:text-white hover:underline spring-press">Регистрация</button></span>
              ) : authModal === 'register' ? (
                <span>Уже есть аккаунт? <button type="button" onClick={() => { setAuthModal('login'); setAuthError(''); setAuthSuccess(''); }} className="font-semibold text-black dark:text-white hover:underline spring-press">Войти</button></span>
              ) : (
                <button type="button" onClick={() => { setAuthModal('login'); setAuthError(''); setAuthSuccess(''); }} className="font-semibold text-black dark:text-white hover:underline spring-press">← Вернуться ко входу</button>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {manualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setManualModal(false)} className="apple-icon-btn absolute right-4 top-4 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"><X size={16} /></button>
            <h3 className="text-base sm:text-lg font-bold tracking-tight mb-3.5 text-[#1C1C1E] dark:text-white">Новая карточка словаря</h3>
            <form onSubmit={handleManualAdd} className="space-y-3 sm:space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Слово / Оригинал</label>
                <input type="text" required value={manualForm.source_text} onChange={e => setManualForm({...manualForm, source_text: e.target.value})} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Перевод</label>
                <input type="text" required value={manualForm.translated_text} onChange={e => setManualForm({...manualForm, translated_text: e.target.value})} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Категория</label>
                <select value={manualForm.category_id} onChange={e => setManualForm({...manualForm, category_id: e.target.value})} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white">
                  <option value="" className="dark:bg-[#1C1C1E]">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full apple-btn-primary font-semibold py-3 rounded-2xl text-sm mt-2 spring-press">
                Сохранить карточку
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-xs border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setNewCatModal(false)} className="apple-icon-btn absolute right-4 top-4 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"><X size={16} /></button>
            <h3 className="text-base sm:text-lg font-bold tracking-tight mb-3.5 text-[#1C1C1E] dark:text-white">Новый тег</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 sm:space-y-3.5">
              <input type="text" required placeholder="Например: Работа" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" />
              <div className="flex items-center gap-3 apple-btn-glass p-2 rounded-2xl">
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-8 w-10 border-none bg-transparent cursor-pointer rounded-lg" />
                <span className="text-xs font-mono font-semibold text-[#8E8E93]">{newCatColor}</span>
              </div>
              <button type="submit" className="w-full apple-btn-primary font-semibold py-3 rounded-2xl text-sm mt-2">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setEditingEntry(null)} className="apple-icon-btn absolute right-4 top-4 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"><X size={16} /></button>
            <h3 className="text-base sm:text-lg font-bold tracking-tight mb-1 text-[#1C1C1E] dark:text-white">Редактировать</h3>
            <p className="text-xs text-[#8E8E93] mb-3.5">Оригинал: <span className="font-semibold text-[#1C1C1E] dark:text-white">{editingEntry.source_text}</span></p>
            <form onSubmit={handleEditEntry} className="space-y-3 sm:space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Перевод</label>
                <input type="text" required value={editingEntry.translated_text} onChange={e => setEditingEntry({...editingEntry, translated_text: e.target.value})} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Категория</label>
                <select value={editingEntry.category_id || ''} onChange={e => setEditingEntry({...editingEntry, category_id: e.target.value || null})} className="w-full px-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white">
                  <option value="" className="dark:bg-[#1C1C1E]">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full apple-btn-primary font-semibold py-3 rounded-2xl text-sm mt-2">
                Сохранить изменения
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {shortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-md border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShortcutsModal(false)} className="apple-icon-btn absolute right-4 top-4 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"><X size={16} /></button>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-black dark:text-white">
                <Keyboard size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">Горячие клавиши</h3>
                <p className="text-[11px] text-[#8E8E93]">Быстрое управление Flow Translate с клавиатуры</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[#1C1C1E] dark:text-white font-medium">Мгновенный перевод</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Ctrl</kbd>
                  <span className="text-[#8E8E93]">+</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Enter</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[#1C1C1E] dark:text-white font-medium">Сменить языки местами (Swap)</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Ctrl</kbd>
                  <span className="text-[#8E8E93]">+</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Shift</kbd>
                  <span className="text-[#8E8E93]">+</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">S</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[#1C1C1E] dark:text-white font-medium">Закрыть активное окно</span>
                <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Esc</kbd>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[#1C1C1E] dark:text-white font-medium">Вставка скриншота из буфера (OCR)</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Ctrl</kbd>
                  <span className="text-[#8E8E93]">+</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">V</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-[#1C1C1E] dark:text-white font-medium">Открыть / скрыть горячие клавиши</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">Ctrl</kbd>
                  <span className="text-[#8E8E93]">+</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[11px] font-mono font-bold text-black dark:text-white">/</kbd>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShortcutsModal(false)}
              className="w-full apple-btn-primary font-semibold py-2.5 rounded-2xl text-xs mt-4 spring-press"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

    </div>
  );
}