import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, String, Integer, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Comic(Base):
    __tablename__ = "comics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    format: Mapped[str] = mapped_column(String(20), default="cbz")
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    current_page: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Связи
    pages: Mapped[List["ComicPage"]] = relationship("ComicPage", back_populates="comic", cascade="all, delete-orphan", order_by="ComicPage.page_number")
    user: Mapped[Optional["User"]] = relationship("User")


class ComicPage(Base):
    __tablename__ = "comic_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("comics.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, default=800)
    height: Mapped[int] = mapped_column(Integer, default=1200)
    original_image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    translated_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bubbles: Mapped[list] = mapped_column(JSON, default=list)  # [{ id, text_en, text_ru, bbox, rel_x, rel_y, rel_w, rel_h, confidence }]
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)

    comic: Mapped["Comic"] = relationship("Comic", back_populates="pages")
