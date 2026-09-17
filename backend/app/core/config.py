from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Flow Translate"
    DATABASE_URL: str
    SECRET_KEY: str = "4e9938d66d1b3e500807fa4175afc664bd00fe62123d6bd83526b92ea81d856c"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # [FIX #3] Пароль админа вынесен из кода в переменную окружения
    ADMIN_DEFAULT_PASSWORD: str = "Admin1234!"

    # [FIX] SMTP-настройки централизованы в конфиге (ранее читались через os.getenv)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()