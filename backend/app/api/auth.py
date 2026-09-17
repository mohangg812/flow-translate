# [FIX #11] Убран неиспользуемый import random
import logging
import uuid
import base64
import urllib.parse
import pyotp
import qrcode
import qrcode.image.svg
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
    VerifyCodeRequest,
    PasswordResetRequest
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


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Регистрация нового пользователя с Google Authenticator")
async def register(
    payload: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    email_clean = payload.email.lower().strip()

    stmt = select(User).where(User.email == email_clean)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user and existing_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован. Пожалуйста, выполните вход."
        )

    # 1. Генерируем секретный ключ TOTP для Google Authenticator (Base32)
    totp_secret = pyotp.random_base32()

    # 2. Создаем URI otpauth:// для сканирования QR-кода
    totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=email_clean,
        issuer_name="Flow Translate"
    )

    # 3. Формируем надёжный QR-код в виде SVG Data URI (работает оффлайн без сторонних сервисов)
    factory = qrcode.image.svg.SvgPathImage
    svg_img = qrcode.make(totp_uri, image_factory=factory)
    b64_svg = base64.b64encode(svg_img.to_string()).decode("ascii")
    qr_code_url = f"data:image/svg+xml;base64,{b64_svg}"

    # Одноразовый токен для email-подтверждения
    email_verify_token = str(uuid.uuid4())

    if existing_user and not existing_user.is_verified:
        existing_user.hashed_password = hash_password(payload.password)
        existing_user.totp_secret = totp_secret
        existing_user.verification_token = email_verify_token
        existing_user.is_active = True
        await db.commit()
        await db.refresh(existing_user)
    else:
        new_user = User(
            email=email_clean,
            hashed_password=hash_password(payload.password),
            role="user",
            is_active=True,
            is_verified=False,
            verification_token=email_verify_token,
            totp_secret=totp_secret,
            theme_preference="light"
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

    # Текущий 6-значный код на момент регистрации
    current_code = pyotp.TOTP(totp_secret).now()
    verify_url = f"http://127.0.0.1:8000/api/v1/auth/verify-email?token={email_verify_token}"
    
    # Фоновая отправка письма (если настроен SMTP, иначе вывод в лог)
    background_tasks.add_task(EmailService.send_verification_email, email_clean, current_code, verify_url)

    return {
        "message": "Регистрация начата! Отсканируйте QR-код в Google Authenticator для подтверждения.",
        "email": email_clean,
        "qr_code_url": qr_code_url,
        "secret_key": totp_secret,
        "demo_code": current_code
    }


@router.post("/verify-code", summary="Подтвердить регистрацию кодом из Google Authenticator")
async def verify_code(payload: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.is_verified:
        access_token = create_access_token(data={"sub": user.email, "role": user.role})
        return {
            "message": "Почта уже была подтверждена ранее. Вход выполнен.",
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user)
        }

    # Проверка введенного кода через алгоритм Google Authenticator (допуск +-60 сек на рассинхрон часов)
    code_clean = payload.code.strip().replace(" ", "")
    
    is_valid = False
    if user.totp_secret:
        try:
            totp = pyotp.TOTP(user.totp_secret)
            is_valid = totp.verify(code_clean, valid_window=2)
        except Exception:
            is_valid = False
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код из Google Authenticator. Проверьте время на телефоне."
        )

    user.is_verified = True
    user.verification_token = None
    await db.commit()
    await db.refresh(user)
    logger.info(f"Аккаунт успешно подтвержден через Google Authenticator: {user.email}")

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "message": "Аккаунт успешно подтвержден! Вход выполнен.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@router.get("/verify-email", summary="Подтверждение регистрации по ссылке")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.verification_token == token.strip())
    user = (await db.execute(stmt)).scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный или устаревший токен подтверждения")

    user.is_verified = True
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email не подтвержден. Пожалуйста, подтвердите аккаунт кодом из Google Authenticator."
        )
        
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


@router.post("/reset-password", summary="Сброс пароля через Google Authenticator")
async def reset_password(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    stmt = select(User).where(User.email == email_clean)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким email не найден"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован администратором"
        )

    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для данного аккаунта не настроен Google Authenticator. Обратитесь к администратору."
        )

    code_clean = payload.code.strip().replace(" ", "")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code_clean, valid_window=2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код из Google Authenticator. Проверьте время на телефоне."
        )

    user.hashed_password = hash_password(payload.new_password)
    user.is_verified = True
    user.verification_token = None
    await db.commit()
    await db.refresh(user)
    logger.info(f"Пароль успешно сброшен через Google Authenticator: {user.email}")

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "message": "Пароль успешно изменен! Вход выполнен.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }