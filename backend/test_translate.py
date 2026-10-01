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
    """Тест 2: Валидация совпадения паролей и минимальной длины"""
    # Ошибка: пароли не совпадают
    with pytest.raises(ValidationError):
        UserRegister(email="user@flow.com", password="Password123!", password_confirm="Different123!")

    # Ошибка: короткий пароль (<6)
    with pytest.raises(ValidationError):
        UserRegister(email="user@flow.com", password="123", password_confirm="123")

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


def test_translation_text_max_length():
    """Тест 4: Граничный лимит ровно 2000 символов"""
    # 2000 символов допустимо
    text_2000 = "a" * 2000
    req_2000 = TranslateRequest(text=text_2000, source_lang="en", target_lang="ru")
    assert len(req_2000.text) == 2000

    # 2001 символ должен вызывать ошибку валидации схемы
    text_2001 = "a" * 2001
    with pytest.raises(ValidationError):
        TranslateRequest(text=text_2001, source_lang="en", target_lang="ru")


def test_dictionary_entry_is_favorite_schema():
    """Тест 5: Флаг is_favorite может быть явно задан как False при создании"""
    from app.schemas.dictionary import DictionaryEntryCreate

    entry_fav_false = DictionaryEntryCreate(
        source_text="Hello",
        translated_text="Привет",
        source_lang="en",
        target_lang="ru",
        is_favorite=False
    )
    assert entry_fav_false.is_favorite is False

    entry_fav_default = DictionaryEntryCreate(
        source_text="Hello",
        translated_text="Привет",
        source_lang="en",
        target_lang="ru"
    )
    assert entry_fav_default.is_favorite is True