import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class ComicBubbleBbox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class ComicBubble(BaseModel):
    id: str
    text_en: str
    text_ru: str
    bbox: ComicBubbleBbox
    rel_x: float
    rel_y: float
    rel_w: float
    rel_h: float
    confidence: Optional[int] = 85


class ComicPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    comic_id: uuid.UUID
    page_number: int
    width: int
    height: int
    original_image_url: str
    translated_image_url: Optional[str] = None
    bubbles: List[Dict[str, Any]] = []
    is_processed: bool = True


class ComicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    filename: str
    format: str
    total_pages: int
    current_page: int
    created_at: datetime
    updated_at: datetime
    pages: List[ComicPageResponse] = []


class ComicListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    filename: str
    format: str
    total_pages: int
    current_page: int
    created_at: datetime
    cover_image_url: Optional[str] = None


class ComicProgressUpdate(BaseModel):
    current_page: int
