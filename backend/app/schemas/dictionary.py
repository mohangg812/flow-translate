import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

# --- Категории ---
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Название категории")
    color_hex: str = Field("#6366F1", pattern=r"^#[0-9a-fA-F]{6}$", description="HEX-цвет бейджа")

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color_hex: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    color_hex: str
    created_at: datetime


# --- Карточки словаря ---
class DictionaryEntryCreate(BaseModel):
    source_text: str = Field(..., min_length=1)
    translated_text: str = Field(..., min_length=1)
    source_lang: str = Field(..., min_length=2, max_length=5)
    target_lang: str = Field(..., min_length=2, max_length=5)
    notes: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    is_favorite: bool = True


class DictionaryEntryUpdate(BaseModel):
    translated_text: Optional[str] = None
    notes: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    is_favorite: Optional[bool] = None


class DictionaryEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    notes: Optional[str] = None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime


class PaginatedDictionaryResponse(BaseModel):
    items: List[DictionaryEntryResponse]
    total: int
    page: int
    page_size: int = 10
    total_pages: int