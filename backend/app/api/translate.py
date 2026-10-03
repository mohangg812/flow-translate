import re
import html
import socket
import ipaddress
from urllib.parse import urlparse, urljoin
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
from app.core.rate_limit import translate_rate_limiter, url_extract_rate_limiter

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


@router.post("", response_model=TranslateResponse, status_code=status.HTTP_200_OK, summary="Перевести текст", dependencies=[Depends(translate_rate_limiter)])
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


def validate_safe_url(url: str) -> None:
    """
    Защита от SSRF:
    1. Проверяет допустимость протокола (только http/https).
    2. Разрешает DNS-имя в IP-адреса.
    3. Блокирует обращения к локальным, приватным и cloud metadata адресам.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Некорректный формат URL")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Разрешены только протоколы http:// и https://")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="В URL отсутствует корректное имя хоста")

    low_host = hostname.lower().strip()
    if low_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
        raise HTTPException(status_code=400, detail="Доступ к внутренним ресурсам сервера заблокирован (SSRF protection)")

    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Не удалось разрешить DNS-имя сайта")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Ошибка проверки адреса: {str(exc)}")

    for item in addr_info:
        ip_str = item[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
                ip = ip.ipv4_mapped

            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
                or str(ip) in ("169.254.169.254", "0.0.0.0")
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Доступ к приватным и локальным IP-адресам запрещен политикой безопасности (SSRF)"
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Недопустимый IP-адрес хоста")


@router.post(
    "/extract-url",
    response_model=UrlExtractResponse,
    summary="Извлечь текст со страницы по ссылке",
    dependencies=[Depends(url_extract_rate_limiter)]
)
async def extract_url_text(payload: UrlExtractRequest):
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    current_url = url
    max_redirects = 5
    raw_html = ""

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        for _ in range(max_redirects):
            validate_safe_url(current_url)
            try:
                response = await client.get(current_url, headers=headers)
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Превышено время ожидания ответа от сайта")
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Не удалось загрузить сайт: {str(exc)}")

            if response.is_redirect:
                redirect_target = response.headers.get("Location")
                if not redirect_target:
                    break
                current_url = urljoin(current_url, redirect_target)
                continue

            if response.status_code >= 400:
                raise HTTPException(status_code=400, detail=f"Сайт вернул ошибку {response.status_code}")

            raw_html = response.text
            break
        else:
            raise HTTPException(status_code=400, detail="Слишком много перенаправлений (redirect loop)")

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

    # Ограничиваем первыми 1800 символами для перевода
    if len(extracted_text) > 1800:
        extracted_text = extracted_text[:1800] + "..."

    return UrlExtractResponse(url=current_url, title=title, text=extracted_text)