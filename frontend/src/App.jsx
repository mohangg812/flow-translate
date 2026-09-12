import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { 
  Volume2, Star, Edit3, Search, LogOut, 
  ArrowRightLeft, X, Shield, RefreshCw, Check, Sun, Moon, Copy,
  Sparkles, Languages, PlusCircle, CheckCircle2,
  Lock, Mail, LayoutGrid, ListFilter, RotateCw, ChevronLeft, ChevronRight,
  Zap, Lightbulb, Play
} from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const QUICK_CHIPS = [
  { text: 'Apple design is pure perfection', label: '🍎 Apple Design' },
  { text: 'Could I get an iced oat flat white, please?', label: '☕ Заказать кофе' },
  { text: 'Where is terminal 3 for departure?', label: '✈️ В аэропорту' },
  { text: 'It was a great pleasure working with you', label: '💼 Деловое письмо' },
  { text: 'Thank you so much for your warm hospitality', label: '🌟 Благодарность' },
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
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ru');
  const [sourceText, setSourceText] = useState('Apple design is pure perfection');
  const [translatedText, setTranslatedText] = useState('Дизайн Apple — это совершенство');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isInDictionary, setIsInDictionary] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

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

  // iOS 18 New Features: View Mode & Flashcards
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [flashcardModal, setFlashcardModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Admin state
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  // Mouse spotlight position for VisionOS/iOS glow
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const translateAbortRef = useRef(null);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setTranslatedText('');
      setIsInDictionary(false);
      setSavedEntryId(null);
      return;
    }

    if (sourceLang === targetLang) {
      setTranslatedText(text);
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
            source_lang: sourceLang,
            target_lang: targetLang,
          }, { signal: controller.signal });
          resData = res.data;
        } catch (apiErr) {
          if (apiErr.name === 'CanceledError' || apiErr.code === 'ERR_CANCELED') {
            throw apiErr;
          }
          const pair = `${sourceLang}|${targetLang}`;
          const fallbackRes = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`,
            { signal: controller.signal }
          );
          const fallbackJson = await fallbackRes.json();
          const raw = fallbackJson?.responseData?.translatedText;
          if (raw) {
            const doc = new DOMParser().parseFromString(raw, 'text/html');
            resData = {
              translated_text: doc.body.textContent || raw,
              is_saved_in_dictionary: false,
              saved_entry_id: null,
            };
          } else {
            throw apiErr;
          }
        }

        if (resData) {
          setTranslatedText(resData.translated_text);
          setIsInDictionary(resData.is_saved_in_dictionary || false);
          setSavedEntryId(resData.saved_entry_id || null);
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
  }, [sourceText, sourceLang, targetLang]);

  const swapLanguages = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 300);
    const tempLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tempLang);
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
        const res = await api.post('/dictionary/entries', {
          source_text: sourceText,
          translated_text: translatedText,
          source_lang: sourceLang,
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

  const activeSourceLang = LANGUAGES.find(l => l.code === sourceLang) || LANGUAGES[0];
  const activeTargetLang = LANGUAGES.find(l => l.code === targetLang) || LANGUAGES[1];

  const currentFlashcard = entries[currentCardIndex];

  return (
    <div className="relative min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F5F5F7] transition-colors duration-500 font-sans pb-32 overflow-x-hidden selection:bg-[#0071E3]/25 selection:text-[#0071E3]">
      
      {/* ================= iOS 18 INTERACTIVE AURORA & SPOTLIGHT ================= */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        
        {/* Dynamic Cursor Spotlight */}
        <div 
          className="absolute inset-0 transition-opacity duration-300 opacity-60 dark:opacity-40"
          style={{
            background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, ${theme === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(0, 113, 227, 0.08)'}, transparent 70%)`
          }}
        />

        {/* Apple Intelligence Aurora orbs */}
        <div className="absolute -top-40 -left-32 w-[52rem] h-[52rem] rounded-full bg-gradient-to-tr from-indigo-500/25 via-blue-500/20 to-cyan-400/25 dark:from-indigo-600/20 dark:via-blue-600/15 dark:to-cyan-500/15 blur-[150px] animate-orb-1" />
        <div className="absolute top-1/4 -right-40 w-[56rem] h-[56rem] rounded-full bg-gradient-to-bl from-purple-500/25 via-pink-500/20 to-orange-400/20 dark:from-purple-900/30 dark:via-fuchsia-950/20 dark:to-indigo-950/20 blur-[160px] animate-orb-2" />
        <div className="absolute -bottom-40 left-1/4 w-[48rem] h-[48rem] rounded-full bg-gradient-to-t from-emerald-400/20 via-teal-400/15 to-sky-400/20 dark:from-emerald-950/20 dark:via-teal-950/15 dark:to-blue-950/20 blur-[140px] animate-orb-3" />

        {/* Micro-dot grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* ================= iOS 18 FROSTED GLASS BAR ================= */}
      <header className="sticky top-0 z-40 backdrop-blur-3xl bg-white/70 dark:bg-[#121214]/75 border-b border-black/[0.06] dark:border-white/[0.08] transition-all duration-300">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo with Apple squircle badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0071E3] via-[#5E5CE6] to-[#AF52DE] flex items-center justify-center text-white shadow-[0_4px_16px_rgba(0,113,227,0.35)] transition-transform hover:scale-105 active:scale-95">
              <Sparkles size={18} className="animate-apple-pulse" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">Flow</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#8E8E93] dark:text-[#AEAEB2] tracking-wider uppercase">
                iOS 18 Edition
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            
            {/* Apple Segmented Theme Switcher */}
            <div className="flex items-center bg-black/[0.05] dark:bg-white/[0.08] p-1 rounded-full border border-black/[0.04] dark:border-white/[0.06] shadow-inner">
              <button
                onClick={() => toggleTheme('light')}
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  theme === 'light' 
                    ? 'bg-white text-amber-500 shadow-[0_2px_8px_rgba(0,0,0,0.12)] scale-100' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] scale-95'
                }`}
                title="Светлая тема"
              >
                <Sun size={14} />
              </button>
              <button
                onClick={() => toggleTheme('dark')}
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'bg-[#1C1C1E] text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.4)] scale-100' 
                    : 'text-[#8E8E93] hover:text-white scale-95'
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
                    className={`p-2 rounded-2xl text-xs font-semibold transition-all ${
                      showAdmin 
                        ? 'bg-[#0071E3] text-white shadow-[0_4px_12px_rgba(0,113,227,0.35)]' 
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.06]'
                    }`}
                    title="Панель администратора"
                  >
                    <Shield size={16} />
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    {user.email[0]}
                  </div>
                  <span className="text-xs font-medium text-[#1C1C1E] dark:text-[#F5F5F7] max-w-[110px] truncate">
                    {user.email.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem('flow_token'); setUser(null); }}
                  className="text-[#8E8E93] hover:text-rose-500 p-2 rounded-full hover:bg-rose-500/10 transition-colors"
                  title="Выйти"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthModal('login'); setAuthError(''); }}
                className="text-xs font-semibold tracking-tight bg-[#0071E3] hover:bg-[#0077ED] text-white px-4 py-2 rounded-full transition-all shadow-[0_4px_12px_rgba(0,113,227,0.3)] hover:shadow-[0_6px_18px_rgba(0,113,227,0.4)] active:scale-95"
              >
                Войти
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-4xl mx-auto px-6 mt-6 space-y-7">

        {/* ================= iOS 18 DYNAMIC ISLAND STATUS BAR ================= */}
        <div className="flex justify-center">
          <div className="ios-glass px-4 py-2 rounded-full flex items-center gap-2.5 shadow-sm border border-black/[0.05] dark:border-white/[0.08] text-xs font-medium transition-all duration-300 hover:scale-105">
            {isTranslating ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3] animate-ping" />
                <span className="text-[#0071E3] font-semibold flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" /> Обработка MyMemory...
                </span>
              </>
            ) : (isSpeakingSource || isSpeakingTarget) ? (
              <>
                <div className="flex items-center gap-0.5 h-4 px-1">
                  <span className="w-1 bg-[#0071E3] rounded-full sound-bar" />
                  <span className="w-1 bg-[#5E5CE6] rounded-full sound-bar" />
                  <span className="w-1 bg-[#AF52DE] rounded-full sound-bar" />
                  <span className="w-1 bg-[#0071E3] rounded-full sound-bar" />
                </div>
                <span className="text-[#0071E3] font-semibold">Озвучивание текста</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                <span className="text-[#8E8E93] dark:text-[#AEAEB2]">
                  Apple Intelligence Engine · Готово к переводу
                </span>
              </>
            )}
          </div>
        </div>

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

            {/* Language Switcher Pill */}
            <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-md">
              <div className="relative">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-colors pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E]">{l.flag} {l.label}</option>)}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-[#8E8E93]">▾</span>
              </div>

              <button
                onClick={swapLanguages}
                className={`p-2 rounded-xl text-[#8E8E93] hover:text-[#0071E3] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all ${isSwapping ? 'rotate-180 scale-90' : ''}`}
                title="Поменять языки местами"
              >
                <ArrowRightLeft size={14} />
              </button>

              <div className="relative">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="appearance-none bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-colors pr-6 focus:outline-none text-[#1C1C1E] dark:text-white"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code} className="dark:bg-[#1C1C1E]">{l.flag} {l.label}</option>)}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-[#8E8E93]">▾</span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Source Card */}
            <div className="ios-glass ios-card-specular rounded-[32px] p-6 min-h-[220px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl focus-within:ring-2 focus-within:ring-[#0071E3]/40">
              <div>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                    {activeSourceLang.flag} {activeSourceLang.label}
                  </span>
                  {sourceText && (
                    <button 
                      onClick={() => setSourceText('')}
                      className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                      title="Очистить"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Введите текст для перевода..."
                  rows={3}
                  className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none resize-none focus:outline-none placeholder-[#AEAEB2] dark:placeholder-[#48484A] leading-snug tracking-tight text-[#1C1C1E] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => speak(sourceText, sourceLang, false)}
                    disabled={!sourceText.trim()}
                    className={`p-2 rounded-2xl transition-all duration-200 ${
                      isSpeakingSource
                        ? 'bg-[#0071E3] text-white shadow-md scale-105'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-20'
                    }`}
                    title="Озвучить оригинал"
                  >
                    <Volume2 size={18} />
                  </button>
                  <span className="text-[11px] font-medium text-[#8E8E93]">
                    {sourceText.length} символов
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
            <div className="ios-glass ios-card-specular rounded-[32px] p-6 min-h-[220px] flex flex-col justify-between transition-all duration-300 hover:shadow-2xl relative overflow-hidden">
              
              {isTranslating && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#0071E3] to-purple-500 animate-shimmer" />
              )}

              <div>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
                    {activeTargetLang.flag} {activeTargetLang.label}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wider">
                    Результат
                  </span>
                </div>

                {isTranslating ? (
                  <div className="flex items-center gap-3 py-6 text-[#8E8E93]">
                    <div className="w-5 h-5 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
                    <span className="text-lg font-medium text-[#8E8E93]">Переводим текст...</span>
                  </div>
                ) : (
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#1C1C1E] dark:text-white select-text leading-snug tracking-tight break-words">
                    {translatedText || <span className="text-[#AEAEB2] dark:text-[#48484A] font-normal">Перевод</span>}
                  </h3>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speak(translatedText, targetLang, true)}
                    disabled={!translatedText}
                    className={`p-2 rounded-2xl transition-all duration-200 ${
                      isSpeakingTarget
                        ? 'bg-[#0071E3] text-white shadow-md scale-105'
                        : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-20'
                    }`}
                    title="Озвучить перевод"
                  >
                    <Volume2 size={18} />
                  </button>
                  <button
                    onClick={copyTranslation}
                    disabled={!translatedText}
                    className="p-2 rounded-2xl text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-20 transition-all active:scale-90"
                    title="Скопировать"
                  >
                    {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
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
                  className={`p-2.5 rounded-full transition-all active:scale-90 ${
                    isInDictionary 
                      ? 'text-amber-500 bg-amber-500/10 shadow-sm scale-105' 
                      : 'text-[#8E8E93] hover:text-amber-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                  title={isInDictionary ? "Удалить из Favorites" : "Сохранить в Favorites"}
                >
                  <Star size={20} fill={isInDictionary ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

          </div>

          {/* Quick Suggestion Chips (iOS 18 Quick Actions) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <span className="text-[11px] font-semibold text-[#8E8E93] flex items-center gap-1 flex-shrink-0 pl-1">
              <Zap size={13} className="text-amber-500" /> Быстрые фразы:
            </span>
            {QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => setSourceText(chip.text)}
                className="ios-glass hover:bg-white dark:hover:bg-white/[0.1] text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.04] dark:border-white/[0.06] flex-shrink-0 transition-all hover:scale-105 active:scale-95 text-[#1C1C1E] dark:text-[#F5F5F7]"
              >
                {chip.label}
              </button>
            ))}
          </div>

        </section>

        {/* ================= СЕКЦИЯ 2: FAVORITES (APPLE NOTES & FLASHCARDS) ================= */}
        <section className="space-y-4 pt-2">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Star size={18} className="text-amber-500" fill="currentColor" />
              <h2 className="text-lg font-bold tracking-tight text-[#1C1C1E] dark:text-white">
                Favorites
              </h2>
              {totalEntries > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#8E8E93]">
                  {totalEntries}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              
              {/* Study Mode Button (Apple Flashcards) */}
              {entries.length > 0 && (
                <button
                  onClick={() => { setCurrentCardIndex(0); setIsCardFlipped(false); setFlashcardModal(true); }}
                  className="text-xs font-semibold text-white bg-gradient-to-r from-[#0071E3] to-[#5E5CE6] hover:opacity-90 px-3.5 py-1.5 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCw size={13} /> Учить слова
                </button>
              )}

              {/* View Mode Toggle (List vs Grid) */}
              <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-[#2C2C2E] text-[#0071E3] shadow-sm' : 'text-[#8E8E93]'}`}
                  title="Список"
                >
                  <ListFilter size={14} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-[#2C2C2E] text-[#0071E3] shadow-sm' : 'text-[#8E8E93]'}`}
                  title="Сетка"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>

              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-2xl text-xs font-semibold transition-all ${
                  showSearch 
                    ? 'bg-[#0071E3] text-white shadow-sm' 
                    : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.06]'
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
                    className="appearance-none bg-black/[0.04] dark:bg-white/[0.06] text-xs font-semibold px-3 py-1.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] focus:outline-none cursor-pointer pr-6 text-[#1C1C1E] dark:text-white"
                  >
                    <option value="" className="dark:bg-[#1C1C1E]">Все теги</option>
                    {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-[#8E8E93]">▾</span>
                </div>
              )}

              <button
                onClick={() => setNewCatModal(true)}
                className="text-xs font-semibold text-[#0071E3] hover:text-[#0077ED] bg-[#0071E3]/10 hover:bg-[#0071E3]/15 px-3 py-1.5 rounded-2xl transition-all whitespace-nowrap"
              >
                + Тег
              </button>
            </div>
          </div>

          {/* Spotlight Search Bar */}
          {showSearch && (
            <div className="relative animate-in fade-in duration-200">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
              <input
                type="text"
                placeholder="Поиск по сохраненным карточкам..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/40 shadow-sm"
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
              // List View
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
                        className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        title="Озвучить"
                      >
                        <Volume2 size={16} />
                      </button>
                      <button
                        onClick={() => setEditingEntry(item)}
                        className="text-[#8E8E93] hover:text-[#0071E3] p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                        title="Редактировать"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => deleteFavorite(item.id)}
                        className="text-amber-500 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-500/10 transition-colors"
                        title="Удалить из Favorites"
                      >
                        <Star size={17} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Grid View (iOS 18 Widget Cards)
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
                          className="text-amber-500 hover:text-rose-500 p-1"
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
                          className="text-[#8E8E93] hover:text-[#0071E3] p-1.5 rounded-lg transition-colors"
                        >
                          <Volume2 size={16} />
                        </button>
                        <button
                          onClick={() => setEditingEntry(item)}
                          className="text-[#8E8E93] hover:text-[#0071E3] p-1.5 rounded-lg transition-colors"
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
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="hover:text-[#0071E3] disabled:opacity-20 px-2 py-1 transition-colors">← Назад</button>
                <span className="bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 rounded-full">{page} из {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="hover:text-[#0071E3] disabled:opacity-20 px-2 py-1 transition-colors">Вперед →</button>
              </div>
            )}

            <button
              onClick={() => {
                if (!user) { setAuthModal('login'); return; }
                setManualModal(true);
              }}
              className="w-full py-3 text-center text-xs font-semibold text-[#8E8E93] hover:text-[#0071E3] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-2xl transition-all flex items-center justify-center gap-1.5"
            >
              <PlusCircle size={14} />
              Добавить карточку вручную
            </button>
          </div>
        </section>

      </main>

      {/* ================= iOS 18 FLASHCARDS STUDY MODAL ================= */}
      {flashcardModal && currentFlashcard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between text-white px-2">
              <span className="text-xs font-bold tracking-wider uppercase opacity-80">
                Карточка {currentCardIndex + 1} из {entries.length}
              </span>
              <button 
                onClick={() => setFlashcardModal(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 3D Flip Card */}
            <div 
              onClick={() => setIsCardFlipped(!isCardFlipped)}
              className="perspective-1000 w-full h-72 cursor-pointer select-none"
            >
              <div className={`w-full h-full duration-500 transform-style-3d relative transition-transform ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front Side */}
                <div className="ios-glass ios-card-specular rounded-[36px] p-8 w-full h-full flex flex-col justify-between absolute inset-0 backface-hidden shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] uppercase tracking-wider">
                      Оригинал ({currentFlashcard.source_lang})
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(currentFlashcard.source_text, currentFlashcard.source_lang); }}
                      className="p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                    >
                      <Volume2 size={20} className="text-[#8E8E93]" />
                    </button>
                  </div>

                  <div className="text-center py-4">
                    <p className="text-3xl font-extrabold tracking-tight text-[#1C1C1E] dark:text-white">
                      {currentFlashcard.source_text}
                    </p>
                  </div>

                  <p className="text-center text-xs text-[#8E8E93] font-medium">
                    Нажмите, чтобы перевернуть карточку ↺
                  </p>
                </div>

                {/* Back Side */}
                <div className="ios-glass ios-card-specular rounded-[36px] p-8 w-full h-full flex flex-col justify-between absolute inset-0 backface-hidden rotate-y-180 shadow-2xl border-2 border-[#0071E3]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Перевод ({currentFlashcard.target_lang})
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(currentFlashcard.translated_text, currentFlashcard.target_lang, true); }}
                      className="p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                    >
                      <Volume2 size={20} className="text-[#8E8E93]" />
                    </button>
                  </div>

                  <div className="text-center py-4">
                    <p className="text-3xl font-extrabold tracking-tight text-[#0071E3]">
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

            {/* Flashcard Navigation Controls */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                disabled={currentCardIndex <= 0}
                onClick={() => { setCurrentCardIndex(i => i - 1); setIsCardFlipped(false); }}
                className="ios-glass flex-1 py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-30 flex items-center justify-center gap-1 text-[#1C1C1E] dark:text-white"
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
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white flex-1 py-3.5 rounded-2xl font-semibold text-sm shadow-md flex items-center justify-center gap-1 transition-all"
              >
                {currentCardIndex < entries.length - 1 ? 'Дальше' : 'Завершить'} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= APPLE SHEETS (MODALS) ================= */}

      {/* Auth Modal */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[36px] p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative">
            <button onClick={() => setAuthModal(null)} className="absolute right-5 top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"><X size={18} /></button>
            
            <h3 className="text-xl font-bold tracking-tight mb-1 text-[#1C1C1E] dark:text-white">
              {authModal === 'login' ? 'Вход в аккаунт' : authModal === 'register' ? 'Регистрация' : 'Двухфакторная защита'}
            </h3>
            <p className="text-xs text-[#8E8E93] mb-5">
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
                    <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none transition-all text-[#1C1C1E] dark:text-white" placeholder="user@gmail.com" />
                  </div>
                </div>
              )}
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Пароль (мин. 8 знаков, цифра, заглавная)</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none transition-all text-[#1C1C1E] dark:text-white" placeholder="••••••••" />
                  </div>
                </div>
              )}
              {authModal === 'register' && (
                <div>
                  <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Повтор пароля</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" />
                    <input type="password" required value={authPasswordConfirm} onChange={e => setAuthPasswordConfirm(e.target.value)} className="w-full pl-10 pr-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] focus:outline-none transition-all text-[#1C1C1E] dark:text-white" placeholder="••••••••" />
                  </div>
                </div>
              )}

              {/* QR-CODE MODAL */}
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
                      className="w-full py-3 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-center font-bold text-2xl tracking-[0.4em] border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white" 
                      placeholder="000000" 
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold py-3 rounded-2xl text-sm transition-all shadow-[0_4px_14px_rgba(0,113,227,0.35)] active:scale-[0.98] mt-3">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[36px] p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative">
            <button onClick={() => setManualModal(false)} className="absolute right-5 top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"><X size={18} /></button>
            <h3 className="text-lg font-bold tracking-tight mb-4 text-[#1C1C1E] dark:text-white">Новая карточка словаря</h3>
            <form onSubmit={handleManualAdd} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Слово / Оригинал</label>
                <input type="text" required value={manualForm.source_text} onChange={e => setManualForm({...manualForm, source_text: e.target.value})} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Перевод</label>
                <input type="text" required value={manualForm.translated_text} onChange={e => setManualForm({...manualForm, translated_text: e.target.value})} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Категория</label>
                <select value={manualForm.category_id} onChange={e => setManualForm({...manualForm, category_id: e.target.value})} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white">
                  <option value="" className="dark:bg-[#1C1C1E]">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-[0.98] mt-2">
                Сохранить в Favorites
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[36px] p-7 w-full max-w-xs border border-black/10 dark:border-white/10 shadow-2xl relative">
            <button onClick={() => setNewCatModal(false)} className="absolute right-5 top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"><X size={18} /></button>
            <h3 className="text-lg font-bold tracking-tight mb-4 text-[#1C1C1E] dark:text-white">Новый тег</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <input type="text" required placeholder="Например: Работа" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white" />
              <div className="flex items-center gap-3 bg-black/[0.04] dark:bg-white/[0.06] p-2 rounded-2xl">
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-8 w-10 border-none bg-transparent cursor-pointer rounded-lg" />
                <span className="text-xs font-mono font-semibold text-[#8E8E93]">{newCatColor}</span>
              </div>
              <button type="submit" className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-[0.98] mt-2">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="ios-glass ios-card-specular rounded-[36px] p-7 w-full max-w-sm border border-black/10 dark:border-white/10 shadow-2xl relative">
            <button onClick={() => setEditingEntry(null)} className="absolute right-5 top-5 text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white p-1 rounded-full"><X size={18} /></button>
            <h3 className="text-lg font-bold tracking-tight mb-1 text-[#1C1C1E] dark:text-white">Редактировать</h3>
            <p className="text-xs text-[#8E8E93] mb-4">Оригинал: <span className="font-semibold text-[#1C1C1E] dark:text-white">{editingEntry.source_text}</span></p>
            <form onSubmit={handleEditEntry} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Перевод</label>
                <input type="text" required value={editingEntry.translated_text} onChange={e => setEditingEntry({...editingEntry, translated_text: e.target.value})} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">Категория</label>
                <select value={editingEntry.category_id || ''} onChange={e => setEditingEntry({...editingEntry, category_id: e.target.value || null})} className="w-full px-3.5 py-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl text-sm border border-transparent focus:border-[#0071E3] focus:outline-none text-[#1C1C1E] dark:text-white">
                  <option value="" className="dark:bg-[#1C1C1E]">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id} className="dark:bg-[#1C1C1E]">{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-[0.98] mt-2">
                Сохранить изменения
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}