import pytest
from fastapi import HTTPException
from starlette.requests import Request
from app.api.translate import validate_safe_url
from app.services.translator import TranslationLRUCache
from app.core.rate_limit import InMemoryRateLimiter


def test_ssrf_validator_blocks_private_and_loopback():
    """Тест защиты от SSRF: блокировка localhost, private IP, metadata"""
    # 1. Localhost и 127.0.0.1
    with pytest.raises(HTTPException) as exc1:
        validate_safe_url("http://127.0.0.1:8000/secret")
    assert exc1.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        validate_safe_url("http://localhost:5173")
    assert exc2.value.status_code == 400

    # 2. Облачные метаданные AWS/GCP
    with pytest.raises(HTTPException) as exc3:
        validate_safe_url("http://169.254.169.254/latest/meta-data/")
    assert exc3.value.status_code == 400

    # 3. Недопустимая схема (не http/https)
    with pytest.raises(HTTPException) as exc4:
        validate_safe_url("file:///etc/passwd")
    assert exc4.value.status_code == 400

    with pytest.raises(HTTPException) as exc5:
        validate_safe_url("ftp://example.com/file.txt")
    assert exc5.value.status_code == 400


def test_translation_lru_cache():
    """Тест работы LRU/TTL кэша перевода"""
    cache = TranslationLRUCache(max_size=2, ttl_seconds=60)
    key1 = ("en", "ru", "hello", "neutral")
    val1 = {"translated_text": "Привет", "tone": "neutral"}
    key2 = ("en", "ru", "world", "neutral")
    val2 = {"translated_text": "Мир", "tone": "neutral"}
    key3 = ("en", "ru", "apple", "neutral")
    val3 = {"translated_text": "Яблоко", "tone": "neutral"}

    cache.set(key1, val1)
    cache.set(key2, val2)

    # Читаем сначала key2, затем key1 -> key1 становится самым свежим (MRU), а key2 - старейшим (LRU)
    assert cache.get(key2) == val2
    assert cache.get(key1) == val1

    # Добавляем key3 (превышение max_size=2). Вытесняется key2!
    cache.set(key3, val3)
    assert cache.get(key3) == val3
    assert cache.get(key1) == val1
    assert cache.get(key2) is None  # key2 успешно вытеснен по алгоритму LRU


@pytest.mark.anyio
async def test_in_memory_rate_limiter():
    """Тест ограничения частоты запросов (Rate Limiter)"""
    limiter = InMemoryRateLimiter(requests_per_window=2, window_seconds=60)

    # Имитируем фиктивный Starlette Request
    scope = {
        "type": "http",
        "client": ("192.168.1.100", 12345),
        "headers": []
    }
    req = Request(scope)

    # Первые 2 запроса должны пройти без ошибок
    await limiter(req)
    await limiter(req)

    # 3-й запрос должен вернуть 429 Too Many Requests
    with pytest.raises(HTTPException) as exc:
        await limiter(req)
    assert exc.value.status_code == 429
    assert "Слишком много запросов" in exc.value.detail
