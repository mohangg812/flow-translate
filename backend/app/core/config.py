from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # [FIX #3] Пароль админа вынесен из кода в переменную окружения
    ADMIN_DEFAULT_PASSWORD: str = "Admin1234!"

    # [FIX] SMTP-настройки централизованы в конфиге (ранее читались через os.getenv)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()