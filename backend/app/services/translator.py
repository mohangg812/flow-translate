import html
import httpx
from fastapi import HTTPException, status

class TranslationService:
    MYMEMORY_URL = "https://api.mymemory.translated.net/get"

    @classmethod
    async def translate(cls, text: str, source_lang: str, target_lang: str) -> str:
        lang_pair = f"{source_lang}|{target_lang}"
        params = {
            "q": text,
            "langpair": lang_pair
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
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

                # Исправление бага: декодируем HTML сущности (&quot;, &#39;, &amp;) в чистый текст
                return html.unescape(raw_translated)

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