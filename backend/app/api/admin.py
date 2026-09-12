import uuid
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models.models import User, DictionaryEntry
from app.api.auth import get_current_user
from app.schemas.user import UserResponse

router = APIRouter(prefix="/admin", tags=["Админ-панель"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права администратора."
        )
    return current_user


@router.get("/users", response_model=List[UserResponse], summary="Список пользователей")
async def get_all_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size)
    users = (await db.execute(stmt)).scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/users/{user_id}/toggle-status", summary="Блокировка / разблокировка пользователя")
async def toggle_user_status(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Администратор не может заблокировать сам себя")

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.is_active = not user.is_active
    await db.commit()

    status_str = "активирован" if user.is_active else "заблокирован"
    return {"message": f"Пользователь {user.email} успешно {status_str}", "is_active": user.is_active}


@router.get("/stats", summary="Общая системная статистика")
async def get_system_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    total_words = (await db.execute(select(func.count(DictionaryEntry.id)))).scalar() or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_saved_words": total_words,
        "supported_languages_count": 4,
        "system_status": "healthy"
    }