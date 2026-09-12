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
  { code: 'auto', label: 'Автоопределение', flag: '✨' },
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
  { label: 'Wikipedia', domain: 'wikipedia.org', icon: '🌐', desc: 'Искусственный интеллект', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
  { label: 'TechCrunch', domain: 'techcrunch.com', icon: '⚡', desc: 'Стартапы и технологии', url: 'https://techcrunch.com' },
  { label: 'BBC News', domain: 'bbc.com', icon: '📰', desc: 'Мировые события', url: 'https://www.bbc.com/news' },
  { label: 'The Verge', domain: 'theverge.com', icon: '💻', desc: 'Обзоры гаджетов и софта', url: 'https://www.theverge.com' },
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
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

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

  // Bottom Tabs: 'favorites' | 'history'
  const [activeBottomTab, setActiveBottomTab] = useState('favorites');
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
  const [newCatColor, setNewCatColor] = useState('#0071E3');

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
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
  }, [sourceLang]);

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
            const pair = `${speakLang}|${targetTransLang}`;
            const fb = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(spokenText)}&langpair=${pair}`);
            const fbJson = await fb.json();
            const raw = fbJson?.responseData?.translatedText;
            if (raw) {
              const doc = new DOMParser().parseFromString(raw, 'text/html');
              transResult = doc.body.textContent || raw;
            }
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

  // OCR Processing Function via Tesseract.js (Apple Live Text / Google Lens)
  const processImageFile = async (file) => {
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
        setSourceText(cleanText);
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
        setSourceText(text.slice(0, 3000));
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
          const extracted = matches.map(m => m.replace(/[\(\)\[\]]|Tj|TJ/g, '').trim()).join(' ');
          setSourceText(extracted.slice(0, 3000));
        } else {
          // Fallback: search for readable chunks
          const chunks = content.match(/[A-Za-zА-Яа-я0-9\s.,!?-]{20,}/g);
          setSourceText(chunks ? chunks.slice(0, 5).join('\n\n').slice(0, 3000) : 'Не удалось автоматически извлечь текст из PDF.');
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
          const pair = `${effectiveSource}|${targetLang}`;
          const fallbackRes = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`,
            { signal: controller.signal }
          );
          const fallbackJson = await fallbackRes.json();
          const raw = fallbackJson?.responseData?.translatedText;
          if (raw) {
            const doc = new DOMParser().parseFromString(raw, 'text/html');
            const mainTrans = doc.body.textContent || raw;

            // Extract alternatives from matches
            const rawMatches = fallbackJson?.matches || [];
            const alts = [];
            const seen = new Set([mainTrans.toLowerCase().trim()]);
            for (const m of rawMatches) {
              const d = new DOMParser().parseFromString(m.translation || '', 'text/html');
              const t = (d.body.textContent || m.translation || '').trim();
              if (t && !seen.has(t.toLowerCase()) && !t.toLowerCase().includes('mymemory') && !t.toLowerCase().includes('translated by')) {
                seen.add(t.toLowerCase());
                alts.push(t);
                if (alts.length >= 4) break;
              }
            }

            resData = {
              translated_text: mainTrans,
              alternatives: alts,
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
    try {
      if (authModal === 'login') {
        const res = await api.post('/auth/login', { email: authEmail, password: authPassword });
        localStorage.setItem('flow_token', res.data.access_token);
        setUser(res.data.user);
        setAuthModal(null);
        setAuthPassword('');
      } else if (authModal === 'register') {
        const res = await api.post('/auth/register', {
          email: authEmail,
          password: authPassword,
          password_confirm: authPasswordConfirm,
        });
        setQrCodeUrl(res.data.qr_code_url || '');
        setAuthSuccess('Отсканируйте QR-код в приложении Google Authenticator:');
        setAuthModal('verify');
      } else if (authModal === 'verify') {
        await api.post('/auth/verify-code', { email: authEmail, code: verifyCode });
        const loginRes = await api.post('/auth/login', { email: authEmail, password: authPassword });
        localStorage.setItem('flow_token', loginRes.data.access_token);
        setUser(loginRes.data.user);
        setAuthModal(null);
        setVerifyCode('');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка входа');
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

  useEffect(() => {
    if (showAdmin && user?.role === 'admin') loadAdminData();
  }, [showAdmin, user]);

  const activeSourceLang = SOURCE_LANGUAGES.find(l => l.code === sourceLang) || SOURCE_LANGUAGES[0];
  const detectedLangObj = TARGET_LANGUAGES.find(l => l.code === detectedLang) || TARGET_LANGUAGES[0];
  const activeTargetLang = TARGET_LANGUAGES.find(l => l.code === targetLang) || TARGET_LANGUAGES[1];
  const currentFlashcard = entries[currentCardIndex];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#E8EEFF] via-[#F3F4F8] to-[#FCE7F3] dark:bg-gradient-to-b dark:from-[#090A10] dark:via-[#05060A] dark:to-[#020204] text-[#1C1C1E] dark:text-[#F5F5F7] transition-colors duration-500 font-sans pb-32 overflow-x-hidden selection:bg-[#0071E3]/25 selection:text-[#0071E3]">
      
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

      {/* ================= VIBRANT AMBIENT AURORA BACKGROUND ================= */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        
        {/* Dynamic Cursor Spotlight */}
        <div 
          className="absolute inset-0 transition-opacity duration-300 opacity-70 dark:opacity-50"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, ${theme === 'dark' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(0, 113, 227, 0.15)'}, transparent 65%)`
          }}
        />

        {/* Floating Glowing Aurora Orbs - High Visibility */}
        <div className="absolute -top-32 -left-20 w-[44rem] h-[44rem] rounded-full bg-gradient-to-br from-[#4F46E5]/45 via-[#3B82F6]/40 to-[#06B6D4]/35 dark:from-[#4338CA]/40 dark:via-[#1D4ED8]/35 dark:to-[#0891B2]/30 blur-[75px] animate-orb-1" />
        
        <div className="absolute top-1/6 -right-28 w-[46rem] h-[46rem] rounded-full bg-gradient-to-bl from-[#9333EA]/40 via-[#EC4899]/35 to-[#F97316]/30 dark:from-[#7E22CE]/35 dark:via-[#BE185D]/30 dark:to-[#C2410C]/25 blur-[85px] animate-orb-2" />
        
        <div className="absolute -bottom-24 left-1/5 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-[#10B981]/35 via-[#06B6D4]/30 to-[#3B82F6]/35 dark:from-[#047857]/30 dark:via-[#0E7490]/25 dark:to-[#1E40AF]/30 blur-[80px] animate-orb-3" />

        {/* Ambient Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55rem] h-[35rem] rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-pink-900/15 blur-[90px] pointer-events-none" />

        {/* Micro-dot grid */}
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* ================= FROSTED GLASS BAR ================= */}
      <header className="sticky top-0 z-40 backdrop-blur-3xl bg-white/70 dark:bg-[#121214]/75 border-b border-black/[0.06] dark:border-white/[0.08] transition-all duration-300">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo with rounded squircle badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0071E3] via-[#5E5CE6] to-[#AF52DE] flex items-center justify-center text-white shadow-[0_4px_16px_rgba(0,113,227,0.35)] transition-transform hover:scale-105 active:scale-95">
              <Sparkles size={18} className="animate-apple-pulse" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">Flow</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] tracking-wide">
                Translate
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            
            {/* Apple Segmented Theme Switcher */}
            <div className="flex items-center apple-glass-pill p-1 rounded-full">
              <button
                onClick={() => toggleTheme('light')}
                className={`p-1.5 rounded-full transition-all duration-200 ${
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
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'apple-tab-active text-indigo-400 scale-100' 
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
                    className={`apple-icon-btn p-2 rounded-full text-xs font-semibold ${
                      showAdmin 
                        ? 'apple-btn-primary !text-white' 
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                    }`}
                    title="Панель администратора"
                  >
                    <Shield size={16} />
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 apple-glass-pill px-3 py-1.5 rounded-full">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">
                    {user.email[0]}
                  </div>
                  <span className="text-xs font-medium text-[#1C1C1E] dark:text-[#F5F5F7] max-w-[110px] truncate">
                    {user.email.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem('flow_token'); setUser(null); }}
                  className="apple-icon-btn text-[#8E8E93] hover:text-rose-500 p-2 rounded-full"
                  title="Выйти"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthModal('login'); setAuthError(''); }}
                className="text-xs font-semibold tracking-tight apple-btn-primary px-4 py-2 rounded-full"
              >
                Войти
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-4xl mx-auto px-3.5 sm:px-6 mt-3 sm:mt-6 space-y-4 sm:space-y-7">

        {/* Dynamic Island Status Capsule */}
        <div className="flex justify-center">
          <div className="ios-glass px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2 sm:gap-2.5 shadow-sm border border-black/[0.05] dark:border-white/[0.08] text-[11px] sm:text-xs font-medium transition-all duration-300 hover:scale-105 max-w-full truncate">
            {isOcrProcessing ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 truncate">
                  <Camera size={13} className="animate-pulse flex-shrink-0" /> {ocrStatusText || 'OCR Сканирование...'}
                </span>
              </>
            ) : isTranslating ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3] animate-ping flex-shrink-0" />
                <span className="text-[#0071E3] font-semibold flex items-center gap-1.5 truncate">
                  <RefreshCw size={12} className="animate-spin flex-shrink-0" /> Обработка MyMemory...
                </span>
              </>
            ) : (isSpeakingSource || isSpeakingTarget) ? (
              <>
                <div className="flex items-center gap-0.5 h-4 px-1 flex-shrink-0">
                  <span className="w-1 bg-[#0071E3] rounded-full sound-bar" />
                  <span className="w-1 bg-[#5E5CE6] rounded-full sound-bar" />
                  <span className="w-1 bg-[#AF52DE] rounded-full sound-bar" />
                  <span className="w-1 bg-[#0071E3] rounded-full sound-bar" />
                </div>
                <span className="text-[#0071E3] font-semibold truncate">Озвучивание текста</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] flex-shrink-0" />
                <span className="text-[#8E8E93] dark:text-[#AEAEB2] truncate">
                  Интеллектуальный перевод <span className="hidden sm:inline">· Готово к работе</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Apple Segmented Mode Switcher (Fully Responsive for Mobile) */}
        <div className="flex items-center justify-center w-full overflow-x-auto no-scrollbar py-0.5 px-1">
          <div className="apple-segmented-pill flex items-center gap-1 border border-black/[0.04] dark:border-white/[0.08] p-1 rounded-full flex-nowrap">
            <button
              onClick={() => { setActiveMode('text'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'text' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
            >
              <Edit3 size={13} className={activeMode === 'text' ? 'text-[#0071E3]' : ''} />
              <span>Текст</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('image');
                if (!imagePreviewUrl) imageInputRef.current?.click();
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'image' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Загрузить фото или сфотографировать"
            >
              <Camera size={13} className={activeMode === 'image' ? 'text-[#0071E3]' : ''} />
              <span>Фото<span className="hidden sm:inline">&nbsp;& Скан</span></span>
              <span className="hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-[#0071E3]/15 text-[#0071E3]">Live Text</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('doc');
                if (!loadedFile || loadedFile.type !== 'doc') docInputRef.current?.click();
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'doc' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Загрузить файл: PDF, TXT, MD, JSON, CSV, SRT"
            >
              <FileText size={13} className={activeMode === 'doc' ? 'text-[#0071E3]' : ''} />
              <span>Файлы<span className="hidden sm:inline">&nbsp;и документы</span></span>
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
              title="Перевести страницу в Safari Reader Mode"
            >
              <Globe size={13} className={activeMode === 'url' ? 'text-[#0071E3]' : ''} />
              <span>Сайт<span className="hidden sm:inline">&nbsp;/ Ссылка</span></span>
              <span className="hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">Reader</span>
            </button>
            <button
              onClick={() => { setActiveMode('dialogue'); }}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                activeMode === 'dialogue' 
                  ? 'apple-tab-active scale-[1.02]' 
                  : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
              }`}
              title="Синхронный голосовой диалог двух людей"
            >
              <MessageSquare size={13} className={activeMode === 'dialogue' ? 'text-[#0071E3]' : ''} />
              <span>Диалог<span className="hidden sm:inline">&nbsp;лицом к лицу</span></span>
              <span className="hidden md:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Live</span>
            </button>
          </div>
        </div>

        {/* Uploaded File Banner */}
        {loadedFile && (
          <div className="ios-glass px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center justify-between border border-[#0071E3]/30 bg-[#0071E3]/5 animate-in fade-in">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {loadedFile.type === 'image' ? <Camera size={16} className="text-[#0071E3] flex-shrink-0" /> : loadedFile.type === 'url' ? <Globe size={16} className="text-[#0071E3] flex-shrink-0" /> : <FileCheck size={16} className="text-[#0071E3] flex-shrink-0" />}
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
          <div className="ios-glass p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> {ocrStatusText}</span>
              <span>{ocrProgress}%</span>
            </div>
            <div className="w-full bg-black/[0.05] dark:bg-white/[0.1] rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-200 rounded-full"
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
                <Shield size={16} className="text-[#0071E3]" />
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
                  <p className="text-3xl font-extrabold mt-1 tracking-tight text-[#0071E3]">{adminStats.total_saved_words}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= СЕКЦИЯ 1: TRANSLATION ================= */}
        <section className="space-y-4">
          
          {/* Apple Segmented Language Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages size={18} className="text-[#0071E3]" />
              <h2 className="text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                Translation
              </h2>
            </div>

            {/* Apple Glass Language Switcher Pill */}
            <div className="flex items-center apple-glass-pill p-1 rounded-full shadow-sm">
              <div className="relative">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 rounded-full cursor-pointer transition-colors pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
                >
                  {SOURCE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E]">
                      {l.code === 'auto' 
                        ? (sourceLang === 'auto' && detectedLangObj 
                            ? `✨ Авто (${detectedLangObj.label})` 
                            : '✨ Автоопределение')
                        : `${l.flag} ${l.label}`}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-[#8E8E93]">▾</span>
              </div>

              <button
                onClick={swapLanguages}
                className={`apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-[#0071E3] transition-all ${isSwapping ? 'rotate-180 scale-90' : ''}`}
                title="Поменять языки местами"
              >
                <ArrowRightLeft size={13} />
              </button>

              <div className="relative">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 rounded-full cursor-pointer transition-colors pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
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

          {/* DIALOGUE MODE (Apple Translate Face-to-Face Live Conversation) */}
          {activeMode === 'dialogue' ? (
            <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 shadow-2xl space-y-4">
              {/* Dialogue Header Controls */}
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.06] gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                    Режим диалога «Лицом к лицу»
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Live Conversation
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoSpeakDialogue(!autoSpeakDialogue)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                      autoSpeakDialogue 
                        ? 'apple-btn-primary !text-white' 
                        : 'apple-btn-glass text-[#8E8E93]'
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
                    <div className="w-12 h-12 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto animate-pulse">
                      <MessageSquare size={22} />
                    </div>
                    <p className="text-sm font-semibold text-[#1C1C1E] dark:text-white">
                      Готовы к диалогу двух людей
                    </p>
                    <p className="text-xs text-[#8E8E93] max-w-sm mx-auto">
                      Нажмите круглую кнопку микрофона своего языка снизу и говорите. Перевод сразу появится в чате и будет озвучен собеседнику.
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
                        <div className={`max-w-[88%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-2xl sm:rounded-[22px] shadow-sm ${
                          isLeft ? 'apple-chat-bubble-user text-white' : 'apple-chat-bubble-peer text-white'
                        }`}>
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 pb-1 mb-1 border-b border-white/15">
                            <span className="font-bold uppercase tracking-wider">
                              {isLeft 
                                ? (sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.label : 'Авто') : activeSourceLang.label) 
                                : activeTargetLang.label}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>
                          
                          {/* Original spoken text */}
                          <p className="text-xs sm:text-sm font-medium opacity-90 leading-relaxed">
                            {msg.text}
                          </p>
                          
                          {/* Translated text */}
                          <div className="mt-2 pt-2 border-t border-white/20 flex items-start justify-between gap-2">
                            <p className="text-sm sm:text-base font-bold leading-snug">
                              {msg.translatedText}
                            </p>
                            <button
                              onClick={() => speak(msg.translatedText, msg.targetLang, true)}
                              className="p-1 rounded-full hover:bg-white/20 text-white flex-shrink-0 transition-colors"
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
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                {/* Speaker 1 (Source Lang) */}
                <div className="ios-glass p-3.5 sm:p-4 rounded-[22px] flex flex-col items-center justify-center gap-2 border border-black/[0.04] dark:border-white/[0.06] text-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E] dark:text-white">
                    <span>{sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.flag : '✨') : activeSourceLang.flag}</span>
                    <span className="truncate">{sourceLang === 'auto' ? (detectedLangObj ? detectedLangObj.label : 'Авто') : activeSourceLang.label}</span>
                  </div>
                  <button
                    onClick={() => startDialogueRecognition('left')}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      isDialogueListeningLeft
                        ? 'bg-rose-500 text-white shadow-rose-500/40 animate-mic-recording scale-110'
                        : 'apple-btn-primary !text-white hover:scale-105 active:scale-95'
                    }`}
                    title="Говорить на первом языке"
                  >
                    {isDialogueListeningLeft ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <span className="text-[11px] font-semibold text-[#8E8E93]">
                    {isDialogueListeningLeft ? 'Слушаю собеседника 1...' : 'Нажмите и говорите'}
                  </span>
                </div>

                {/* Speaker 2 (Target Lang) */}
                <div className="ios-glass p-3.5 sm:p-4 rounded-[22px] flex flex-col items-center justify-center gap-2 border border-black/[0.04] dark:border-white/[0.06] text-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E] dark:text-white">
                    <span>{activeTargetLang.flag}</span>
                    <span className="truncate">{activeTargetLang.label}</span>
                  </div>
                  <button
                    onClick={() => startDialogueRecognition('right')}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                      isDialogueListeningRight
                        ? 'bg-rose-500 text-white shadow-rose-500/40 animate-mic-recording scale-110'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 active:scale-95 shadow-indigo-500/20'
                    }`}
                    title="Говорить на втором языке"
                  >
                    {isDialogueListeningRight ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  <span className="text-[11px] font-semibold text-[#8E8E93]">
                    {isDialogueListeningRight ? 'Слушаю собеседника 2...' : 'Нажмите и говорите'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
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
              className={`ios-glass ios-card-specular rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 min-h-[220px] sm:min-h-[260px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl focus-within:ring-2 focus-within:ring-[#0071E3]/40 relative ${isDragging ? 'ring-4 ring-[#0071E3] bg-[#0071E3]/10 scale-[1.01]' : ''}`}
            >
              {isDragging && (
                <div className="absolute inset-0 z-30 backdrop-blur-md bg-white/80 dark:bg-black/80 rounded-[28px] sm:rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-3 text-[#0071E3] font-bold animate-in fade-in p-4 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#0071E3]/10 flex items-center justify-center animate-bounce">
                    <UploadCloud size={28} className="sm:size-9" />
                  </div>
                  <span className="text-xs sm:text-sm tracking-tight">Отпустите для анализа и перевода</span>
                </div>
              )}

              <div>
                {/* Source Card Header with Mode Badges */}
                <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-black/[0.04] dark:border-white/[0.06] gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    {sourceLang === 'auto' ? (
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                        <Sparkles size={12} className="text-[#0071E3] animate-pulse" />
                        <span className="hidden xs:inline">Авто:</span>
                        <span className="text-[10px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-full border border-[#0071E3]/20 flex items-center gap-1">
                          {detectedLangObj.flag} {detectedLangObj.label}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                        {activeSourceLang.flag} {activeSourceLang.label}
                      </span>
                    )}
                    {activeMode === 'image' && (
                      <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center gap-1 border border-[#0071E3]/20 flex-shrink-0">
                        <Scan size={10} /> Live Text
                      </span>
                    )}
                    {activeMode === 'doc' && (
                      <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 border border-indigo-500/20 flex-shrink-0">
                        <FileText size={10} /> Файлы
                      </span>
                    )}
                    {activeMode === 'url' && (
                      <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1 border border-purple-500/20 flex-shrink-0">
                        <Compass size={10} /> Reader
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {activeMode === 'image' && (
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-[#0071E3] apple-btn-glass rounded-full transition-all flex items-center gap-1"
                        title="Выбрать другое фото"
                      >
                        <Camera size={13} /> <span>{imagePreviewUrl ? 'Заменить' : 'Выбрать'}</span>
                      </button>
                    )}
                    {activeMode === 'doc' && (
                      <button
                        onClick={() => docInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-[#0071E3] apple-btn-glass rounded-full transition-all flex items-center gap-1"
                        title="Выбрать другой документ"
                      >
                        <UploadCloud size={13} /> <span>{loadedFile ? 'Заменить' : 'Выбрать'}</span>
                      </button>
                    )}
                    {activeMode === 'url' && (
                      <button
                        onClick={() => setUrlModal(true)}
                        className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-[#0071E3] apple-btn-glass rounded-full transition-all flex items-center gap-1"
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
                          alt="Live Text Scan" 
                          className={`max-h-40 sm:max-h-48 rounded-xl object-contain transition-all duration-300 ${isOcrProcessing ? 'opacity-70 blur-[1px]' : ''}`} 
                        />

                        {isOcrProcessing && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-2 text-center">
                            <div className="flex items-center gap-2 bg-black/70 px-3.5 py-1.5 rounded-full border border-white/20 shadow-lg">
                              <Loader2 size={16} className="animate-spin text-[#0071E3]" />
                              <span className="text-xs font-semibold truncate">{ocrStatusText || 'Нейросеть считывает...'}</span>
                            </div>
                          </div>
                        )}

                        {!isOcrProcessing && (
                          <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/15 shadow-sm">
                            <Sparkles size={11} className="text-[#0071E3]" /> Live Text
                          </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="relative rounded-2xl border-2 border-dashed border-black/10 dark:border-white/15 hover:border-[#0071E3]/60 p-4 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.02] dark:bg-white/[0.02] group active:scale-[0.99]"
                      >
                        <span className="viewfinder-bracket top-2.5 left-2.5 border-t-2 border-l-2 rounded-tl group-hover:border-[#0071E3]" />
                        <span className="viewfinder-bracket top-2.5 right-2.5 border-t-2 border-r-2 rounded-tr group-hover:border-[#0071E3]" />
                        <span className="viewfinder-bracket bottom-2.5 left-2.5 border-b-2 border-l-2 rounded-bl group-hover:border-[#0071E3]" />
                        <span className="viewfinder-bracket bottom-2.5 right-2.5 border-b-2 border-r-2 rounded-br group-hover:border-[#0071E3]" />

                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-2 sm:mb-2.5 group-hover:scale-110 transition-transform">
                          <Camera size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Live Text · Распознавание фото
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2 sm:mb-3 leading-relaxed">
                          <span className="sm:hidden">Нажмите, чтобы сделать фото камерой или выбрать из медиатеки</span>
                          <span className="hidden sm:inline">Перетащите фото сюда, выберите файл или нажмите <kbd className="px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.1] font-mono text-[10px]">Ctrl+V</kbd> для скриншота</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#8E8E93]">
                            Камера · Галерея · Скриншоты
                          </span>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Распознанный текст появится здесь..."
                      rows={imagePreviewUrl ? 2 : 3}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white"
                    />
                  </div>
                )}

                {/* MODE: DOCUMENT */}
                {activeMode === 'doc' && (
                  <div className="space-y-2.5 sm:space-y-3 mb-2">
                    {loadedFile && (loadedFile.type === 'doc' || loadedFile.type === 'pdf') ? (
                      <div className="p-3 sm:p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#0071E3] to-[#5E5CE6] text-white flex items-center justify-center font-bold text-xs shadow-md flex-shrink-0">
                            {loadedFile.ext || 'DOC'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1C1C1E] dark:text-white truncate max-w-[140px] sm:max-w-xs">{loadedFile.name}</p>
                            <p className="text-[10px] text-[#8E8E93]">{loadedFile.size} · {sourceText.length} симв.</p>
                          </div>
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-bold px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 border border-emerald-500/20 flex-shrink-0">
                          <Check size={11} /> <span className="hidden xs:inline">Готово к переводу</span><span className="xs:hidden">Готово</span>
                        </span>
                      </div>
                    ) : (
                      <div 
                        onClick={() => docInputRef.current?.click()}
                        className="rounded-2xl border-2 border-dashed border-black/10 dark:border-white/15 hover:border-[#0071E3]/60 p-4 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.02] dark:bg-white/[0.02] group active:scale-[0.99]"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 sm:mb-2.5 group-hover:scale-110 transition-transform">
                          <FileText size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Чтение и перевод документов
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2.5 sm:mb-3 leading-relaxed">
                          Нажмите, чтобы выбрать документ на телефоне или компьютере
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">PDF</span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">TXT</span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">MD</span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">JSON</span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">CSV</span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">SRT</span>
                        </div>
                      </div>
                    )}

                    <textarea
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Текст документа для перевода..."
                      rows={loadedFile ? 2 : 3}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white"
                    />
                  </div>
                )}

                {/* MODE: URL (Apple Safari Reader Mode) */}
                {activeMode === 'url' && (
                  <div className="space-y-2.5 sm:space-y-3 mb-2">
                    {loadedFile && loadedFile.type === 'url' ? (
                      <div className="p-3 sm:p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center font-bold text-sm flex-shrink-0">
                            <Compass size={18} className="sm:size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#1C1C1E] dark:text-white truncate max-w-[140px] sm:max-w-xs">{loadedFile.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 flex-shrink-0">Reader</span>
                            </div>
                            <p className="text-[10px] text-[#8E8E93]">
                              ~{Math.max(1, Math.round(sourceText.split(/\s+/).filter(Boolean).length / 150))} мин · {sourceText.split(/\s+/).filter(Boolean).length} слов
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setUrlModal(true)}
                          className="text-xs font-semibold px-3 py-1 rounded-full apple-btn-glass text-[#0071E3] transition-all flex-shrink-0"
                        >
                          Сменить
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => setUrlModal(true)}
                        className="rounded-2xl border-2 border-dashed border-black/10 dark:border-white/15 hover:border-[#0071E3]/60 p-4 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/[0.02] dark:bg-white/[0.02] group active:scale-[0.99]"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 sm:mb-2.5 group-hover:scale-110 transition-transform">
                          <Globe size={22} className="sm:size-6" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1C1E] dark:text-white mb-1">
                          Safari Reader Mode · Веб-страницы
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#8E8E93] max-w-xs mb-2.5 sm:mb-3 leading-relaxed">
                          Нажмите, чтобы ввести ссылку на любую статью или новость без рекламы
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-[#0071E3] font-semibold">
                          <span>Ввести адрес страницы</span> <ArrowUpRight size={13} />
                        </div>
                      </div>
                    )}

                    <textarea
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Текст статьи для перевода..."
                      rows={loadedFile ? 2 : 3}
                      className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white"
                    />
                  </div>
                )}

                {/* MODE: STANDARD TEXT */}
                {activeMode === 'text' && (
                  <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Введите текст или перетащите фото / документ сюда..."
                    rows={3}
                    className="w-full text-lg sm:text-2xl md:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white"
                  />
                )}
              </div>

              {/* Source Card Footer */}
              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 sm:gap-2">
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
                        : 'text-[#8E8E93] hover:text-[#0071E3] dark:hover:text-[#2997FF]'
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

                  <span className="text-[11px] font-medium text-[#8E8E93]">
                    {sourceText.length} <span className="hidden xs:inline">символов</span><span className="xs:hidden">симв.</span>
                  </span>
                </div>

                <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1.5">
                  {isTranslating ? (
                    <span className="flex items-center gap-1.5 text-[#0071E3]">
                      <RefreshCw size={12} className="animate-spin" />
                      Перевод...
                    </span>
                  ) : (
                    <span className="text-[#8E8E93]/70">Авто</span>
                  )}
                </span>
              </div>
            </div>

            {/* Target Card */}
            <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 min-h-[220px] sm:min-h-[260px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl relative overflow-hidden">
              
              {isTranslating && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0071E3] to-purple-500 animate-shimmer" />
              )}

              <div>
                <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2 sm:mb-2.5 border-b border-black/[0.04] dark:border-white/[0.06] gap-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                      {activeTargetLang.flag} {activeTargetLang.label}
                    </span>

                    {/* AI Tone Switcher (DeepL style) */}
                    <div className="flex items-center apple-glass-pill p-0.5 rounded-full text-[10px] font-semibold" title="Тон перевода: нейтральный, вежливый (Вы) или неформальный (ты)">
                      <button
                        onClick={() => setTone('neutral')}
                        className={`px-2 py-0.5 rounded-full transition-all ${tone === 'neutral' ? 'apple-tab-active text-[#0071E3]' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                      >
                        Авто
                      </button>
                      <button
                        onClick={() => setTone('formal')}
                        className={`px-2 py-0.5 rounded-full transition-all ${tone === 'formal' ? 'apple-tab-active text-[#0071E3]' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                      >
                        Вы
                      </button>
                      <button
                        onClick={() => setTone('informal')}
                        className={`px-2 py-0.5 rounded-full transition-all ${tone === 'informal' ? 'apple-tab-active text-[#0071E3]' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                      >
                        ты
                      </button>
                    </div>
                  </div>

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
                    <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wider">
                      Результат
                    </span>
                  </div>
                </div>

                {isTranslating ? (
                  <div className="flex items-center gap-3 py-6 text-[#8E8E93]">
                    <div className="w-5 h-5 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
                    <span className="text-base sm:text-lg font-medium text-[#8E8E93]">Переводим текст...</span>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#1C1C1E] dark:text-white select-text leading-snug tracking-tight break-words">
                      {translatedText || <span className="text-[#AEAEB2] dark:text-[#48484A] font-normal">Перевод</span>}
                    </h3>

                    {/* AI Alternatives & Synonyms (DeepL/Reverso style) */}
                    {alternatives && alternatives.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] mb-1.5 flex items-center gap-1">
                          <Sparkles size={11} className="text-[#0071E3]" /> Другие варианты:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {alternatives.map((alt, idx) => (
                            <button
                              key={idx}
                              onClick={() => setTranslatedText(alt)}
                              className="apple-alt-chip text-xs px-2.5 py-1 rounded-full text-left transition-all hover:scale-[1.02] active:scale-95"
                              title="Нажмите, чтобы применить этот вариант"
                            >
                              {alt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Context Usage Examples (Reverso style) */}
                    {examples && examples.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] flex items-center gap-1">
                          <BookOpen size={11} className="text-purple-500" /> Примеры в контексте:
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                          {examples.map((ex, idx) => (
                            <div key={idx} className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05] text-xs">
                              <p className="text-[#8E8E93] font-normal leading-relaxed">{ex.source}</p>
                              <p className="text-[#1C1C1E] dark:text-[#F5F5F7] font-medium mt-0.5 leading-relaxed">{ex.target}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
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
          )}

          {/* Context-Aware Tips for Image / Doc / URL modes */}
          {activeMode !== 'text' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
              {activeMode === 'image' && (
                <>
                  <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1 flex-shrink-0 pl-1">
                    <Camera size={13} className="text-[#0071E3]" /> Советы по фото:
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    📸 Сделайте фото камерой или выберите из галереи
                  </span>
                  <span className="hidden sm:inline-flex ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    📋 На ПК: вставка скриншота через Ctrl+V
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    ✨ Распознавание как печатного, так и рукописного текста
                  </span>
                </>
              )}

              {activeMode === 'doc' && (
                <>
                  <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1 flex-shrink-0 pl-1">
                    <FileText size={13} className="text-indigo-500" /> Советы по файлам:
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    📄 Поддерживаются .pdf, .txt, .md, .json, .csv, .srt
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    💾 Кнопка «Скачать .txt» мгновенно сохраняет готовый файл
                  </span>
                </>
              )}

              {activeMode === 'url' && (
                <>
                  <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1 flex-shrink-0 pl-1">
                    <Compass size={13} className="text-purple-500" /> Советы по сайтам:
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    🌐 Режим Reader View удаляет рекламу, меню и баннеры со страницы
                  </span>
                  <span className="ios-glass text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 text-[#1C1C1E] dark:text-[#F5F5F7]">
                    📖 Подходят статьи, блоги, новости и публикации
                  </span>
                </>
              )}
            </div>
          )}

        </section>

        {/* ================= СЕКЦИЯ 2: FAVORITES & ИСТОРИЯ ================= */}
        <section className="space-y-4 pt-2">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tab Switcher: Favorites vs Recent History */}
            <div className="flex items-center apple-glass-pill p-1 rounded-full w-fit">
              <button
                onClick={() => setActiveBottomTab('favorites')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                  activeBottomTab === 'favorites'
                    ? 'apple-tab-active text-[#1C1C1E] dark:text-white'
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                }`}
              >
                <Star size={14} className="text-amber-500" fill={activeBottomTab === 'favorites' ? "currentColor" : "none"} />
                <span>Favorites</span>
                {totalEntries > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#8E8E93]">
                    {totalEntries}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveBottomTab('history')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                  activeBottomTab === 'history'
                    ? 'apple-tab-active text-[#1C1C1E] dark:text-white'
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
                }`}
              >
                <History size={14} className="text-[#0071E3]" />
                <span>История</span>
                {recentHistory.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                    {recentHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Right-side action controls */}
            {activeBottomTab === 'favorites' ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Study Mode Button */}
                {entries.length > 0 && (
                  <button
                    onClick={() => { setCurrentCardIndex(0); setIsCardFlipped(false); setFlashcardModal(true); }}
                    className="text-xs font-semibold apple-btn-primary px-3.5 sm:px-4 py-1.5 rounded-full flex items-center gap-1.5"
                  >
                    <RotateCw size={13} /> Учить слова
                  </button>
                )}

                {/* View Mode Toggle */}
                <div className="flex items-center apple-glass-pill p-1 rounded-full">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'apple-tab-active text-[#0071E3]' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                    title="Список"
                  >
                    <ListFilter size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-full transition-all ${viewMode === 'grid' ? 'apple-tab-active text-[#0071E3]' : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'}`}
                    title="Сетка"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>

                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`apple-icon-btn p-2 rounded-full text-xs font-semibold ${
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
                  className="text-xs font-semibold text-[#0071E3] apple-btn-glass px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap"
                >
                  + Тег
                </button>
              </div>
            ) : (
              /* History controls */
              <div className="flex items-center gap-2">
                {recentHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1.5"
                    title="Очистить историю переводов"
                  >
                    <Trash2 size={13} />
                    <span>Очистить историю</span>
                  </button>
                )}
              </div>
            )}
          </div>

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
                        className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] px-5 py-3.5 rounded-2xl shadow-sm hover:shadow-md flex items-center justify-between gap-3 group transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04]"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-bold text-base text-[#1C1C1E] dark:text-white truncate tracking-tight">
                            {item.source_text}
                          </span>
                          <span className="text-[#8E8E93] font-light flex-shrink-0">→</span>
                          <span className="font-semibold text-base text-[#1C1C1E] dark:text-white truncate tracking-tight">
                            {item.translated_text}
                          </span>

                          {item.category_name && (
                            <span
                              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: item.category_color || '#0071E3' }}
                            >
                              {item.category_name}
                            </span>
                          )}
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
                            className="apple-icon-btn text-[#8E8E93] hover:text-[#0071E3] p-2 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
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
                        className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] p-5 rounded-[24px] shadow-sm hover:shadow-md flex flex-col justify-between transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04] relative group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            {item.category_name ? (
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white shadow-sm"
                                style={{ backgroundColor: item.category_color || '#0071E3' }}
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
                              className="apple-icon-btn text-[#8E8E93] hover:text-[#0071E3] p-1.5 rounded-full"
                              title="Озвучить"
                            >
                              <Volume2 size={16} />
                            </button>
                            <button
                              onClick={() => setEditingEntry(item)}
                              className="apple-icon-btn text-[#8E8E93] hover:text-[#0071E3] p-1.5 rounded-full"
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
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="apple-btn-glass rounded-full px-3 py-1 hover:text-[#0071E3] disabled:opacity-20 transition-all">← Назад</button>
                    <span className="apple-glass-pill px-3 py-1 rounded-full text-xs font-semibold">{page} из {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="apple-btn-glass rounded-full px-3 py-1 hover:text-[#0071E3] disabled:opacity-20 transition-all">Вперед →</button>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!user) { setAuthModal('login'); return; }
                    setManualModal(true);
                  }}
                  className="w-full py-3 text-center text-xs font-semibold text-[#0071E3] apple-btn-glass rounded-2xl transition-all flex items-center justify-center gap-1.5"
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
                <div className="space-y-2">
                  {recentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/90 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.07] px-4 sm:px-5 py-3.5 rounded-2xl shadow-sm hover:shadow-md flex items-center justify-between gap-3 group transition-all duration-200 border border-black/[0.03] dark:border-white/[0.04]"
                    >
                      <div 
                        onClick={() => restoreFromHistory(item)}
                        className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0 flex-1 cursor-pointer"
                        title="Нажмите, чтобы открыть этот перевод в редакторе"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#8E8E93] flex-shrink-0 uppercase">
                            {item.source_lang} → {item.target_lang}
                          </span>
                          <span className="font-bold text-sm sm:text-base text-[#1C1C1E] dark:text-white truncate tracking-tight">
                            {item.source_text}
                          </span>
                        </div>
                        <span className="hidden sm:inline text-[#8E8E93] font-light flex-shrink-0">→</span>
                        <span className="font-semibold text-sm sm:text-base text-[#0071E3] dark:text-[#2997FF] truncate tracking-tight">
                          {item.translated_text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => speak(item.translated_text, item.target_lang, true)}
                          className="apple-icon-btn text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-2 rounded-full"
                          title="Озвучить перевод"
                        >
                          <Volume2 size={16} />
                        </button>
                        <button
                          onClick={() => restoreFromHistory(item)}
                          className="apple-btn-glass text-xs font-semibold px-2.5 sm:px-3 py-1 rounded-full text-[#0071E3] hover:scale-105 transition-all flex items-center gap-1"
                          title="Восстановить в карточки"
                        >
                          <RotateCw size={12} />
                          <span className="hidden sm:inline">Открыть</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </section>

      </main>

      {/* ================= URL TRANSLATION MODAL (Safari Browser Window) ================= */}
      {urlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-lg border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            
            {/* Safari Window Header */}
            <div className="flex items-center justify-between pb-3 sm:pb-3.5 mb-3.5 sm:mb-4 border-b border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setUrlModal(false)} 
                  className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition-opacity" 
                  title="Закрыть" 
                />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                <span className="text-xs font-semibold text-[#8E8E93] ml-1.5 flex items-center gap-1.5">
                  <Compass size={13} className="text-[#0071E3]" /> Safari Reader View
                </span>
              </div>
              <button 
                onClick={() => setUrlModal(false)} 
                className="apple-icon-btn text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mb-3.5 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                Перевод веб-страницы
              </h3>
              <p className="text-[11px] sm:text-xs text-[#8E8E93]">
                Интеллектуальное извлечение основного текста статьи без рекламы, меню и баннеров
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
                <div className="ml-2 pl-2 border-l border-black/[0.08] dark:border-white/[0.1] text-[#0071E3] font-bold text-[11px] select-none">
                  aA
                </div>
              </div>

              {/* Safari Bookmarks / Speed Dial Grid */}
              <div>
                <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-2">Избранные закладки:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {URL_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInputUrl(p.url)}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        inputUrl === p.url 
                          ? 'apple-btn-glass !border-[#0071E3] !text-[#0071E3]' 
                          : 'apple-btn-glass'
                      }`}
                    >
                      <span className="text-base sm:text-lg">{p.icon}</span>
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
                    <span>Открыть в Reader Mode</span>
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
                className="apple-icon-btn p-1.5 rounded-full text-white"
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
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wider">
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
                <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-8 w-full h-full flex flex-col justify-between absolute inset-0 backface-hidden rotate-y-180 shadow-2xl border-2 border-[#0071E3]/30">
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
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0071E3] break-words">
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
                        style={{ backgroundColor: currentFlashcard.category_color || '#0071E3' }}
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
          <div className="ios-glass ios-card-specular rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative max-h-[92vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setAuthModal(null)} className="apple-icon-btn absolute right-4 top-4 sm:right-5 sm:top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1.5 rounded-full"><X size={16} /></button>
            
            <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-1 text-[#1C1C1E] dark:text-white">
              {authModal === 'login' ? 'Вход в аккаунт' : authModal === 'register' ? 'Регистрация' : 'Двухфакторная защита'}
            </h3>
            <p className="text-xs text-[#8E8E93] mb-4 sm:mb-5">
              {authModal === 'login' ? 'Войдите для доступа к персональному словарю' : authModal === 'register' ? 'Создайте аккаунт Flow Translate' : 'Подтвердите вход через Google Authenticator'}
            </p>

            {authError && <div className="p-3 mb-4 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20">{authError}</div>}
            {authSuccess && <div className="p-3 mb-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">{authSuccess}</div>}

            <form onSubmit={handleAuth} className="space-y-3.5">
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" placeholder="user@gmail.com" />
                  </div>
                </div>
              )}
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Пароль (мин. 8 знаков, цифра, заглавная)</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" placeholder="••••••••" />
                  </div>
                </div>
              )}
              {authModal === 'register' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Повтор пароля</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input type="password" required value={authPasswordConfirm} onChange={e => setAuthPasswordConfirm(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 apple-glass-input rounded-2xl text-sm focus:outline-none text-[#1C1C1E] dark:text-white" placeholder="••••••••" />
                  </div>
                </div>
              )}

              {authModal === 'verify' && (
                <div className="space-y-3.5 text-center">
                  {qrCodeUrl && (
                    <div className="bg-white p-4 rounded-3xl inline-block border border-black/[0.06] shadow-md">
                      <img src={qrCodeUrl} alt="QR Code" className="w-44 h-44 mx-auto rounded-xl" />
                    </div>
                  )}
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    Отсканируйте код в приложении <b>Google Authenticator</b> и введите 6-значный код:
                  </p>
                  <div>
                    <input 
                      type="text" 
                      maxLength={6} 
                      required 
                      value={verifyCode} 
                      onChange={e => setVerifyCode(e.target.value)} 
                      className="w-full py-3 apple-glass-input rounded-2xl text-center font-bold text-2xl tracking-[0.4em] focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="000000" 
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full apple-btn-primary font-semibold py-3 rounded-2xl text-sm mt-3">
                {authModal === 'login' ? 'Войти' : authModal === 'register' ? 'Создать аккаунт' : 'Подтвердить и войти'}
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-[#8E8E93]">
              {authModal === 'login' ? (
                <span>Нет аккаунта? <button onClick={() => { setAuthModal('register'); setAuthError(''); }} className="font-semibold text-[#0071E3] hover:underline">Регистрация</button></span>
              ) : authModal === 'register' ? (
                <span>Уже есть аккаунт? <button onClick={() => { setAuthModal('login'); setAuthError(''); }} className="font-semibold text-[#0071E3] hover:underline">Войти</button></span>
              ) : null}
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
              <button type="submit" className="w-full apple-btn-primary font-semibold py-3 rounded-2xl text-sm mt-2">
                Сохранить в Favorites
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