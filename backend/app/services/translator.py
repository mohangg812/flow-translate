import html
import httpx
from typing import Optional, List, Dict
from fastapi import HTTPException, status

class TranslationService:
    MYMEMORY_URL = "https://api.mymemory.translated.net/get"

    @classmethod
    def _apply_tone(cls, text: str, target_lang: str, tone: str) -> str:
        if not text or tone not in ("formal", "informal"):
            return text
        
        # Интеллектуальная адаптация местоимений и обращений
        if target_lang == "ru":
            if tone == "formal":
                # Замена неформальных местоимений на вежливые
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
            import re
            res = text
            for pat, repl in replacements:
                res = re.sub(pat, repl, res)
            return res

        elif target_lang == "de":
            import re
            if tone == "formal":
                replacements = [(r"\bdu\b", "Sie"), (r"\bdir\b", "Ihnen"), (r"\bdich\b", "Sie"), (r"\bdein\b", "Ihr")]
            else:
                replacements = [(r"\bSie\b", "du"), (r"\bIhnen\b", "dir"), (r"\bIhr\b", "dein")]
            res = text
            for pat, repl in replacements:
                res = re.sub(pat, repl, res)
            return res

        elif target_lang == "es":
            import re
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
    async def translate_with_details(
        cls, text: str, source_lang: str, target_lang: str, tone: str = "neutral"
    ) -> Dict:
        lang_pair = f"{source_lang}|{target_lang}"
        params = {
            "q": text,
            "langpair": lang_pair,
            "de": "mixa.minbak@gmail.com"
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                response = await client.get(cls.MYMEMORY_URL, params=params)
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Сервис перевода временно недоступен. Попробуйте позже."
                    )
                
                data = response.json()
                raw_translated = data.get("responseData", {}).get("translatedText")

                if not raw_translated:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Не удалось получить перевод от внешнего сервиса"
                    )

                clean_main = html.unescape(raw_translated).strip()
                matches = data.get("matches", []) or []

                # Извлечение уникальных альтернатив
                alternatives: List[str] = []
                examples: List[Dict[str, str]] = []
                seen_alts = {clean_main.lower()}

                # Если запрошен тон, проверим совпадения на наличие подходящей формулировки
                tone_adjusted_main = clean_main
                if tone in ("formal", "informal"):
                    for m in matches:
                        cand = html.unescape(m.get("translation", "")).strip()
                        if not cand or cand.lower() == clean_main.lower():
                            continue
                        if target_lang == "ru":
                            if tone == "formal" and any(w in cand.lower() for w in ["вы", "вам", "вас", "ваш"]):
                                tone_adjusted_main = cand
                                break
                            elif tone == "informal" and any(w in cand.lower() for w in ["ты", "тебе", "тебя", "твой"]):
                                tone_adjusted_main = cand
                                break
                    if tone_adjusted_main == clean_main:
                        tone_adjusted_main = cls._apply_tone(clean_main, target_lang, tone)

                for m in matches:
                    trans = html.unescape(m.get("translation", "")).strip()
                    src_seg = html.unescape(m.get("segment", "")).strip()

                    # Альтернативы перевода исходной фразы
                    if trans and trans.lower() not in seen_alts:
                        # Исключаем системные служебные сообщения MyMemory
                        if not any(stop in trans.lower() for stop in ["mymemory", "translated by", "warning", "machine translation"]):
                            seen_alts.add(trans.lower())
                            alternatives.append(trans)
                            if len(alternatives) >= 5:
                                break

                    # Контекстные примеры
                    if src_seg and trans and len(src_seg) > len(text) and len(examples) < 3:
                        if text.lower() in src_seg.lower() and not any(e["source"] == src_seg for e in examples):
                            examples.append({"source": src_seg, "target": trans})

                return {
                    "translated_text": tone_adjusted_main,
                    "alternatives": alternatives[:4],
                    "examples": examples[:2],
                    "tone": tone
                }

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Превышено время ожидания ответа от сервиса перевода"
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Сетевая ошибка при обращении к сервису перевода: {str(exc)}"
            )

    @classmethod
    async def translate(cls, text: str, source_lang: str, target_lang: str) -> str:
        res = await cls.translate_with_details(text, source_lang, target_lang)
        return res["translated_text"]