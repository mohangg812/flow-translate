import os
import shutil
import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import User
from app.models.comic import Comic, ComicPage
from app.schemas.comic import (
    ComicResponse,
    ComicListItemResponse,
    ComicProgressUpdate,
    ComicPageResponse
)
from app.services.comic_service import ComicService
from app.api.auth import get_current_user_optional

logger = logging.getLogger("flow_translate.comics_api")

router = APIRouter(prefix="/comics", tags=["Комиксы и Манга (Перевод и Ридер)"])

# В памяти для автономного режима (когда PostgreSQL не запущен)
_IN_MEMORY_COMICS: Dict[str, Dict[str, Any]] = {}


@router.get("/demo", response_model=ComicResponse, summary="Получить демонстрационный интерактивный комикс")
async def get_demo_comic(db: AsyncSession = Depends(get_db)):
    """
    Возвращает готовый для чтения 3-страничный цветной комикс
    с распознанными и переведенными бабблами.
    Работает как с PostgreSQL, так и автономно при выключенной БД.
    """
    demo_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    demo_data = await ComicService.create_demo_comic_files()

    try:
        stmt = select(Comic).where(Comic.id == demo_id).options(selectinload(Comic.pages))
        existing = (await db.execute(stmt)).scalars().first()

        if not existing:
            existing = Comic(
                id=demo_data["id"],
                title=demo_data["title"],
                filename=demo_data["filename"],
                format=demo_data["format"],
                total_pages=demo_data["total_pages"],
                current_page=demo_data["current_page"]
            )
            db.add(existing)
            await db.flush()

            for p in demo_data["pages"]:
                page_obj = ComicPage(
                    id=uuid.uuid4(),
                    comic_id=existing.id,
                    page_number=p["page_number"],
                    width=p["width"],
                    height=p["height"],
                    original_image_url=p["original_image_url"],
                    translated_image_url=p["translated_image_url"],
                    bubbles=p["bubbles"],
                    is_processed=True
                )
                db.add(page_obj)

            await db.commit()
            stmt = select(Comic).where(Comic.id == demo_id).options(selectinload(Comic.pages))
            existing = (await db.execute(stmt)).scalars().first()

        return existing
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), отдача демо-комикса из кэша файлов.")
        from datetime import datetime
        pages_resp = []
        for p in demo_data["pages"]:
            pages_resp.append(ComicPageResponse(
                id=uuid.uuid4(),
                comic_id=demo_id,
                page_number=p["page_number"],
                width=p["width"],
                height=p["height"],
                original_image_url=p["original_image_url"],
                translated_image_url=p["translated_image_url"],
                bubbles=p["bubbles"],
                is_processed=True
            ))

        return ComicResponse(
            id=demo_id,
            title=demo_data["title"],
            filename=demo_data["filename"],
            format=demo_data["format"],
            total_pages=demo_data["total_pages"],
            current_page=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            pages=pages_resp
        )


@router.post("/upload", response_model=ComicResponse, status_code=status.HTTP_201_CREATED, summary="Загрузить комикс (CBZ, CBR, PDF, ZIP, JPG, PNG)")
async def upload_comic(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime
    filename = file.filename or "comic.cbz"
    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = {".cbz", ".cbr", ".zip", ".pdf", ".jpg", ".jpeg", ".png", ".webp"}

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат файла: '{ext}'. Поддерживаются: CBZ, CBR, ZIP, PDF, JPEG, PNG, WEBP."
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Загружен пустой файл.")

    comic_id = uuid.uuid4()
    comic_title = title.strip() if title and title.strip() else os.path.splitext(filename)[0].replace('_', ' ').title()

    # 1. Извлекаем страницы
    pages_info = ComicService.extract_pages_from_file(file_bytes, filename, str(comic_id))
    if not pages_info:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Не удалось извлечь ни одной графической страницы из загруженного файла."
        )

    # 2. Обрабатываем страницы и распознаем бабблы
    page_responses = []
    db_pages = []

    for page_num, img_path, width, height in pages_info:
        bubbles = await ComicService.detect_and_translate_bubbles(img_path, width, height)

        base_name = os.path.basename(img_path)
        name_no_ext = os.path.splitext(base_name)[0]
        trans_name = f"{name_no_ext}_trans.jpg"
        trans_path = os.path.join(os.path.dirname(img_path), trans_name)
        ComicService.render_translated_page(img_path, bubbles, trans_path)

        orig_url = f"/static/comics/{comic_id}/{base_name}"
        trans_url = f"/static/comics/{comic_id}/{trans_name}"
        page_id = uuid.uuid4()

        page_resp = ComicPageResponse(
            id=page_id,
            comic_id=comic_id,
            page_number=page_num,
            width=width,
            height=height,
            original_image_url=orig_url,
            translated_image_url=trans_url,
            bubbles=bubbles,
            is_processed=True
        )
        page_responses.append(page_resp)

        db_pages.append(ComicPage(
            id=page_id,
            comic_id=comic_id,
            page_number=page_num,
            width=width,
            height=height,
            original_image_url=orig_url,
            translated_image_url=trans_url,
            bubbles=bubbles,
            is_processed=True
        ))

    # 3. Сохраняем в БД, если доступна; иначе сохраняем в memory-store
    try:
        comic = Comic(
            id=comic_id,
            user_id=current_user.id if current_user else None,
            title=comic_title,
            filename=filename,
            format=ext.lstrip('.'),
            total_pages=len(pages_info),
            current_page=1
        )
        db.add(comic)
        await db.flush()
        for p in db_pages:
            db.add(p)
        await db.commit()

        stmt = select(Comic).where(Comic.id == comic.id).options(selectinload(Comic.pages))
        result = (await db.execute(stmt)).scalars().first()
        return result
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), сохранение комикса в автономном хранилище.")
        fallback_comic = ComicResponse(
            id=comic_id,
            title=comic_title,
            filename=filename,
            format=ext.lstrip('.'),
            total_pages=len(pages_info),
            current_page=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            pages=page_responses
        )
        _IN_MEMORY_COMICS[str(comic_id)] = fallback_comic.model_dump()
        return fallback_comic


@router.get("", response_model=List[ComicListItemResponse], summary="Список загруженных комиксов")
async def list_comics(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime
    results = []

    # 1. Попытка из БД
    try:
        query = select(Comic).options(selectinload(Comic.pages)).order_by(Comic.created_at.desc())
        if current_user:
            query = query.where((Comic.user_id == current_user.id) | (Comic.user_id.is_(None)))
        else:
            query = query.where(Comic.user_id.is_(None))

        comics = (await db.execute(query)).scalars().all()
        for c in comics:
            cover = c.pages[0].original_image_url if c.pages else None
            results.append(
                ComicListItemResponse(
                    id=c.id,
                    title=c.title,
                    filename=c.filename,
                    format=c.format,
                    total_pages=c.total_pages,
                    current_page=c.current_page,
                    created_at=c.created_at,
                    cover_image_url=cover
                )
            )
        return results
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), чтение из памяти/диска.")

    # 2. Фолбэк на in-memory и демо
    demo_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    results.append(
        ComicListItemResponse(
            id=demo_id,
            title="Cyber Vanguard #1: The Cosmic Anomaly",
            filename="cyber_vanguard_issue1.cbz",
            format="cbz",
            total_pages=3,
            current_page=1,
            created_at=datetime.utcnow(),
            cover_image_url=f"/static/comics/{demo_id}/demo_page_001_orig.jpg"
        )
    )

    for cid_str, cdata in _IN_MEMORY_COMICS.items():
        pages = cdata.get("pages", [])
        cover = pages[0]["original_image_url"] if pages else None
        results.append(
            ComicListItemResponse(
                id=uuid.UUID(cid_str),
                title=cdata.get("title", "Комикс"),
                filename=cdata.get("filename", "comic.cbz"),
                format=cdata.get("format", "cbz"),
                total_pages=cdata.get("total_pages", len(pages)),
                current_page=cdata.get("current_page", 1),
                created_at=cdata.get("created_at", datetime.utcnow()),
                cover_image_url=cover
            )
        )

    return results


@router.get("/{comic_id}", response_model=ComicResponse, summary="Получить комикс со всеми страницами и переводом")
async def get_comic(comic_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Comic).where(Comic.id == comic_id).options(selectinload(Comic.pages))
        comic = (await db.execute(stmt)).scalars().first()
        if comic:
            return comic
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), чтение из памяти.")

    if str(comic_id) == "00000000-0000-0000-0000-000000000001":
        return await get_demo_comic(db)

    if str(comic_id) in _IN_MEMORY_COMICS:
        return ComicResponse(**_IN_MEMORY_COMICS[str(comic_id)])

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Комикс не найден")


@router.patch("/{comic_id}/progress", response_model=ComicResponse, summary="Сохранить прогресс чтения (номер страницы)")
async def update_reading_progress(
    comic_id: uuid.UUID,
    payload: ComicProgressUpdate,
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(Comic).where(Comic.id == comic_id).options(selectinload(Comic.pages))
        comic = (await db.execute(stmt)).scalars().first()
        if comic:
            if 1 <= payload.current_page <= max(1, comic.total_pages):
                comic.current_page = payload.current_page
                await db.commit()
                await db.refresh(comic)
            return comic
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), обновление прогресса в памяти.")

    if str(comic_id) in _IN_MEMORY_COMICS:
        _IN_MEMORY_COMICS[str(comic_id)]["current_page"] = payload.current_page
        return ComicResponse(**_IN_MEMORY_COMICS[str(comic_id)])

    return await get_comic(comic_id, db)


@router.delete("/{comic_id}", status_code=status.HTTP_200_OK, summary="Удалить комикс")
async def delete_comic(
    comic_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    try:
        stmt = select(Comic).where(Comic.id == comic_id)
        comic = (await db.execute(stmt)).scalars().first()
        if comic:
            await db.delete(comic)
            await db.commit()
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), удаление из памяти.")

    if str(comic_id) in _IN_MEMORY_COMICS:
        del _IN_MEMORY_COMICS[str(comic_id)]

    storage_path = ComicService.get_storage_path(str(comic_id))
    if os.path.exists(storage_path) and str(comic_id) != "00000000-0000-0000-0000-000000000001":
        try:
            shutil.rmtree(storage_path)
        except Exception as e:
            logger.warning(f"Не удалось удалить каталог {storage_path}: {e}")

    return {"message": "Комикс успешно удален"}
