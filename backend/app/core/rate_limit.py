import time
import threading
from collections import defaultdict, deque
from fastapi import Request, HTTPException, status


class InMemoryRateLimiter:
    """
    Потокобезопасный ограничитель частоты запросов (Rate Limiter)
    на основе скользящего временного окна (Sliding Window Log).
    Работает в памяти без внешних зависимостей.
    """
    def __init__(self, requests_per_window: int = 60, window_seconds: int = 60, name: str = "default"):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.name = name
        self.requests = defaultdict(deque)
        self.lock = threading.Lock()

    def get_client_ip(self, request: Request) -> str:
        # Учитываем обратный прокси (Render, Nginx, Cloudflare)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            return cf_ip.strip()
        client = request.client
        return client.host if client else "127.0.0.1"

    async def __call__(self, request: Request):
        client_ip = self.get_client_ip(request)
        now = time.time()
        cutoff = now - self.window_seconds

        with self.lock:
            q = self.requests[client_ip]
            # Удаляем запросы старше окна
            while q and q[0] <= cutoff:
                q.popleft()

            if len(q) >= self.requests_per_window:
                retry_after = max(1, int(self.window_seconds - (now - q[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Слишком много запросов. Пожалуйста, подождите {retry_after} сек. перед повторной попыткой.",
                    headers={"Retry-After": str(retry_after)}
                )

            q.append(now)


# Лимиты для критичных эндпоинтов:
# 1. Авторизация, регистрация, сброс пароля: 10 попыток в минуту (защита от брутфорса)
auth_rate_limiter = InMemoryRateLimiter(requests_per_window=10, window_seconds=60, name="auth")

# 2. Перевод текста: 120 запросов в минуту (достаточно для debounce и быстрого набора текста)
translate_rate_limiter = InMemoryRateLimiter(requests_per_window=120, window_seconds=60, name="translate")

# 3. Извлечение страниц по URL: 15 запросов в минуту (предотвращение перегрузки веб-краулингом)
url_extract_rate_limiter = InMemoryRateLimiter(requests_per_window=15, window_seconds=60, name="url_extract")
