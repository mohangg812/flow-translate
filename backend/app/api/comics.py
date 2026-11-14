import logging
import os
import shutil
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, async_session_maker
from app.models.models import User
from app.models.comic import Comic, ComicPage
from app.schemas.comic import ComicResponse, ComicPageResponse, ComicListItemResponse, ComicProgressUpdate
from app.services.comic_service import ComicService
from app.api.auth import get_current_user_optional

logger = logging.getLogger("flow_translate.api.comics")
router = APIRouter(prefix="/comics", tags=["Комиксы"])

# In-memory хранилище для фолбэка при недоступности PostgreSQL
_IN_MEMORY_COMICS: Dict[str, Dict[str, Any]] = {}


async def process_remaining_pages_background(comic_id: uuid.UUID, remaining_pages: List[tuple]):
    """
    Фоновая фоновая обработка и перевод страниц 2..N.
    Не блокирует загрузку комикса и ответ клиенту.
    """
    comic_dir = ComicService.get_storage_path(str(comic_id))
    try:
        async with async_session_maker() as session:
            for page_num, img_path, width, height in remaining_pages:
                try:
                    bubbles = await ComicService.detect_and_translate_bubbles(img_path, width, height)
                    base_name = os.path.basename(img_path)
                    name_no_ext = os.path.splitext(base_name)[0]
                    trans_name = f"{name_no_ext}_trans.jpg"
                    trans_path = os.path.join(comic_dir, trans_name)
                    ComicService.render_translated_page(img_path, bubbles, trans_path)

                    stmt = select(ComicPage).where(ComicPage.comic_id == comic_id, ComicPage.page_number == page_num)
                    page_obj = (await session.execute(stmt)).scalars().first()
                    if page_obj:
                        page_obj.bubbles = bubbles
                        page_obj.translated_image_url = f"/static/comics/{comic_id}/{trans_name}"
                        page_obj.is_processed = True
                        await session.commit()
                        logger.info(f"[COMIC_BG] Страница {page_num} комикса {comic_id} успешно распознана и переведена.")
                except Exception as page_err:
                    logger.warning(f"[COMIC_BG] Ошибка обработки страницы {page_num}: {page_err}")
    except Exception as e:
        logger.warning(f"[COMIC_BG] Ошибка фоновой сессии PostgreSQL: {e}")


@router.post("/upload", response_model=ComicResponse, status_code=status.HTTP_201_CREATED, summary="Загрузить комикс (CBZ, CBR, PDF, ZIP, JPG, PNG)")
async def upload_comic(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
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

    # 1. Извлекаем страницы (занимает < 0.5 сек для любого архива)
    pages_info = ComicService.extract_pages_from_file(file_bytes, filename, str(comic_id))
    if not pages_info:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Не удалось извлечь ни одной графической страницы из загруженного файла."
        )

    # 2. Быстро обрабатываем и переводим первую страницу (1.5-2 сек)
    first_p_num, first_img_path, first_w, first_h = pages_info[0]
    first_bubbles = await ComicService.detect_and_translate_bubbles(first_img_path, first_w, first_h)

    first_base_name = os.path.basename(first_img_path)
    first_name_no_ext = os.path.splitext(first_base_name)[0]
    first_trans_name = f"{first_name_no_ext}_trans.jpg"
    first_trans_path = os.path.join(os.path.dirname(first_img_path), first_trans_name)
    ComicService.render_translated_page(first_img_path, first_bubbles, first_trans_path)

    first_page_id = uuid.uuid4()
    page_responses = [
        ComicPageResponse(
            id=first_page_id,
            comic_id=comic_id,
            page_number=first_p_num,
            width=first_w,
            height=first_h,
            original_image_url=f"/static/comics/{comic_id}/{first_base_name}",
            translated_image_url=f"/static/comics/{comic_id}/{first_trans_name}",
            bubbles=first_bubbles,
            is_processed=True
        )
    ]

    db_pages = [
        ComicPage(
            id=first_page_id,
            comic_id=comic_id,
            page_number=first_p_num,
            width=first_w,
            height=first_h,
            original_image_url=f"/static/comics/{comic_id}/{first_base_name}",
            translated_image_url=f"/static/comics/{comic_id}/{first_trans_name}",
            bubbles=first_bubbles,
            is_processed=True
        )
    ]

    # Для остальных страниц подготавливаем оригиналы (доступны для чтения мгновенно)
    for p_num, img_path, w, h in pages_info[1:]:
        b_name = os.path.basename(img_path)
        pid = uuid.uuid4()
        page_resp = ComicPageResponse(
            id=pid,
            comic_id=comic_id,
            page_number=p_num,
            width=w,
            height=h,
            original_image_url=f"/static/comics/{comic_id}/{b_name}",
            translated_image_url=None,
            bubbles=[],
            is_processed=False
        )
        page_responses.append(page_resp)
        db_pages.append(
            ComicPage(
                id=pid,
                comic_id=comic_id,
                page_number=p_num,
                width=w,
                height=h,
                original_image_url=f"/static/comics/{comic_id}/{b_name}",
                translated_image_url=None,
                bubbles=[],
                is_processed=False
            )
        )

    # 3. Сохраняем в PostgreSQL (или in-memory) и возвращаем ответ
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

        # Фоновая дообработка страниц 2..N
        if len(pages_info) > 1:
            background_tasks.add_task(process_remaining_pages_background, comic_id, pages_info[1:])

        stmt = select(Comic).where(Comic.id == comic.id).options(selectinload(Comic.pages))
        result = (await db.execute(stmt)).scalars().first()
        return result
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), сохранение в автономное хранилище.")
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


@router.post("/{comic_id}/pages/{page_number}/process", response_model=ComicPageResponse, summary="Обработать и перевести страницу комикса по запросу")
async def process_page_on_demand(
    comic_id: uuid.UUID,
    page_number: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Мгновенный OCR и перевод страницы при переходе пользователя (если еще не была переведена в фоне).
    """
    stmt = select(ComicPage).where(ComicPage.comic_id == comic_id, ComicPage.page_number == page_number)
    page_obj = (await db.execute(stmt)).scalars().first()
    if not page_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Страница комикса не найдена")

    if page_obj.is_processed and page_obj.bubbles:
        return page_obj

    comic_dir = ComicService.get_storage_path(str(comic_id))
    img_name = f"page_{page_number:03d}.jpg"
    img_path = os.path.join(comic_dir, img_name)
    if not os.path.exists(img_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Файл {img_name} не найден")

    bubbles = await ComicService.detect_and_translate_bubbles(img_path, page_obj.width, page_obj.height)
    trans_name = f"page_{page_number:03d}_trans.jpg"
    trans_path = os.path.join(comic_dir, trans_name)
    ComicService.render_translated_page(img_path, bubbles, trans_path)

    page_obj.bubbles = bubbles
    page_obj.translated_image_url = f"/static/comics/{comic_id}/{trans_name}"
    page_obj.is_processed = True
    await db.commit()
    await db.refresh(page_obj)
    return page_obj


@router.get("", response_model=List[ComicListItemResponse], summary="Список загруженных комиксов")
async def list_comics(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    results = []
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
        logger.warning(f"PostgreSQL недоступен ({e}), чтение из памяти.")

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


@router.get("/{comic_id}", response_model=ComicResponse, summary="Получить комикс со всеми страницами")
async def get_comic(comic_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(Comic).where(Comic.id == comic_id).options(selectinload(Comic.pages))
        comic = (await db.execute(stmt)).scalars().first()
        if comic:
            return comic
    except Exception as e:
        logger.warning(f"PostgreSQL недоступен ({e}), чтение из памяти.")

    if str(comic_id) in _IN_MEMORY_COMICS:
        return ComicResponse(**_IN_MEMORY_COMICS[str(comic_id)])

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Комикс не найден")


@router.patch("/{comic_id}/progress", response_model=ComicResponse, summary="Сохранить прогресс чтения")
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
    if os.path.exists(storage_path):
        try:
            shutil.rmtree(storage_path)
        except Exception as e:
            logger.warning(f"Не удалось удалить каталог {storage_path}: {e}")

    return {"message": "Комикс успешно удален"}
