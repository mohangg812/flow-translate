import uuid
import math
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, and_
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.models.models import User, Category, DictionaryEntry
from app.api.auth import get_current_user
from app.schemas.dictionary import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    DictionaryEntryCreate,
    DictionaryEntryUpdate,
    DictionaryEntryResponse,
    PaginatedDictionaryResponse
)

router = APIRouter(prefix="/dictionary", tags=["Личный словарь и Категории"])


# [FIX #19] Хелпер-функция вместо 4-кратного дублирования маппинга
def _entry_to_response(entry: DictionaryEntry) -> DictionaryEntryResponse:
    """Преобразует ORM-объект DictionaryEntry в Pydantic-ответ с данными категории."""
    return DictionaryEntryResponse(
        id=entry.id,
        user_id=entry.user_id,
        category_id=entry.category_id,
        category_name=entry.category.name if entry.category else None,
        category_color=entry.category.color_hex if entry.category else None,
        source_text=entry.source_text,
        translated_text=entry.translated_text,
        source_lang=entry.source_lang,
        target_lang=entry.target_lang,
        notes=entry.notes,
        is_favorite=entry.is_favorite,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


# [FIX #13] Экранирование спецсимволов LIKE (%, _) в поисковом запросе
def _escape_like(value: str) -> str:
    """Экранирует спецсимволы SQL LIKE, чтобы '%' и '_' искались буквально."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ==========================================
# 1. КАТЕГОРИИ
# ==========================================

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, summary="Создать категорию")
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name_clean = payload.name.strip()

    stmt = select(Category).where(
        Category.user_id == current_user.id,
        func.lower(Category.name) == name_clean.lower()
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Категория с таким именем уже существует")

    new_cat = Category(
        user_id=current_user.id,
        name=name_clean,
        color_hex=payload.color_hex
    )
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return CategoryResponse.model_validate(new_cat)


@router.get("/categories", response_model=List[CategoryResponse], summary="Список категорий пользователя")
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Category).where(Category.user_id == current_user.id).order_by(Category.name.asc())
    categories = (await db.execute(stmt)).scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.patch("/categories/{category_id}", response_model=CategoryResponse, summary="Редактировать категорию")
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    category = (await db.execute(stmt)).scalars().first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    if payload.name is not None:
        new_name = payload.name.strip()
        # Проверка: нет ли у пользователя ДРУГОЙ категории с таким же именем
        stmt_dup = select(Category).where(
            Category.user_id == current_user.id,
            func.lower(Category.name) == new_name.lower(),
            Category.id != category_id
        )
        if (await db.execute(stmt_dup)).scalars().first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Категория с таким именем уже существует")
        category.name = new_name

    if payload.color_hex is not None:
        category.color_hex = payload.color_hex

    await db.commit()
    await db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_200_OK, summary="Удалить категорию")
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    category = (await db.execute(stmt)).scalars().first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    await db.delete(category)
    await db.commit()
    return {"message": "Категория удалена (слова сохранены в общем словаре)"}


# ==========================================
# 2. КАРТОЧКИ СЛОВАРЯ
# ==========================================

@router.post("/entries", response_model=DictionaryEntryResponse, status_code=status.HTTP_201_CREATED, summary="Сохранить слово в словарь")
async def add_entry(
    payload: DictionaryEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    src_text = payload.source_text.strip()
    tr_text = payload.translated_text.strip()
    s_lang = payload.source_lang.lower().strip()
    t_lang = payload.target_lang.lower().strip()

    if payload.category_id:
        stmt_cat = select(Category).where(Category.id == payload.category_id, Category.user_id == current_user.id)
        cat = (await db.execute(stmt_cat)).scalars().first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Указанная категория не найдена")

    # --- ПРАВИЛО ДУБЛИКАТОВ (Раздел 8 ТЗ) ---
    stmt_dup = select(DictionaryEntry).where(
        DictionaryEntry.user_id == current_user.id,
        func.lower(DictionaryEntry.source_text) == src_text.lower(),
        DictionaryEntry.source_lang == s_lang,
        DictionaryEntry.target_lang == t_lang
    )
    existing_entry = (await db.execute(stmt_dup)).scalars().first()

    if existing_entry:
        existing_entry.updated_at = func.now()
        existing_entry.is_favorite = True
        existing_entry.translated_text = tr_text
        if payload.notes is not None:
            existing_entry.notes = payload.notes
        if payload.category_id is not None:
            existing_entry.category_id = payload.category_id

        await db.commit()

        stmt_reload = select(DictionaryEntry).options(joinedload(DictionaryEntry.category)).where(DictionaryEntry.id == existing_entry.id)
        entry_with_cat = (await db.execute(stmt_reload)).scalar_one()

        return _entry_to_response(entry_with_cat)

    new_entry = DictionaryEntry(
        user_id=current_user.id,
        category_id=payload.category_id,
        source_text=src_text,
        translated_text=tr_text,
        source_lang=s_lang,
        target_lang=t_lang,
        notes=payload.notes,
        is_favorite=payload.is_favorite
    )
    db.add(new_entry)
    await db.commit()

    stmt_res = select(DictionaryEntry).options(joinedload(DictionaryEntry.category)).where(DictionaryEntry.id == new_entry.id)
    entry_with_cat = (await db.execute(stmt_res)).scalar_one()

    return _entry_to_response(entry_with_cat)


@router.get("/entries", response_model=PaginatedDictionaryResponse, summary="Получить карточки словаря (Фильтры, Поиск, Пагинация 10)")
async def get_entries(
    page: int = Query(1, ge=1, description="Номер страницы"),
    page_size: int = Query(10, ge=1, le=50, description="Записей на страницу"),
    search: Optional[str] = Query(None, description="Поиск по оригиналу или переводу"),
    category_id: Optional[uuid.UUID] = Query(None, description="Фильтр по категории"),
    source_lang: Optional[str] = Query(None, description="Фильтр по языку оригинала"),
    target_lang: Optional[str] = Query(None, description="Фильтр по целевому языку"),
    is_favorite: Optional[bool] = Query(None, description="Только избранные"),
    sort_by: str = Query("created_at", pattern="^(created_at|source_text|updated_at)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    filters = [DictionaryEntry.user_id == current_user.id]

    if search and search.strip():
        # [FIX #13] Экранирование спецсимволов LIKE перед использованием в запросе
        escaped = _escape_like(search.strip())
        s = f"%{escaped}%"
        filters.append((DictionaryEntry.source_text.ilike(s)) | (DictionaryEntry.translated_text.ilike(s)))
    if category_id:
        filters.append(DictionaryEntry.category_id == category_id)
    if source_lang:
        filters.append(DictionaryEntry.source_lang == source_lang.lower().strip())
    if target_lang:
        filters.append(DictionaryEntry.target_lang == target_lang.lower().strip())
    if is_favorite is not None:
        filters.append(DictionaryEntry.is_favorite == is_favorite)

    count_stmt = select(func.count(DictionaryEntry.id)).where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0

    sort_col = getattr(DictionaryEntry, sort_by)
    order_clause = desc(sort_col) if order == "desc" else asc(sort_col)

    stmt = (
        select(DictionaryEntry)
        .options(joinedload(DictionaryEntry.category))
        .where(and_(*filters))
        .order_by(order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    entries = (await db.execute(stmt)).scalars().unique().all()

    items = [_entry_to_response(e) for e in entries]

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedDictionaryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.patch("/entries/{entry_id}", response_model=DictionaryEntryResponse, summary="Редактировать карточку")
async def update_entry(
    entry_id: uuid.UUID,
    payload: DictionaryEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DictionaryEntry).options(joinedload(DictionaryEntry.category)).where(
        DictionaryEntry.id == entry_id,
        DictionaryEntry.user_id == current_user.id
    )
    entry = (await db.execute(stmt)).scalars().first()

    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Карточка не найдена")

    # Проверяем реальные переданные поля (PATCH-семантика)
    fields = payload.model_fields_set

    if "translated_text" in fields and payload.translated_text is not None:
        entry.translated_text = payload.translated_text.strip()
    if "notes" in fields:
        entry.notes = payload.notes  # Можно обнулить в None
    if "is_favorite" in fields and payload.is_favorite is not None:
        entry.is_favorite = payload.is_favorite
    if "category_id" in fields:
        if payload.category_id is not None:
            stmt_cat = select(Category).where(Category.id == payload.category_id, Category.user_id == current_user.id)
            if not (await db.execute(stmt_cat)).scalars().first():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Категория не найдена")
            entry.category_id = payload.category_id
        else:
            entry.category_id = None  # Можно отвязать категорию!

    entry.updated_at = func.now()
    await db.commit()

    stmt_reload = select(DictionaryEntry).options(joinedload(DictionaryEntry.category)).where(DictionaryEntry.id == entry.id)
    refreshed = (await db.execute(stmt_reload)).scalar_one()

    return _entry_to_response(refreshed)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_200_OK, summary="Удалить слово из словаря")
async def delete_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DictionaryEntry).where(
        DictionaryEntry.id == entry_id,
        DictionaryEntry.user_id == current_user.id
    )
    entry = (await db.execute(stmt)).scalars().first()

    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Карточка не найдена")

    await db.delete(entry)
    await db.commit()
    return {"message": "Карточка успешно удалена из личного словаря"}