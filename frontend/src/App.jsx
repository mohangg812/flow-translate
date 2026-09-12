import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { 
  Volume2, Star, Edit3, Search, LogOut, 
  ArrowRightLeft, X, Shield, RefreshCw, Check, Sun, Moon, Copy 
  // [FIX #18] Убраны неиспользуемые импорты: Trash2, Plus
} from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

// [FIX #14] Хук debounce — задержка перед отправкой запросов (убирает спам при поиске)
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('flow_theme') || 'light');
  const [user, setUser] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  
  // Авторизация и Google Authenticator
  const [authModal, setAuthModal] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Переводчик
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ru');
  const [sourceText, setSourceText] = useState('Apple');
  const [translatedText, setTranslatedText] = useState('Яблоко');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isInDictionary, setIsInDictionary] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Favorites
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
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Админка
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  // [FIX #8] Ref для AbortController — отмена предыдущего запроса перевода
  const translateAbortRef = useRef(null);

  // [FIX #9] Debounce поиска — 400мс задержки вместо мгновенного запроса на каждый символ
  const debouncedSearch = useDebounce(search, 400);

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

  const speak = (text, langCode) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const map = { ru: 'ru-RU', en: 'en-US', de: 'de-DE', es: 'es-ES' };
    utterance.lang = map[langCode] || 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Авто-перевод (Google Translate Style)
  // [FIX #8] Добавлен AbortController для отмены предыдущих запросов (race condition)
  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setTranslatedText('');
      setIsInDictionary(false);
      setSavedEntryId(null);
      return;
    }

    const timer = setTimeout(async () => {
      // Отменяем предыдущий запрос, если он ещё в полёте
      if (translateAbortRef.current) {
        translateAbortRef.current.abort();
      }
      const controller = new AbortController();
      translateAbortRef.current = controller;

      setIsTranslating(true);
      try {
        const res = await api.post('/translate', {
          text: text,
          source_lang: sourceLang,
          target_lang: targetLang,
        }, { signal: controller.signal });
        setTranslatedText(res.data.translated_text);
        setIsInDictionary(res.data.is_saved_in_dictionary);
        setSavedEntryId(res.data.saved_entry_id);
      } catch (err) {
        // Игнорируем ошибки отмены (AbortError)
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error(err);
        }
      } finally {
        setIsTranslating(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang]);

  const swapLanguages = () => {
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

  // [FIX #16] loadFavorites обёрнута в useCallback для стабильной ссылки
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

  // [FIX #22] Загрузка категорий вынесена в отдельный useEffect — не спамит при смене страницы/фильтра
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

  // [FIX #7] Отдельный обработчик для РЕДАКТИРОВАНИЯ карточки (ранее использовался handleManualAdd — баг)
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
      loadCategories(); // Перезагрузить категории после создания
      loadFavorites();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    }
  };

  // Авторизация через Google Authenticator
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

  // [FIX #15] Добавлен user в зависимости useEffect (ранее отсутствовал — stale closure)
  useEffect(() => {
    if (showAdmin && user?.role === 'admin') loadAdminData();
  }, [showAdmin, user]);

  const toggleUserStatus = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-status`);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F4EFE6] dark:bg-[#16181B] text-[#1E1B18] dark:text-[#E8E5DF] transition-colors duration-300 font-sans pb-28 overflow-x-hidden selection:bg-[#E5D7C2] selection:text-black">
      
      {/* ================= ФОН: ЛЕНТЫ FLOW ================= */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[42rem] h-[42rem] rounded-full bg-[#EADECF]/90 dark:bg-amber-950/15 blur-[120px]" />
        <div className="absolute top-1/3 -right-32 w-[46rem] h-[46rem] rounded-full bg-[#E4D4C0]/80 dark:bg-indigo-950/20 blur-[130px]" />
        <div className="absolute -bottom-32 left-1/4 w-[40rem] h-[40rem] rounded-full bg-[#E8DACB]/75 dark:bg-purple-950/15 blur-[120px]" />

        <svg className="absolute inset-0 w-full h-full opacity-65 dark:opacity-25" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none">
          <path d="M-150 120 C 150 40, 350 360, 480 200 C 600 50, 750 250, 850 180" stroke="#DCD0BE" strokeWidth="60" strokeLinecap="round" opacity="0.4" />
          <path d="M-100 480 C 180 320, 380 620, 620 420 C 780 280, 920 480, 1020 400" stroke="#E3D7C5" strokeWidth="85" strokeLinecap="round" opacity="0.5" />
          <path d="M650 780 C 880 580, 1150 820, 1380 640 C 1500 540, 1600 680, 1700 650" stroke="#DACDB8" strokeWidth="95" strokeLinecap="round" opacity="0.45" />
          <path d="M850 150 C 1050 50, 1250 320, 1450 180 C 1550 100, 1650 220, 1750 180" stroke="#E6DAC9" strokeWidth="45" strokeLinecap="round" opacity="0.4" />
        </svg>
      </div>

      {/* ================= ШАПКА ================= */}
      <header className="max-w-4xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center font-black text-2xl tracking-tighter text-[#1C1A17] dark:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16M4 12h12M4 20h8"/>
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#1C1A17] dark:text-white">Flow</span>
        </div>

        <h1 className="text-xl font-bold text-[#1C1A17] dark:text-white tracking-tight hidden sm:block">
          Flow Translate
        </h1>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold tracking-wider text-[#8A847B] dark:text-[#9A968F]">
            RU | EN
          </span>

          <div className="flex items-center bg-[#E6DFD4] dark:bg-[#202227] p-1 rounded-full border border-[#D5CBBF] dark:border-[#2C2F36] shadow-inner">
            <button
              onClick={() => toggleTheme('light')}
              className={`p-1.5 rounded-full transition-all duration-200 ${
                theme === 'light' ? 'bg-white text-amber-500 shadow-[0_2px_8px_rgba(0,0,0,0.1)]' : 'text-[#8A847B] hover:text-black'
              }`}
              title="Светлая тема"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => toggleTheme('dark')}
              className={`p-1.5 rounded-full transition-all duration-200 ${
                theme === 'dark' ? 'bg-[#121316] text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'text-[#8A847B] hover:text-white'
              }`}
              title="Темная тема"
            >
              <Moon size={14} />
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <button
                  onClick={() => setShowAdmin(!showAdmin)}
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${
                    showAdmin ? 'bg-[#1C1A17] text-white dark:bg-white dark:text-black' : 'text-[#8A847B] hover:text-black dark:hover:text-white'
                  }`}
                  title="Панель администратора"
                >
                  <Shield size={16} />
                </button>
              )}
              <span className="text-xs font-semibold text-[#8A847B] hidden md:inline">{user.email.split('@')[0]}</span>
              <button
                onClick={() => { localStorage.removeItem('flow_token'); setUser(null); }}
                className="text-[#8A847B] hover:text-rose-500 p-1.5 transition-colors"
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthModal('login'); setAuthError(''); }}
              className="text-xs font-bold tracking-wide bg-[#1C1A17] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 px-4 py-2 rounded-full transition-all shadow-md active:scale-95"
            >
              Войти
            </button>
          )}
        </div>
      </header>

      {/* ================= ОСНОВНОЙ БЛОК ================= */}
      <main className="max-w-4xl mx-auto px-6 mt-4 space-y-9">

        {/* АДМИНКА */}
        {showAdmin && user?.role === 'admin' && (
          <div className="bg-[#EBE4D8] dark:bg-[#1C1E22] p-6 rounded-[28px] border border-[#D5CBBF] dark:border-[#2C2E33] space-y-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-wider uppercase text-[#736E66] dark:text-[#A09B93]">Административная панель</h3>
              <button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-black dark:hover:text-white"><X size={16} /></button>
            </div>
            {adminStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#25282D] p-4 rounded-2xl border border-[#DED4C5] dark:border-transparent shadow-sm">
                  <span className="text-[10px] font-bold text-[#8A847B] uppercase">Пользователи</span>
                  <p className="text-2xl font-black mt-0.5">{adminStats.total_users}</p>
                </div>
                <div className="bg-white dark:bg-[#25282D] p-4 rounded-2xl border border-[#DED4C5] dark:border-transparent shadow-sm">
                  <span className="text-[10px] font-bold text-[#8A847B] uppercase">Активные</span>
                  <p className="text-2xl font-black text-emerald-600 mt-0.5">{adminStats.active_users}</p>
                </div>
                <div className="bg-white dark:bg-[#25282D] p-4 rounded-2xl border border-[#DED4C5] dark:border-transparent shadow-sm">
                  <span className="text-[10px] font-bold text-[#8A847B] uppercase">Слов в базе</span>
                  <p className="text-2xl font-black text-indigo-600 mt-0.5">{adminStats.total_saved_words}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= СЕКЦИЯ 1: TRANSLATION ================= */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1C1A17] dark:text-white tracking-tight">
              Translation
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="appearance-none bg-[#E7E0D5] dark:bg-[#202227] hover:bg-[#DFD7C9] text-xs font-semibold px-4 py-1.5 rounded-xl border border-[#D3C8B9] dark:border-[#2C2F36] cursor-pointer transition-colors pr-6 focus:outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>[ {l.label} ]</option>)}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-[#8A847B]">▼</span>
              </div>

              <button
                onClick={swapLanguages}
                className="p-1.5 text-[#736E66] dark:text-[#9A968F] hover:text-[#1C1A17] dark:hover:text-white transition-colors"
                title="Поменять языки местами"
              >
                <ArrowRightLeft size={14} />
              </button>

              <div className="relative">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="appearance-none bg-[#E7E0D5] dark:bg-[#202227] hover:bg-[#DFD7C9] text-xs font-semibold px-4 py-1.5 rounded-xl border border-[#D3C8B9] dark:border-[#2C2F36] cursor-pointer transition-colors pr-6 focus:outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>[ {l.label} ]</option>)}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-[#8A847B]">▼</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левая карточка: Ввод */}
            <div className="bg-white dark:bg-[#1E2024] rounded-[28px] p-6 min-h-[175px] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.05)] border border-[#E5DDD0] dark:border-[#2C2F36] flex flex-col justify-between">
              <div>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Text to Translate"
                  rows={2}
                  className="w-full text-3xl font-extrabold bg-transparent border-none resize-none focus:outline-none placeholder-[#B8B0A3] dark:placeholder-[#555861] leading-snug"
                />
                <span className="text-xs text-[#999285] dark:text-[#787A80] block mt-1 font-medium">
                  Text to Translate
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F5EFE4] dark:border-[#25282E]">
                <span className="text-[10px] text-[#AAA396] dark:text-[#65676B] font-medium">
                  {isTranslating ? 'Translating...' : 'Auto-translate active'}
                </span>

                <button
                  onClick={() => speak(sourceText, sourceLang)}
                  disabled={!sourceText.trim()}
                  className="text-[#999285] hover:text-[#1E1B18] dark:hover:text-white disabled:opacity-20 transition-colors p-1"
                  title="Озвучить оригинал"
                >
                  <Volume2 size={20} />
                </button>
              </div>
            </div>

            {/* Правая карточка: Перевод */}
            <div className="bg-[#ECE4D8] dark:bg-[#23262B] rounded-[28px] p-6 min-h-[175px] border border-[#DDD3C4] dark:border-[#2E3138] flex flex-col justify-between shadow-[0_8px_30px_-5px_rgba(0,0,0,0.04)]">
              <div>
                {isTranslating ? (
                  <div className="flex items-center gap-2 text-[#8A847B] py-1 font-medium text-sm">
                    <RefreshCw size={16} className="animate-spin text-indigo-500" />
                    <span>Переводим...</span>
                  </div>
                ) : (
                  <h3 className="text-3xl font-extrabold text-[#1C1A17] dark:text-white select-text leading-snug break-words">
                    {translatedText || <span className="text-[#AEA596] dark:text-[#555861]">Перевод</span>}
                  </h3>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DFD5C5] dark:border-[#2B2E35]">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speak(translatedText, targetLang)}
                    disabled={!translatedText}
                    className="text-[#999285] hover:text-[#1E1B18] dark:hover:text-white disabled:opacity-20 transition-colors p-1"
                    title="Озвучить перевод"
                  >
                    <Volume2 size={20} />
                  </button>
                  <button
                    onClick={copyTranslation}
                    disabled={!translatedText}
                    className="text-[#999285] hover:text-[#1E1B18] dark:hover:text-white disabled:opacity-20 transition-colors p-1"
                    title="Скопировать"
                  >
                    {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>

                <button
                  onClick={toggleFavorite}
                  disabled={!translatedText}
                  className={`p-1.5 rounded-full transition-all active:scale-90 ${
                    isInDictionary ? 'text-amber-500 hover:scale-110' : 'text-[#999285] hover:text-amber-500'
                  }`}
                  title={isInDictionary ? "Удалить из Favorites" : "Сохранить в Favorites"}
                >
                  <Star size={22} fill={isInDictionary ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ================= СЕКЦИЯ 2: FAVORITES ================= */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#1C1A17] dark:text-white tracking-tight">
              Favorites
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  showSearch ? 'bg-[#DDD3C4] text-black' : 'text-[#8A847B] hover:text-black dark:hover:text-white'
                }`}
                title="Поиск"
              >
                <Search size={15} />
              </button>

              {categories.length > 0 && (
                <select
                  value={filterCat}
                  onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
                  className="bg-[#E7E0D5] dark:bg-[#202227] text-xs font-semibold px-3 py-1 rounded-xl border border-[#D3C8B9] dark:border-[#2C2F36] focus:outline-none"
                >
                  <option value="">Все теги</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}

              <button
                onClick={() => setNewCatModal(true)}
                className="text-xs font-bold text-[#736E66] dark:text-[#9A968F] hover:text-black dark:hover:text-white px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
              >
                + Тег
              </button>
            </div>
          </div>

          {showSearch && (
            <input
              type="text"
              placeholder="Поиск по сохраненным словам..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E2024] border border-[#D8CEBF] dark:border-[#2C2F36] rounded-2xl text-sm focus:outline-none shadow-sm"
            />
          )}

          <div className="bg-[#ECE4D8] dark:bg-[#1E2024] rounded-[28px] p-3 sm:p-3.5 border border-[#DDD3C4] dark:border-[#2C2F36] space-y-2 shadow-[0_8px_30px_-5px_rgba(0,0,0,0.03)]">
            {entries.length === 0 ? (
              <div className="py-10 text-center text-xs font-medium text-[#999285]">
                {user ? "Нет сохраненных слов в Favorites. Нажмите звездочку на карточке перевода!" : "Войдите в аккаунт, чтобы сохранять слова в Favorites"}
              </div>
            ) : (
              entries.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#25282D] px-6 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3 group hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all border border-[#EAE1D3]/70 dark:border-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-bold text-base text-[#1C1A17] dark:text-white truncate">
                      {item.source_text}
                    </span>
                    <span className="text-[#8A847B] font-light flex-shrink-0">→</span>
                    <span className="font-semibold text-base text-[#1C1A17] dark:text-white truncate">
                      {item.translated_text}
                    </span>

                    {item.category_name && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ backgroundColor: item.category_color || '#6366F1' }}
                      >
                        {item.category_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => speak(item.translated_text, item.target_lang)}
                      className="text-[#999285] hover:text-black dark:hover:text-white p-1 transition-colors"
                      title="Озвучить"
                    >
                      <Volume2 size={16} />
                    </button>
                    <button
                      onClick={() => setEditingEntry(item)}
                      className="text-[#999285] hover:text-indigo-600 p-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      title="Редактировать"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => deleteFavorite(item.id)}
                      className="text-amber-500 hover:text-rose-500 p-1 transition-colors"
                      title="Удалить из Favorites"
                    >
                      <Star size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-2 text-xs font-semibold text-[#8A847B]">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="hover:text-black dark:hover:text-white disabled:opacity-30">← Назад</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="hover:text-black dark:hover:text-white disabled:opacity-30">Вперед →</button>
              </div>
            )}

            <button
              onClick={() => {
                if (!user) { setAuthModal('login'); return; }
                setManualModal(true);
              }}
              className="w-full py-2.5 text-center text-xs font-bold text-[#6B665E] dark:text-[#9A968F] hover:text-[#1C1A17] dark:hover:text-white transition-colors"
            >
              Add manual entry
            </button>
          </div>
        </section>

      </main>

      {/* ================= МОДАЛЬНЫЕ ОКНА ================= */}

      {/* Модалка логина / регистрации / Google Authenticator */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] dark:bg-[#1A1C1F] rounded-3xl p-6 w-full max-w-sm border border-[#D5CBBF] dark:border-[#2C2F36] shadow-2xl relative">
            <button onClick={() => setAuthModal(null)} className="absolute right-4 top-4 text-[#8A847B] hover:text-black"><X size={18} /></button>
            <h3 className="text-lg font-bold mb-3">
              {authModal === 'login' ? 'Вход в аккаунт' : authModal === 'register' ? 'Регистрация' : 'Двухфакторная защита'}
            </h3>

            {authError && <div className="p-2.5 mb-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold">{authError}</div>}
            {authSuccess && <div className="p-2.5 mb-3 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold">{authSuccess}</div>}

            <form onSubmit={handleAuth} className="space-y-3">
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[10px] font-bold text-[#8A847B] uppercase">Email</label>
                  <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full mt-1 p-2.5 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] dark:border-[#33363D] focus:outline-none" placeholder="user@gmail.com" />
                </div>
              )}
              {authModal !== 'verify' && (
                <div>
                  <label className="text-[10px] font-bold text-[#8A847B] uppercase">Пароль (мин. 8 знаков, цифра, заглавная)</label>
                  <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full mt-1 p-2.5 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] dark:border-[#33363D] focus:outline-none" placeholder="••••••••" />
                </div>
              )}
              {authModal === 'register' && (
                <div>
                  <label className="text-[10px] font-bold text-[#8A847B] uppercase">Повтор пароля</label>
                  <input type="password" required value={authPasswordConfirm} onChange={e => setAuthPasswordConfirm(e.target.value)} className="w-full mt-1 p-2.5 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] dark:border-[#33363D] focus:outline-none" placeholder="••••••••" />
                </div>
              )}

              {/* ПОКАЗ QR-КОДА ДЛЯ GOOGLE AUTHENTICATOR */}
              {authModal === 'verify' && (
                <div className="space-y-3 text-center">
                  {qrCodeUrl && (
                    <div className="bg-white p-3 rounded-2xl inline-block border border-[#D5CBBF] shadow-sm">
                      <img src={qrCodeUrl} alt="QR Code Google Authenticator" className="w-44 h-44 mx-auto" />
                    </div>
                  )}
                  <div className="text-xs text-[#736E66] dark:text-[#A09B93] leading-relaxed">
                    Отсканируйте QR-код в <b>Google Authenticator</b> на смартфоне и введите 6-значный код:
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#8A847B] uppercase block text-left mb-1">
                      Код из приложения (6 цифр):
                    </label>
                    <input 
                      type="text" 
                      maxLength={6} 
                      required 
                      value={verifyCode} 
                      onChange={e => setVerifyCode(e.target.value)} 
                      className="w-full p-3 bg-white dark:bg-[#25282D] rounded-xl text-center font-bold text-2xl tracking-widest border border-[#D5CBBF] dark:border-[#33363D] focus:outline-none" 
                      placeholder="000000" 
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-[#1C1A17] text-white dark:bg-white dark:text-black font-bold py-2.5 rounded-xl text-sm transition-opacity hover:opacity-90 mt-2 shadow-sm">
                {authModal === 'login' ? 'Войти' : authModal === 'register' ? 'Создать аккаунт' : 'Подтвердить и войти'}
              </button>
            </form>

            <div className="mt-3 text-center text-xs text-[#8A847B]">
              {authModal === 'login' ? (
                <span>Нет аккаунта? <button onClick={() => { setAuthModal('register'); setAuthError(''); }} className="font-bold underline text-[#1C1A17] dark:text-white">Регистрация</button></span>
              ) : authModal === 'register' ? (
                <span>Уже зарегистрированы? <button onClick={() => { setAuthModal('login'); setAuthError(''); }} className="font-bold underline text-[#1C1A17] dark:text-white">Войти</button></span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Модалка Add manual entry */}
      {manualModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] dark:bg-[#1A1C1F] rounded-3xl p-6 w-full max-w-sm border border-[#D5CBBF] dark:border-[#2C2F36] shadow-xl relative">
            <button onClick={() => setManualModal(false)} className="absolute right-4 top-4 text-[#8A847B]"><X size={18} /></button>
            <h3 className="text-base font-bold mb-3">Добавить карточку в Favorites</h3>
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#8A847B] uppercase">Слово / Оригинал</label>
                <input type="text" required value={manualForm.source_text} onChange={e => setManualForm({...manualForm, source_text: e.target.value})} className="w-full mt-1 p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A847B] uppercase">Перевод</label>
                <input type="text" required value={manualForm.translated_text} onChange={e => setManualForm({...manualForm, translated_text: e.target.value})} className="w-full mt-1 p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A847B] uppercase">Категория</label>
                <select value={manualForm.category_id} onChange={e => setManualForm({...manualForm, category_id: e.target.value})} className="w-full mt-1 p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none">
                  <option value="">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#1C1A17] text-white dark:bg-white dark:text-black font-bold py-2.5 rounded-xl text-sm mt-2 shadow-sm">
                Сохранить в Favorites
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания категории */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] dark:bg-[#1A1C1F] rounded-3xl p-6 w-full max-w-xs border border-[#D5CBBF] dark:border-[#2C2F36] shadow-xl relative">
            <button onClick={() => setNewCatModal(false)} className="absolute right-4 top-4 text-[#8A847B]"><X size={18} /></button>
            <h3 className="text-base font-bold mb-3">Новый тег</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <input type="text" required placeholder="Например: Работа" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none" />
              <div className="flex items-center gap-2">
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-8 w-12 border-none bg-transparent cursor-pointer" />
                <span className="text-xs font-mono text-[#8A847B]">{newCatColor}</span>
              </div>
              <button type="submit" className="w-full bg-[#1C1A17] text-white dark:bg-white dark:text-black font-bold py-2 rounded-xl text-sm shadow-sm">
                Создать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* [FIX #7] Модалка редактирования — теперь вызывает handleEditEntry вместо handleManualAdd */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] dark:bg-[#1A1C1F] rounded-3xl p-6 w-full max-w-sm border border-[#D5CBBF] dark:border-[#2C2F36] shadow-xl relative">
            <button onClick={() => setEditingEntry(null)} className="absolute right-4 top-4 text-[#8A847B]"><X size={18} /></button>
            <h3 className="text-base font-bold mb-1">Редактировать</h3>
            <p className="text-xs text-[#8A847B] mb-3">Оригинал: <span className="font-bold text-[#1C1A17] dark:text-white">{editingEntry.source_text}</span></p>
            <form onSubmit={handleEditEntry} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#8A847B] uppercase">Перевод</label>
                <input type="text" required value={editingEntry.translated_text} onChange={e => setEditingEntry({...editingEntry, translated_text: e.target.value})} className="w-full mt-1 p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A847B] uppercase">Категория</label>
                <select value={editingEntry.category_id || ''} onChange={e => setEditingEntry({...editingEntry, category_id: e.target.value || null})} className="w-full mt-1 p-2 bg-white dark:bg-[#25282D] rounded-xl text-sm border border-[#D5CBBF] focus:outline-none">
                  <option value="">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-[#1C1A17] text-white dark:bg-white dark:text-black font-bold py-2.5 rounded-xl text-sm shadow-sm">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}