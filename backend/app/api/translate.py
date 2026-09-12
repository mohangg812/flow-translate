import re
import html
import httpx
from typing import Optional
from fastapi import APIRouter, status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import User, DictionaryEntry
from app.core.security import decode_access_token
from app.schemas.translate import TranslateRequest, TranslateResponse, UrlExtractRequest, UrlExtractResponse
from app.services.translator import TranslationService

router = APIRouter(prefix="/translate", tags=["Переводчик"])
security_optional = HTTPBearer(auto_error=False)


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    
    stmt = select(User).where(User.email == payload["sub"])
    return (await db.execute(stmt)).scalar_one_or_none()


@router.post("", response_model=TranslateResponse, status_code=status.HTTP_200_OK, summary="Перевести текст")
async def translate_text(
    payload: TranslateRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    detail_res = await TranslationService.translate_with_details(
        text=payload.text,
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
        tone=payload.tone or "neutral"
    )

    is_saved = False
    saved_id = None

    # Фаза 5 ТЗ: если пользователь залогинен, проверяем, есть ли это слово в его словаре
    if current_user:
        stmt = select(DictionaryEntry).where(
            DictionaryEntry.user_id == current_user.id,
            func.lower(DictionaryEntry.source_text) == payload.text.lower().strip(),
            DictionaryEntry.source_lang == payload.source_lang,
            DictionaryEntry.target_lang == payload.target_lang
        )
        entry = (await db.execute(stmt)).scalar_one_or_none()
        if entry:
            is_saved = True
            saved_id = entry.id

    return TranslateResponse(
        source_text=payload.text,
        translated_text=detail_res["translated_text"],
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
        tone=detail_res.get("tone", "neutral"),
        alternatives=detail_res.get("alternatives", []),
        examples=detail_res.get("examples", []),
        is_saved_in_dictionary=is_saved,
        saved_entry_id=saved_id
    )


@router.post("/extract-url", response_model=UrlExtractResponse, summary="Извлечь текст со страницы по ссылке")
async def extract_url_text(payload: UrlExtractRequest):
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            if response.status_code >= 400:
                raise HTTPException(status_code=400, detail=f"Сайт вернул ошибку {response.status_code}")
            raw_html = response.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Превышено время ожидания ответа от сайта")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось загрузить сайт: {str(exc)}")

    # Извлечение заголовка
    title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
    title = html.unescape(title_match.group(1).strip()) if title_match else "Веб-страница"

    # Удаление служебных тегов: script, style, nav, header, footer, noscript
    clean = re.sub(r"<(script|style|nav|header|footer|aside|noscript|svg)[^>]*>.*?</\1>", " ", raw_html, flags=re.IGNORECASE | re.DOTALL)
    # Замена блочных тегов на переносы строк
    clean = re.sub(r"<(p|h[1-6]|li|div|br)[^>]*>", "\n", clean, flags=re.IGNORECASE)
    # Удаление остальных HTML тегов
    clean = re.sub(r"<[^>]+>", " ", clean)
    clean = html.unescape(clean)
    # Нормализация пробелов и пустых строк
    lines = [line.strip() for line in clean.splitlines() if len(line.strip()) > 20]
    extracted_text = "\n\n".join(lines)

    if not extracted_text:
        raise HTTPException(status_code=422, detail="На странице не найдено текстового контента для перевода")

    # Ограничиваем первыми 1500 символами для перевода
    if len(extracted_text) > 1800:
        extracted_text = extracted_text[:1800] + "..."

    return UrlExtractResponse(url=url, title=title, text=extracted_text)