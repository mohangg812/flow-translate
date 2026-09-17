# [FIX #11] Убран неиспользуемый import random
import logging
import uuid
import urllib.parse
import pyotp
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import User
from app.schemas.user import (
    UserRegister,
    UserLogin,
    UserResponse,
    Token,
    ThemeUpdate,
    PasswordChange,
    VerifyCodeRequest
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)
from app.services.email import EmailService

logger = logging.getLogger("flow_translate.auth")
router = APIRouter(prefix="/auth", tags=["Аутентификация и Пользователи"])
security = HTTPBearer()


# Dependency для получения авторизованного пользователя из БД
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или просроченный токен авторизации",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload["sub"]
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован администратором")
        
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Регистрация нового пользователя")
async def register(
    payload: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    email_clean = payload.email.lower().strip()

    stmt = select(User).where(User.email == email_clean)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        if not existing_user.is_verified:
            existing_user.hashed_password = hash_password(payload.password)
            existing_user.is_verified = True
            existing_user.is_active = True
            await db.commit()
            await db.refresh(existing_user)
            access_token = create_access_token(data={"sub": existing_user.email, "role": existing_user.role})
            return {
                "message": "Регистрация успешна!",
                "access_token": access_token,
                "token_type": "bearer",
                "user": UserResponse.model_validate(existing_user),
                "email": email_clean
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован. Пожалуйста, выполните вход."
        )

    new_user = User(
        email=email_clean,
        hashed_password=hash_password(payload.password),
        role="user",
        is_active=True,
        is_verified=True,
        verification_token=None,
        totp_secret=None,
        theme_preference="light"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email, "role": new_user.role})
    return {
        "message": "Регистрация успешна!",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(new_user),
        "email": email_clean
    }


@router.post("/verify-code", summary="Подтвердить регистрацию кодом из Google Authenticator")
async def verify_code(payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.is_verified:
        return {"message": "Почта уже была подтверждена ранее. Вы можете войти."}

    # [FIX #5] Проверка кода через TOTP-секрет (хранится в отдельном поле)
    code_clean = payload.code.strip().replace(" ", "")
    
    is_valid = False
    if user.totp_secret:
        try:
            totp = pyotp.TOTP(user.totp_secret)
            is_valid = totp.verify(code_clean, valid_window=1)
        except Exception:
            is_valid = False
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код из Google Authenticator"
        )

    user.is_verified = True
    await db.commit()
    logger.info(f"Аккаунт успешно подтвержден через Google Authenticator: {user.email}")

    return {"message": "Аккаунт успешно подтвержден! Теперь вы можете войти в систему."}


@router.get("/verify-email", summary="Подтверждение регистрации по ссылке")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    # [FIX #5] Ищем по одноразовому email_verify_token, а не по TOTP-секрету
    stmt = select(User).where(User.verification_token == token.strip())
    user = (await db.execute(stmt)).scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный или устаревший токен подтверждения")

    user.is_verified = True
    # Обнуляем токен после использования (одноразовый)
    user.verification_token = None
    await db.commit()
    logger.info(f"Email подтвержден по ссылке: {user.email}")

    return {"message": "Почта успешно подтверждена! Теперь вы можете войти в систему."}


@router.post("/login", response_model=Token, summary="Вход в систему (получение JWT)")
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        logger.warning(f"Неудачная попытка входа: {email_clean}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    
    if not user.is_verified:
        user.is_verified = True
        await db.commit()
        
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ваш аккаунт заблокирован администратором")

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    logger.info(f"Успешный вход в систему: {email_clean}")
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse, summary="Получить профиль текущего пользователя")
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch("/me/theme", summary="Сохранить тему интерфейса (light/dark)")
async def update_theme(payload: ThemeUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current_user.theme_preference = payload.theme
    await db.commit()
    return {"message": f"Тема успешно изменена на {payload.theme}", "theme": payload.theme}


@router.post("/change-password", summary="Сменить пароль")
async def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный старый пароль")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    logger.info(f"Пользователь {current_user.email} успешно сменил пароль")
    return {"message": "Пароль успешно изменен"}