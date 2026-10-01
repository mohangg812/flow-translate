import React, { useState, useEffect, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';
import api from './api';
import { 
  Volume2, Star, Edit3, Search, LogOut, 
  ArrowRightLeft, X, Shield, RefreshCw, Check, Sun, Moon, Copy,
  Sparkles, Languages, PlusCircle, CheckCircle2,
  Lock, Mail, LayoutGrid, ListFilter, RotateCw, ChevronLeft, ChevronRight,
  Camera, FileText, Globe, Download, UploadCloud,
  FileCheck, ExternalLink, Loader2, ArrowUpRight, Scan, BookOpen, Compass, Bookmark,
  Mic, MicOff, MessageSquare, History, SlidersHorizontal, Trash2
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

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('flow_theme') || 'dark');
  const [user, setUser] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [isInDictionary, setIsInDictionary] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  // Mode State: 'text' | 'image' | 'doc' | 'url' | 'dialogue'
  const [activeMode, setActiveMode] = useState('text');
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

  // AI & Smart Linguistics State (DeepL & Reverso style)
  const [tone, setTone] = useState('neutral'); // 'neutral' | 'formal' | 'informal'
  const [alternatives, setAlternatives] = useState([]);
  const [examples, setExamples] = useState([]);

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

  // Admin state
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  // Mouse spotlight position
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const translateAbortRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  const sourceTextareaRef = useRef(null);
  const debouncedSearch = useDebounce(search, 400);

  // Auto-resize input textarea to dynamically stretch with content
  const adjustTextareaHeight = useCallback(() => {
    const el = sourceTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    requestAnimationFrame(adjustTextareaHeight);
  }, [sourceText, activeMode, adjustTextareaHeight]);

  // Client-side Robust Translation Helper (Handles long text > 500 chars via smart chunking)
  const robustTranslateClient = async (inputText, srcLang, tgtLang, signal) => {
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
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // OCR Processing Function via Tesseract.js (Apple Live Text / Google Lens)
  const processImageFile = useCallback(async (file) => {
    if (!file) return;
    setIsOcrProcessing(true);
    setOcrProgress(0);
    setOcrStatusText('Подготовка изображения...');
    setActiveMode('image');

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);

    try {
      const langMap = { en: 'eng', ru: 'rus', de: 'deu', es: 'spa', auto: 'eng+rus+deu+spa' };
      const ocrLang = langMap[sourceLang] || 'eng+rus';

      setOcrStatusText('Инициализация нейросети...');
      const { data: { text } } = await Tesseract.recognize(
        file,
        ocrLang,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const p = Math.round(m.progress * 100);
              setOcrProgress(p);
              setOcrStatusText(`Распознавание текста: ${p}%`);
            }
          }
        }
      );

      const cleanText = text.replace(/\n\s*\n/g, '\n').trim();
      if (cleanText) {
        setSourceText(cleanText.slice(0, 2000));
        setLoadedFile({ name: file.name || 'Снимок экрана', size: (file.size / 1024).toFixed(1) + ' KB', type: 'image' });
      } else {
        alert('Текст на изображении не обнаружен. Попробуйте более четкое фото.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Ошибка при распознавании изображения.');
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  }, [sourceLang, imagePreviewUrl]);

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
      if (detected) {
        setDetectedLang(detected);
        if (detected === targetLang) {
          setTargetLang(detected === 'ru' ? 'en' : 'ru');
        }
      }
    }
  }, [sourceText, sourceLang, targetLang]);

  // Translation Effect
  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setTranslatedText('');
      setAlternatives([]);
      setExamples([]);
      setIsInDictionary(false);
      setSavedEntryId(null);
      return;
    }

    const effectiveSource = sourceLang === 'auto'
      ? (detectLanguage(text) || detectedLang || 'en')
      : sourceLang;

    if (effectiveSource === targetLang) {
      setTranslatedText(text);
      setAlternatives([]);
      setExamples([]);
      setIsTranslating(false);
      return;
    }

    const timer = setTimeout(async () => {
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
          setTranslatedText(resData.translated_text);
          setAlternatives(resData.alternatives || []);
          setExamples(resData.examples || []);
          setIsInDictionary(resData.is_saved_in_dictionary || false);
          setSavedEntryId(resData.saved_entry_id || null);
          addToHistory(text, resData.translated_text, effectiveSource, targetLang);
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Translation error:', err);
        }
      } finally {
        setIsTranslating(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang, detectedLang, tone]);

  const swapLanguages = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 300);
    const effectiveSource = sourceLang === 'auto' ? detectedLang : sourceLang;
    setSourceLang(targetLang);
    setTargetLang(effectiveSource);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
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
        
        {/* Dynamic Cursor Spotlight */}
        <div 
          className="absolute inset-0 transition-opacity duration-300 opacity-60 dark:opacity-40"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'}, transparent 65%)`
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

        {/* Dynamic Activity Capsule (Only visible during active background operations) */}
        {(isOcrProcessing || isTranslating || isSpeakingSource || isSpeakingTarget) && (
          <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="ios-glass px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2.5 shadow-sm border border-black/[0.06] dark:border-white/[0.08] text-[11px] sm:text-xs font-medium max-w-full truncate">
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

                {/* MODE: IMAGE (Apple Live Text / Google Lens Viewfinder) */}
                {activeMode === 'image' && (
                  <div className="space-y-2.5 sm:space-y-3 mb-2">
                    {imagePreviewUrl ? (
                      <div className="relative rounded-2xl overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 p-2 flex items-center justify-center max-h-44 sm:max-h-52">
                        {/* 4 Apple Camera Viewfinder Corner Brackets */}
                        <span className="viewfinder-bracket top-2 left-2 border-t-2 border-l-2 rounded-tl" />
                        <span className="viewfinder-bracket top-2 right-2 border-t-2 border-r-2 rounded-tr" />
                        <span className="viewfinder-bracket bottom-2 left-2 border-b-2 border-l-2 rounded-bl" />
                        <span className="viewfinder-bracket bottom-2 right-2 border-b-2 border-r-2 rounded-br" />

                        {/* Laser Scan Beam */}
                        {isOcrProcessing && <div className="animate-scan-beam" />}

                        <img 
                          src={imagePreviewUrl} 
                          alt="OCR Scan" 
                          className={`max-h-40 sm:max-h-48 rounded-xl object-contain transition-all duration-300 ${isOcrProcessing ? 'opacity-70 blur-[1px]' : ''}`} 
                        />

                        {isOcrProcessing && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-2 text-center">
                            <div className="flex items-center gap-2 bg-black/70 px-3.5 py-1.5 rounded-full border border-white/20 shadow-lg">
                              <Loader2 size={16} className="animate-spin text-black dark:text-white" />
                              <span className="text-xs font-semibold truncate">{ocrStatusText || 'Нейросеть считывает...'}</span>
                            </div>
                          </div>
                        )}

                        {!isOcrProcessing && (
                          <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/15 shadow-sm">
                            Распознанный текст
                          </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="relative rounded-2xl border border-dashed border-black/15 dark:border-white/15 hover:border-black/40 dark:hover:border-white/40 p-5 sm:p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] group active:scale-[0.99]"
                      >
                        <span className="viewfinder-bracket top-2.5 left-2.5 border-t-2 border-l-2 rounded-tl border-black/30 dark:border-white/30 group-hover:border-black dark:group-hover:border-white" />
                        <span className="viewfinder-bracket top-2.5 right-2.5 border-t-2 border-r-2 rounded-tr border-black/30 dark:border-white/30 group-hover:border-black dark:group-hover:border-white" />
                        <span className="viewfinder-bracket bottom-2.5 left-2.5 border-b-2 border-l-2 rounded-bl border-black/30 dark:border-white/30 group-hover:border-black dark:group-hover:border-white" />
                        <span className="viewfinder-bracket bottom-2.5 right-2.5 border-b-2 border-r-2 rounded-br border-black/30 dark:border-white/30 group-hover:border-black dark:group-hover:border-white" />

                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black/5 dark:bg-white/10 text-black dark:text-white flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                          <Camera size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Распознавание текста с фото
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2.5 leading-relaxed">
                          <span className="sm:hidden">Нажмите, чтобы сделать фото или выбрать из медиатеки</span>
                          <span className="hidden sm:inline">Перетащите изображение сюда или выберите файл на устройстве</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] sm:text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93] dark:text-[#A1A1AA]">
                            JPG · PNG · WEBP · Скриншоты
                          </span>
                        </div>
                      </div>
                    )}

                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceText}
                      onChange={(e) => { setSourceText(e.target.value); adjustTextareaHeight(); }}
                      placeholder="Распознанный текст появится здесь..."
                      maxLength={2000}
                      style={{ minHeight: '130px' }}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white overflow-hidden"
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
                      onChange={(e) => { setSourceText(e.target.value); adjustTextareaHeight(); }}
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
                      onChange={(e) => { setSourceText(e.target.value); adjustTextareaHeight(); }}
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
                    onChange={(e) => { setSourceText(e.target.value); adjustTextareaHeight(); }}
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

                <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1.5">
                  {isTranslating ? (
                    <span className="flex items-center gap-1.5 text-black dark:text-white">
                      <RefreshCw size={12} className="animate-spin" />
                      Перевод...
                    </span>
                  ) : (
                    <span className="text-[#8E8E93]/70">Авто</span>
                  )}
                </span>
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

                {isTranslating ? (
                  <div className="flex items-center gap-3 py-6 text-[#8E8E93]">
                    <div className="w-5 h-5 rounded-full border-2 border-black dark:border-white border-t-transparent animate-spin" />
                    <span className="text-base sm:text-lg font-medium text-[#8E8E93]">Переводим текст...</span>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1C1C1E] dark:text-white select-text leading-snug tracking-tight break-words whitespace-pre-wrap">
                      {translatedText || <span className="text-[#8E8E93] dark:text-[#5F6368] font-normal">Перевод</span>}
                    </h3>
                  </div>
                )}
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

    </div>
  );
}