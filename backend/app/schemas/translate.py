import uuid
from typing import Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_LANGUAGES = {"ru", "en", "de", "es"}

class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Исходный текст")
    source_lang: str = Field(..., description="Исходный язык (ru, en, de, es)")
    target_lang: str = Field(..., description="Целевой язык (ru, en, de, es)")

    @field_validator("text")
    @classmethod
    def validate_not_empty(cls, value: str) -> str:
        clean = value.strip()
        if not clean:
            raise ValueError("Текст не может состоять только из пробелов")
        return clean

    @field_validator("source_lang", "target_lang")
    @classmethod
    def validate_languages(cls, value: str) -> str:
        val = value.lower().strip()
        if val not in ALLOWED_LANGUAGES:
            raise ValueError(f"Язык '{value}' не поддерживается. Разрешены: {', '.join(sorted(ALLOWED_LANGUAGES))}")
        return val

    @field_validator("target_lang")
    @classmethod
    def validate_different_languages(cls, target: str, info) -> str:
        source = info.data.get("source_lang")
        if source and source.lower().strip() == target.lower().strip():
            raise ValueError("Исходный и целевой языки должны отличаться")
        return target


class TranslateResponse(BaseModel):
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    is_saved_in_dictionary: bool = False
    saved_entry_id: Optional[uuid.UUID] = None


class UrlExtractRequest(BaseModel):
    url: str = Field(..., description="URL веб-страницы для перевода")


class UrlExtractResponse(BaseModel):
    url: str
    title: str
    text: str