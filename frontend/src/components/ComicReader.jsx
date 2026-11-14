import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  BookOpen, UploadCloud, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  RotateCcw, Maximize, Minimize, Volume2, Copy, Star, Check, 
  Trash2, Eye, EyeOff, Sparkles, Layers, Sliders, ArrowLeft,
  FileText, CheckCircle2, AlertCircle, RefreshCw, Loader2
} from 'lucide-react';
import api, { API_BASE_URL } from '../api';

// Base URL для статических файлов изображений
const STATIC_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export default function ComicReader({ user, onAddWordToDictionary }) {
  // State: Library & Comic
  const [comicList, setComicList] = useState([]);
  const [activeComic, setActiveComic] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingPage, setIsProcessingPage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Reader Settings
  const [viewMode, setViewMode] = useState('translated'); // 'translated' | 'original' | 'burned'
  const [isPeekingOriginal, setIsPeekingOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState(null);
  const [copiedBubbleId, setCopiedBubbleId] = useState(null);
  const [savedBubbleId, setSavedBubbleId] = useState(null);

  const fileInputRef = useRef(null);
  const readerContainerRef = useRef(null);

  // Show Toast
  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Load comic list from backend
  const loadComics = useCallback(async () => {
    try {
      const res = await api.get('/comics');
      if (res.data && Array.isArray(res.data)) {
        setComicList(res.data);
      }
    } catch (_) {
      setComicList([]);
    }
  }, []);

  useEffect(() => {
    loadComics();
  }, [loadComics]);

  // Upload Comic File (CBZ, CBR, ZIP, PDF, Images)
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsLoading(true);
    setUploadProgress(0);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));

    try {
      const res = await axios.post(`${API_BASE_URL}/comics/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(localStorage.getItem('flow_token') ? { Authorization: `Bearer ${localStorage.getItem('flow_token')}` } : {})
        },
        timeout: 180000,
        onUploadProgress: (p) => {
          if (p.total) {
            setUploadProgress(Math.round((p.loaded * 100) / p.total));
          }
        }
      });

      setActiveComic(res.data);
      setCurrentPageIndex(0);
      loadComics();
      showToast(`Комикс «${res.data.title}» успешно загружен!`);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        err.message || 
        'Ошибка обработки и распознавания файла комикса'
      );
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Change page with progress persistence and on-demand translation
  const goToPage = useCallback(async (newIndex) => {
    if (!activeComic || !activeComic.pages || activeComic.pages.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(newIndex, activeComic.pages.length - 1));
    setCurrentPageIndex(clampedIndex);
    setSelectedBubble(null);

    const targetPage = activeComic.pages[clampedIndex];
    const pageNum = clampedIndex + 1;

    // Save reading progress to backend
    try {
      api.patch(`/comics/${activeComic.id}/progress`, { current_page: pageNum });
    } catch (_) {}

    // If page is not yet processed, trigger fast on-demand OCR & translation
    if (targetPage && !targetPage.is_processed) {
      setIsProcessingPage(true);
      try {
        const res = await api.post(`/comics/${activeComic.id}/pages/${pageNum}/process`);
        if (res.data) {
          setActiveComic(prev => {
            if (!prev) return prev;
            const updatedPages = [...prev.pages];
            updatedPages[clampedIndex] = res.data;
            return { ...prev, pages: updatedPages };
          });
        }
      } catch (err) {
        console.warn('Page on-demand processing error:', err);
      } finally {
        setIsProcessingPage(false);
      }
    }
  }, [activeComic]);

  // Keyboard navigation & space peek
  useEffect(() => {
    if (!activeComic) return;

    const handleKeyDown = (e) => {
      // Don't intercept if user typing in input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        goToPage(currentPageIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        goToPage(currentPageIndex - 1);
      } else if (e.key === ' ' && !e.repeat) {
        // Space to peek original
        e.preventDefault();
        setIsPeekingOriginal(true);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setSelectedBubble(null);
        if (isFullscreen) toggleFullscreen();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setIsPeekingOriginal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeComic, currentPageIndex, goToPage, isFullscreen]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!readerContainerRef.current) return;
    if (!document.fullscreenElement) {
      readerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Text-to-Speech (TTS)
  const speakBubble = (text, lang = 'ru-RU') => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Copy Bubble Text
  const copyBubble = (bubble) => {
    const textToCopy = viewMode === 'original' ? bubble.text_en : bubble.text_ru;
    navigator.clipboard.writeText(textToCopy);
    setCopiedBubbleId(bubble.id);
    showToast('Текст реплики скопирован!');
    setTimeout(() => setCopiedBubbleId(null), 2000);
  };

  // Save to Personal Dictionary
  const saveToDict = async (bubble) => {
    try {
      await api.post('/dictionary/entries', {
        source_text: bubble.text_en,
        translated_text: bubble.text_ru,
        source_lang: 'en',
        target_lang: 'ru',
        notes: `Из комикса «${activeComic.title}» (Стр. ${currentPageIndex + 1})`,
        is_favorite: true
      });
      setSavedBubbleId(bubble.id);
      showToast(`Реплика «${bubble.text_en}» добавлена в личный словарь!`);
      setTimeout(() => setSavedBubbleId(null), 2500);
    } catch (err) {
      showToast(err.response?.data?.message || 'Войдите в аккаунт для сохранения в словарь');
    }
  };

  // Delete Comic
  const handleDeleteComic = async (comicId, e) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот комикс из библиотеки?')) return;
    try {
      await api.delete(`/comics/${comicId}`);
      if (activeComic && activeComic.id === comicId) {
        setActiveComic(null);
      }
      loadComics();
      showToast('Комикс удален из библиотеки.');
    } catch (_) {}
  };

  const currentPage = activeComic?.pages?.[currentPageIndex];
  const effectiveMode = isPeekingOriginal ? 'original' : viewMode;

  // Resolve image URL
  const getPageImageUrl = () => {
    if (!currentPage) return '';
    const imgUrl = (effectiveMode === 'burned' && currentPage.translated_image_url)
      ? currentPage.translated_image_url
      : currentPage.original_image_url;
    if (!imgUrl) return '';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('blob:')) {
      return imgUrl;
    }
    return `${STATIC_BASE_URL}${imgUrl}`;
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Header / Banner */}
      <div className="ios-glass p-5 sm:p-6 rounded-[32px] border border-black/5 dark:border-white/10 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
                <BookOpen size={18} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#1C1C1E] dark:text-white flex items-center gap-2">
                Переводчик и Ридер Комиксов
                <span className="text-[10px] bg-amber-500/20 text-amber-500 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  CBZ &bull; CBR &bull; PDF
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#8E8E93] max-w-xl">
              Загрузите архив комикса или страницы: система быстро извлечет выпуски, аккуратно распознает спич-бабблы и наложит адаптивный перевод на русском языке.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="apple-btn-primary text-xs font-semibold px-5 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-lg shadow-blue-500/25 spring-press"
            >
              <UploadCloud size={15} />
              <span>Загрузить комикс</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              accept=".cbz,.cbr,.zip,.pdf,image/*"
              className="hidden"
            />
          </div>
        </div>

        {/* Loading Progress Bar */}
        {isLoading && (
          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1C1C1E] dark:text-white">
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                Распаковка, OCR распознавание бабблов и перевод страниц...
              </span>
              <span className="font-mono text-blue-500">
                {uploadProgress > 0 && uploadProgress < 100 ? `Загрузка: ${uploadProgress}%` : 'Подготовка страниц и перевод...'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(20, uploadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* ======================= ACTIVE COMIC READER VIEWPORT ======================= */}
      {activeComic && currentPage ? (
        <div 
          ref={readerContainerRef}
          className={`ios-glass rounded-[32px] border border-black/5 dark:border-white/10 overflow-hidden shadow-2xl flex flex-col ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-black' : 'min-h-[700px]'
          }`}
        >
          {/* Reader Top Toolbar */}
          <div className="px-5 py-3 border-b border-black/5 dark:border-white/10 bg-black/5 dark:bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Title & Page Selector */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveComic(null)}
                className="apple-icon-btn p-1.5 rounded-full text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white"
                title="Закрыть и вернуться к полке"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3 className="font-bold text-sm text-[#1C1C1E] dark:text-white truncate max-w-[200px] sm:max-w-md">
                  {activeComic.title}
                </h3>
                <span className="text-[11px] text-[#8E8E93]">
                  Страница {currentPageIndex + 1} из {activeComic.total_pages} &bull; Формат: {activeComic.format?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Translation Mode Selector */}
            <div className="flex items-center bg-black/5 dark:bg-white/10 p-1 rounded-2xl border border-black/5 dark:border-white/10">
              <button
                onClick={() => setViewMode('translated')}
                className={`px-3 py-1 rounded-xl font-semibold transition-all ${
                  viewMode === 'translated' ? 'bg-white text-black dark:bg-white dark:text-black shadow-sm' : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                }`}
                title="Интерактивный перевод поверх спич-бабблов"
              >
                Интерактивный перевод (RU)
              </button>
              <button
                onClick={() => setViewMode('burned')}
                className={`px-3 py-1 rounded-xl font-semibold transition-all ${
                  viewMode === 'burned' ? 'bg-white text-black dark:bg-white dark:text-black shadow-sm' : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                }`}
                title="Запеченный перевод в страницах"
              >
                Запеченный (RU)
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`px-3 py-1 rounded-xl font-semibold transition-all ${
                  viewMode === 'original' ? 'bg-white text-black dark:bg-white dark:text-black shadow-sm' : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
                }`}
                title="Оригинал на английском"
              >
                Оригинал (EN)
              </button>
            </div>

            {/* Zoom & Viewport Controls */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))}
                className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                title="Уменьшить"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-[11px] font-mono font-bold text-[#8E8E93] w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(2.2, prev + 0.2))}
                className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                title="Увеличить"
              >
                <ZoomIn size={16} />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                title="Сбросить масштаб"
              >
                <RotateCcw size={15} />
              </button>
              <button 
                onClick={toggleFullscreen}
                className="apple-icon-btn p-2 rounded-full text-[#8E8E93] hover:text-black dark:hover:text-white"
                title="Полноэкранный режим (F)"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>

          {/* Reader Canvas / Stage */}
          <div className="flex-1 bg-[#09090b] relative flex items-center justify-center overflow-auto p-4 sm:p-6 min-h-[550px]">
            
            {/* Quick Space Peek Hint */}
            <div className="absolute top-4 left-6 z-20 pointer-events-none text-[11px] font-medium bg-black/60 backdrop-blur-md text-zinc-400 px-3 py-1 rounded-full border border-white/10 hidden sm:block">
              Удерживайте <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono">Пробел</kbd> для подглядывания в оригинал &bull; Стрелки <kbd className="px-1 py-0.5 rounded bg-white/20 text-white font-mono">←</kbd> <kbd className="px-1 py-0.5 rounded bg-white/20 text-white font-mono">→</kbd> для страниц
            </div>

            {/* Page Display Container */}
            <div 
              className="relative shadow-2xl transition-transform duration-150 select-none inline-block max-w-full"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center top' }}
            >
              {/* Comic Page Image */}
              <img
                src={getPageImageUrl()}
                alt={`Page ${currentPageIndex + 1}`}
                className="rounded-xl border border-white/10 object-contain max-h-[82vh] w-auto pointer-events-none block"
              />

              {/* On-Demand Processing Spinner */}
              {isProcessingPage && (
                <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2.5 text-white">
                  <Loader2 size={32} className="animate-spin text-blue-400" />
                  <span className="text-xs font-bold bg-black/80 px-4 py-2 rounded-full border border-white/20 shadow-xl">
                    Распознавание бабблов и перевод страницы {currentPageIndex + 1}...
                  </span>
                </div>
              )}

              {/* Interactive Speech Bubbles Layer */}
              {effectiveMode === 'translated' && !isProcessingPage && currentPage.bubbles && currentPage.bubbles.map((b) => {
                const isSelected = selectedBubble?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBubble(isSelected ? null : b)}
                    style={{
                      left: `${b.rel_x}%`,
                      top: `${b.rel_y}%`,
                      width: `${b.rel_w}%`,
                      minHeight: `${b.rel_h}%`,
                    }}
                    className={`absolute z-10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex items-center justify-center text-center cursor-pointer transition-all duration-200 group ${
                      isSelected
                        ? 'bg-amber-100 text-black ring-4 ring-amber-400 shadow-2xl scale-[1.04]'
                        : 'bg-white/95 text-black hover:bg-white hover:scale-[1.02] shadow-lg border border-black/30'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[12px] font-bold leading-tight tracking-tight select-text text-zinc-900">
                      {b.text_ru || b.text_en}
                    </span>

                    {/* Subtle Translation Pin Indicator */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border border-white flex items-center justify-center opacity-70 group-hover:opacity-100">
                      <span className="text-[7px] text-white font-black">RU</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bubble Action Popover */}
            {selectedBubble && (
              <div className="fixed bottom-24 z-40 bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/15 p-4 rounded-3xl shadow-2xl max-w-md w-full mx-4 animate-in slide-in-from-bottom-3 text-white">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Sparkles size={13} />
                    Выбранный спич-баббл (Стр. {currentPageIndex + 1})
                  </span>
                  <button onClick={() => setSelectedBubble(null)} className="text-zinc-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Оригинал (EN):</span>
                    <p className="font-semibold text-zinc-200 text-sm mt-0.5">{selectedBubble.text_en}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Перевод (RU):</span>
                    <p className="font-bold text-white text-sm mt-0.5">{selectedBubble.text_ru}</p>
                  </div>
                </div>

                {/* Popover Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => speakBubble(selectedBubble.text_ru, 'ru-RU')}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center gap-1 transition"
                      title="Озвучить на русском"
                    >
                      <Volume2 size={14} />
                      <span>RU</span>
                    </button>
                    <button
                      onClick={() => speakBubble(selectedBubble.text_en, 'en-US')}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center gap-1 transition"
                      title="Озвучить оригинал"
                    >
                      <Volume2 size={14} />
                      <span>EN</span>
                    </button>
                    <button
                      onClick={() => copyBubble(selectedBubble)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 flex items-center gap-1 transition"
                      title="Скопировать"
                    >
                      {copiedBubbleId === selectedBubble.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedBubbleId === selectedBubble.id ? 'Скопировано' : 'Копия'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => saveToDict(selectedBubble)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 transition shadow"
                  >
                    {savedBubbleId === selectedBubble.id ? <Check size={14} /> : <Star size={14} />}
                    <span>{savedBubbleId === selectedBubble.id ? 'В словаре!' : 'В словарь'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reader Bottom Navigation Bar */}
          <div className="px-6 py-3.5 border-t border-black/5 dark:border-white/10 bg-black/5 dark:bg-black/40 backdrop-blur-md flex items-center justify-between gap-4 text-xs font-semibold">
            <button
              onClick={() => goToPage(currentPageIndex - 1)}
              disabled={currentPageIndex === 0}
              className="apple-btn-glass px-4 py-2 rounded-2xl flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95"
            >
              <ChevronLeft size={16} />
              <span>Предыдущая</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs">
                {currentPageIndex + 1} / {activeComic.total_pages}
              </span>
              <input
                type="range"
                min="0"
                max={Math.max(0, activeComic.total_pages - 1)}
                value={currentPageIndex}
                onChange={(e) => goToPage(parseInt(e.target.value, 10))}
                className="w-28 sm:w-48 h-1.5 bg-black/10 dark:bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <button
              onClick={() => goToPage(currentPageIndex + 1)}
              disabled={currentPageIndex >= activeComic.total_pages - 1}
              className="apple-btn-primary px-4 py-2 rounded-2xl flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 shadow-md"
            >
              <span>Следующая</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Empty / Upload Viewport */
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="ios-glass rounded-[32px] border-2 border-dashed border-black/10 dark:border-white/10 p-12 flex flex-col items-center justify-center text-center space-y-4 hover:border-blue-500/50 transition-colors cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
            <BookOpen size={30} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#1C1C1E] dark:text-white">
              Перетащите файл комикса сюда или нажмите для выбора
            </h3>
            <p className="text-xs text-[#8E8E93] max-w-sm">
              Поддерживаются форматы .CBZ, .CBR, .PDF, архивы .ZIP и графические изображения.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93]">
              Speech Bubble OCR
            </span>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93]">
              Neural Translation
            </span>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93]">
              Interactive Overlay
            </span>
          </div>
        </div>
      )}

      {/* ======================= LIBRARY SHELF ======================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-sm text-[#1C1C1E] dark:text-white flex items-center gap-2">
            <span>Библиотека комиксов</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93]">
              {comicList.length}
            </span>
          </h3>
        </div>

        {comicList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8E8E93] ios-glass rounded-[28px] border border-black/5 dark:border-white/10">
            В библиотеке пока нет комиксов. Загрузите CBZ, CBR, PDF или графический файл выше!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {comicList.map((c) => (
              <div
                key={c.id}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const res = await api.get(`/comics/${c.id}`);
                    setActiveComic(res.data);
                    setCurrentPageIndex((res.data.current_page || 1) - 1);
                  } catch (_) {}
                  finally { setIsLoading(false); }
                }}
                className="ios-glass p-4 rounded-[24px] border border-black/5 dark:border-white/10 hover:border-blue-500/40 transition-all cursor-pointer group hover-lift flex flex-col justify-between space-y-3"
              >
                <div className="aspect-[3/4] rounded-2xl bg-black/10 dark:bg-black/40 overflow-hidden relative border border-white/5">
                  {c.cover_image_url ? (
                    <img 
                      src={c.cover_image_url.startsWith('data:') || c.cover_image_url.startsWith('http') || c.cover_image_url.startsWith('blob:') ? c.cover_image_url : `${STATIC_BASE_URL}${c.cover_image_url}`} 
                      alt={c.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <BookOpen size={36} />
                    </div>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white border border-white/10">
                    {c.format}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#1C1C1E] dark:text-white truncate" title={c.title}>
                    {c.title}
                  </h4>
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">
                    {c.total_pages} {c.total_pages === 1 ? 'страница' : 'страниц'} &bull; Прогресс: {c.current_page || 1} / {c.total_pages}
                  </p>
                </div>

                {/* Reading Progress Line */}
                <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.round(((c.current_page || 1) / c.total_pages) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[10px] text-[#8E8E93]">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => handleDeleteComic(c.id, e)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Удалить из библиотеки"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
