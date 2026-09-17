import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.database import engine, Base, async_session_maker
from app.core.config import settings
from app.models.models import User
from app.core.security import hash_password
from app.api.translate import router as translate_router
from app.api.auth import router as auth_router
from app.api.dictionary import router as dictionary_router
from app.api.admin import router as admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("flow_translate")


async def seed_admin():
    async with async_session_maker() as session:
        stmt = select(User).where(User.email == "admin@flow.com")
        existing_admin = (await session.execute(stmt)).scalars().first()
        if not existing_admin:
            admin = User(
                email="admin@flow.com",
                # [FIX #3] Пароль админа берётся из переменной окружения, а не захардкожен
                hashed_password=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                role="admin",
                is_active=True,
                is_verified=True,
                theme_preference="dark"
            )
            session.add(admin)
            await session.commit()
            logger.info("[SEED] Администратор admin@flow.com успешно создан в PostgreSQL!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Запуск приложения Flow Translate...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Таблицы базы данных PostgreSQL успешно инициализированы.")
    await seed_admin()
    yield
    logger.info("Остановка сервера Flow Translate.")


app = FastAPI(
    title="Flow Translate API",
    version="1.0.0",
    description="API веб-сервиса перевода текста и персонального словаря",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True}
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================
# ЕДИНЫЙ ОБРАБОТЧИК ВСЕХ ИСКЛЮЧЕНИЙ (Критерий чек-листа)
# ==============================================================

# 1. Ошибки валидации схем Pydantic (422)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err["loc"] if loc != "body")
        msg = err.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg.replace("Value error, ", "")
        errors.append(f"{field}: {msg}" if field else msg)
    
    friendly_msg = "; ".join(errors) if errors else "Ошибка валидации входных данных"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "error",
            "message": friendly_msg,
            "code": 422,
            "details": errors
        }
    )

# 2. Штатные HTTP-исключения (400, 401, 403, 404)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "message": exc.detail,
            "code": exc.status_code
        }
    )

# 3. Любые непредвиденные сбои (500)
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.critical(f"Необработанное исключение: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "Внутренняя ошибка сервера. Сервер продолжает стабильную работу.",
            "code": 500,
            # [FIX #25] Убран error_type — имя исключения раскрывало внутреннюю реализацию
        }
    )


@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/docs")


app.include_router(translate_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dictionary_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["Системные"])
async def health_check():
    return {
        "status": "online",
        "database": "PostgreSQL 16 (Docker)",
        "service": "Flow Translate Backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)