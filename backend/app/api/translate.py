from typing import Optional
from fastapi import APIRouter, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import User, DictionaryEntry
from app.core.security import decode_access_token
from app.schemas.translate import TranslateRequest, TranslateResponse
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
    translated = await TranslationService.translate(
        text=payload.text,
        source_lang=payload.source_lang,
        target_lang=payload.target_lang
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
        translated_text=translated,
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
        is_saved_in_dictionary=is_saved,
        saved_entry_id=saved_id
    )