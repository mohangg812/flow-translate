import html
import re
import httpx
import logging
from typing import Optional, List, Dict
from fastapi import HTTPException, status

logger = logging.getLogger("flow_translate.translator")

class TranslationService:
    GOOGLE_URL = "https://translate.googleapis.com/translate_a/single"
    MYMEMORY_URL = "https://api.mymemory.translated.net/get"

    BROWSER_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://translate.google.com/"
    }

    @staticmethod
    def _split_into_chunks(text: str, max_chars: int = 450) -> List[str]:
        """Умное разбиение текста на смысловые блоки без разрезания предложений"""
        if len(text) <= max_chars:
            return [text]
        chunks = []
        paragraphs = text.split('\n')
        current = ''
        for p in paragraphs:
            if not p.strip():
                if current:
                    chunks.append(current)
                    current = ''
                continue
            if len(current) + len(p) + 1 <= max_chars:
                current = (current + '\n' + p) if current else p
            else:
                if current:
                    chunks.append(current)
                    current = ''
                if len(p) <= max_chars:
                    current = p
                else:
                    sentences = re.split(r'(?<=[.!?])\s+', p)
                    for s in sentences:
                        if len(current) + len(s) + 1 <= max_chars:
                            current = (current + ' ' + s) if current else s
                        else:
                            if current:
                                chunks.append(current)
                                current = ''
                            if len(s) <= max_chars:
                                current = s
                            else:
                                words = s.split(' ')
                                for w in words:
                                    if len(current) + len(w) + 1 <= max_chars:
                                        current = (current + ' ' + w) if current else w
                                    else:
                                        if current:
                                            chunks.append(current)
                                        current = w
        if current:
            chunks.append(current)
        return [c.strip() for c in chunks if c.strip()]

    @classmethod
    def _apply_tone(cls, text: str, target_lang: str, tone: str) -> str:
        if not text or tone not in ("formal", "informal"):
            return text
        
        if target_lang == "ru":
            if tone == "formal":
                replacements = [
                    (r"\bты\b", "вы"), (r"\bТы\b", "Вы"),
                    (r"\bтебе\b", "вам"), (r"\bТебе\b", "Вам"),
                    (r"\bтебя\b", "вас"), (r"\bТебя\b", "Вас"),
                    (r"\bтобой\b", "вами"), (r"\bТобой\b", "Вами"),
                    (r"\bтвой\b", "ваш"), (r"\bТвой\b", "Ваш"),
                    (r"\bтвоя\b", "ваша"), (r"\bТвоя\b", "Ваша"),
                    (r"\bтвое\b", "ваше"), (r"\bТвое\b", "Ваше"),
                    (r"\bтвои\b", "ваши"), (r"\bТвои\b", "Ваши"),
                ]
            else:
                replacements = [
                    (r"\bвы\b", "ты"), (r"\bВы\b", "Ты"),
                    (r"\bвам\b", "тебе"), (r"\bВам\b", "Тебе"),
                    (r"\bвас\b", "тебя"), (r"\bВас\b", "Тебя"),
                    (r"\bвами\b", "тобой"), (r"\bВами\b", "Тобой"),
                    (r"\bваш\b", "твой"), (r"\bВаш\b", "Твой"),
                    (r"\bваша\b", "твоя"), (r"\bВаша\b", "Твоя"),
                    (r"\bваше\b", "твое"), (r"\bВаше\b", "Твое"),
                    (r"\bваши\b", "твои"), (r"\bВаши\b", "Твои"),
                ]
            res = text
            for pat, repl in replacements:
                res = re.sub(pat, repl, res)
            return res

        elif target_lang == "de":
            if tone == "formal":
                replacements = [(r"\bdu\b", "Sie"), (r"\bdir\b", "Ihnen"), (r"\bdich\b", "Sie"), (r"\bdein\b", "Ihr")]
            else:
                replacements = [(r"\bSie\b", "du"), (r"\bIhnen\b", "dir"), (r"\bIhr\b", "dein")]
            res = text
            for pat, repl in replacements:
                res = re.sub(pat, repl, res)
            return res

        elif target_lang == "es":
            if tone == "formal":
                replacements = [(r"\btú\b", "usted"), (r"\bTú\b", "Usted"), (r"\bte\b", "le"), (r"\btu\b", "su")]
            else:
                replacements = [(r"\busted\b", "tú"), (r"\bUsted\b", "Tú"), (r"\ble\b", "te"), (r"\bsu\b", "tu")]
            res = text
            for pat, repl in replacements:
                res = re.sub(pat, repl, res)
            return res

        return text

    @classmethod
    async def _translate_single_google(cls, client: httpx.AsyncClient, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        try:
            sl = 'auto' if source_lang == 'auto' else source_lang
            params = {
                "client": "dict-chrome-ex",
                "sl": sl,
                "tl": target_lang,
                "dt": "t",
                "q": text
            }
            res = await client.get(cls.GOOGLE_URL, params=params, headers=cls.BROWSER_HEADERS, timeout=8.0)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0 and data[0]:
                    translated = ''.join(x[0] for x in data[0] if x and x[0])
                    if translated:
                        return translated
        except Exception as e:
            logger.warning(f"Google translate error: {e}")
        return None

    @classmethod
    async def _translate_single_mymemory(cls, client: httpx.AsyncClient, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        try:
            sl = 'en' if source_lang == 'auto' else source_lang
            params = {
                "q": text[:400],
                "langpair": f"{sl}|{target_lang}",
                "de": "mixa.minbak@gmail.com"
            }
            res = await client.get(cls.MYMEMORY_URL, params=params, headers=cls.BROWSER_HEADERS, timeout=8.0)
            if res.status_code == 200:
                data = res.json()
                raw = data.get("responseData", {}).get("translatedText", "")
                if raw and "QUERY LENGTH LIMIT EXCEEDED" not in raw and "MYMEMORY WARNING" not in raw:
                    return html.unescape(raw).strip()
        except Exception as e:
            logger.warning(f"MyMemory error: {e}")
        return None

    @classmethod
    async def translate_with_details(
        cls, text: str, source_lang: str, target_lang: str, tone: str = "neutral"
    ) -> Dict:
        if not text or not text.strip():
            return {"translated_text": "", "alternatives": [], "examples": [], "tone": tone}

        if source_lang == target_lang and source_lang != 'auto':
            return {"translated_text": text, "alternatives": [], "examples": [], "tone": tone}

        chunks = cls._split_into_chunks(text, max_chars=450)
        translated_chunks = []
        alternatives: List[str] = []

        async with httpx.AsyncClient(timeout=12.0, headers=cls.BROWSER_HEADERS) as client:
            for chunk in chunks:
                # 1. Попытка через Google Translate Engine (без ограничений по объему)
                chunk_trans = await cls._translate_single_google(client, chunk, source_lang, target_lang)
                
                # 2. Фолбэк на MyMemory с гарантией < 450 символов
                if not chunk_trans:
                    chunk_trans = await cls._translate_single_mymemory(client, chunk, source_lang, target_lang)

                if not chunk_trans:
                    chunk_trans = chunk  # В крайнем случае возвращаем исходный текст фрагмента

                translated_chunks.append(chunk_trans)

        combined_text = "\n\n".join(translated_chunks) if len(chunks) > 1 and "\n" in text else " ".join(translated_chunks)
        clean_main = html.unescape(combined_text).strip()

        # Применяем тональность
        final_text = cls._apply_tone(clean_main, target_lang, tone)

        return {
            "translated_text": final_text,
            "alternatives": alternatives,
            "examples": [],
            "tone": tone
        }

    @classmethod
    async def translate(cls, text: str, source_lang: str, target_lang: str) -> str:
        res = await cls.translate_with_details(text, source_lang, target_lang)
        return res["translated_text"]
