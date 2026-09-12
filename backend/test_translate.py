import pytest
from pydantic import ValidationError
from app.core.security import hash_password, verify_password
from app.schemas.user import UserRegister
from app.schemas.translate import TranslateRequest


def test_password_hashing_and_verification():
    """Тест 1: Проверка безопасности и работы bcrypt"""
    raw = "FlowSecure2026!"
    hashed = hash_password(raw)

    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_user_registration_validation():
    """Тест 2: Валидация совпадения паролей и требований к сложности"""
    # Ошибка: пароли не совпадают
    with pytest.raises(ValidationError):
        UserRegister(email="user@flow.com", password="Password123!", password_confirm="Different123!")

    # Ошибка: нет цифры
    with pytest.raises(ValidationError):
        UserRegister(email="user@flow.com", password="PasswordOnly!", password_confirm="PasswordOnly!")

    # Ошибка: нет заглавной буквы
    with pytest.raises(ValidationError):
        UserRegister(email="user@flow.com", password="password123!", password_confirm="password123!")

    # Успешная валидация
    valid_user = UserRegister(email="user@flow.com", password="Password123!", password_confirm="Password123!")
    assert valid_user.email == "user@flow.com"


def test_translation_languages_validation():
    """Тест 3: Проверка ограничений на 4 языка (ru, en, de, es) по ТЗ"""
    # Ошибка: неподдерживаемый язык (например, китайский zh)
    with pytest.raises(ValidationError):
        TranslateRequest(text="Hello", source_lang="zh", target_lang="ru")

    # Ошибка: одинаковые языки оригинала и перевода
    with pytest.raises(ValidationError):
        TranslateRequest(text="Hello", source_lang="en", target_lang="en")

    # Ошибка: пустая строка из одних пробелов
    with pytest.raises(ValidationError):
        TranslateRequest(text="     ", source_lang="en", target_lang="ru")

    # Успешная валидация
    valid_req = TranslateRequest(text="Привет", source_lang="ru", target_lang="en")
    assert valid_req.source_lang == "ru"
    assert valid_req.target_lang == "en"