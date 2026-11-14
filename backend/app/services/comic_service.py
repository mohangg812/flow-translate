import os
import re
import json
import uuid
import asyncio
import zipfile
import subprocess
import logging
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont
import pypdf

from app.services.translator import TranslationService

logger = logging.getLogger("flow_translate.comics")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_DIR = os.path.join(BACKEND_DIR, "storage", "comics")
ROOT_DIR = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


def natural_sort_key(s: str):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


class ComicService:
    @staticmethod
    def get_storage_path(comic_id: str) -> str:
        comic_dir = os.path.join(STORAGE_DIR, str(comic_id))
        os.makedirs(comic_dir, exist_ok=True)
        return comic_dir

    @classmethod
    def extract_pages_from_file(cls, file_bytes: bytes, filename: str, comic_id: str) -> List[Tuple[int, str, int, int]]:
        """
        Извлекает страницы из CBZ, ZIP, CBR, PDF или набора изображений.
        Возвращает список кортежей: (page_number, file_path, width, height)
        """
        comic_dir = cls.get_storage_path(comic_id)
        pages_info = []
        ext = os.path.splitext(filename)[1].lower()

        # 1. Форматы архивов CBZ / ZIP / CBR
        if ext in ('.cbz', '.zip', '.cbr'):
            try:
                import io
                with zipfile.ZipFile(io.BytesIO(file_bytes), 'r') as zf:
                    names = [
                        n for n in zf.namelist()
                        if n.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
                        and not n.startswith('__MACOSX')
                        and not os.path.basename(n).startswith('.')
                    ]
                    names.sort(key=natural_sort_key)

                    for idx, name in enumerate(names, start=1):
                        img_bytes = zf.read(name)
                        out_name = f"page_{idx:03d}.jpg"
                        out_path = os.path.join(comic_dir, out_name)

                        # Сохраняем через PIL для валидации и нормализации
                        with Image.open(io.BytesIO(img_bytes)) as pil_img:
                            rgb_img = pil_img.convert('RGB')
                            w, h = rgb_img.size
                            rgb_img.save(out_path, format='JPEG', quality=90)
                            pages_info.append((idx, out_path, w, h))
            except Exception as e:
                logger.error(f"Ошибка распаковки архива {filename}: {e}")

        # 2. Формат PDF
        elif ext == '.pdf':
            try:
                import io
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                page_idx = 1
                for p_num, page in enumerate(reader.pages):
                    # Извлекаем встроенные изображения страницы
                    extracted_any = False
                    for img_file in page.images:
                        out_name = f"page_{page_idx:03d}.jpg"
                        out_path = os.path.join(comic_dir, out_name)
                        with Image.open(io.BytesIO(img_file.data)) as pil_img:
                            rgb_img = pil_img.convert('RGB')
                            w, h = rgb_img.size
                            rgb_img.save(out_path, format='JPEG', quality=90)
                            pages_info.append((page_idx, out_path, w, h))
                            page_idx += 1
                            extracted_any = True
                            break  # Берем главное изображение страницы

                    if not extracted_any:
                        # Если сканированного изображения нет, создаем страницу-заглушку
                        out_name = f"page_{page_idx:03d}.jpg"
                        out_path = os.path.join(comic_dir, out_name)
                        img = Image.new('RGB', (850, 1200), color=(250, 250, 252))
                        draw = ImageDraw.Draw(img)
                        text_content = page.extract_text() or f"Comic Page {p_num + 1}"
                        draw.text((60, 60), text_content[:500], fill=(20, 20, 20))
                        img.save(out_path, format='JPEG', quality=90)
                        pages_info.append((page_idx, out_path, 850, 1200))
                        page_idx += 1
            except Exception as e:
                logger.error(f"Ошибка чтения PDF {filename}: {e}")

        # 3. Прямая загрузка одного изображения
        elif ext in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
            try:
                import io
                out_name = "page_001.jpg"
                out_path = os.path.join(comic_dir, out_name)
                with Image.open(io.BytesIO(file_bytes)) as pil_img:
                    rgb_img = pil_img.convert('RGB')
                    w, h = rgb_img.size
                    rgb_img.save(out_path, format='JPEG', quality=90)
                    pages_info.append((1, out_path, w, h))
            except Exception as e:
                logger.error(f"Ошибка сохранения изображения {filename}: {e}")

        return pages_info

    @classmethod
    async def detect_and_translate_bubbles(cls, image_path: str, width: int, height: int) -> List[Dict[str, Any]]:
        """
        Запускает OCR для распознавания текста на странице комикса и переводит найденные бабблы.
        """
        raw_bubbles = []
        script_path = os.path.join(FRONTEND_DIR, "extract_bubbles.mjs")

        if os.path.exists(script_path):
            try:
                # Запускаем Node.js скрипт Tesseract
                cmd = ["node", script_path, image_path]
                proc = subprocess.run(cmd, cwd=FRONTEND_DIR, capture_output=True, text=True, timeout=25)
                if proc.stdout:
                    data = json.loads(proc.stdout)
                    raw_bubbles = data.get("bubbles", [])
            except Exception as e:
                logger.warning(f"Ошибка выполнения extract_bubbles.mjs для {image_path}: {e}")

        # Если OCR ничего не вернул (например, чистый арт), возвращаем пустой список
        if not raw_bubbles:
            return []

        # Асинхронный параллельный перевод всех бабблов через asyncio.gather
        texts_en = [b.get("text_en", "").strip() for b in raw_bubbles]
        
        async def _safe_translate(t: str) -> str:
            if not t:
                return ""
            try:
                res = await TranslationService.translate(t, source_lang="en", target_lang="ru")
                return res.strip() if isinstance(res, str) else str(res)
            except Exception as e:
                logger.warning(f"Ошибка перевода реплики '{t[:30]}': {e}")
                return t

        translations_ru = await asyncio.gather(*[_safe_translate(t) for t in texts_en])

        processed_bubbles = []
        for idx, b in enumerate(raw_bubbles):
            text_en = texts_en[idx]
            text_ru = translations_ru[idx] if idx < len(translations_ru) else ""
            if not text_en:
                continue

            # Вычисление относительных координат в процентах (0..100%)
            bbox = b.get("bbox", {})
            x = bbox.get("x", 0)
            y = bbox.get("y", 0)
            w = bbox.get("width", 100)
            h = bbox.get("height", 50)

            rel_x = round((x / width) * 100, 2)
            rel_y = round((y / height) * 100, 2)
            rel_w = round((w / width) * 100, 2)
            rel_h = round((h / height) * 100, 2)

            processed_bubbles.append({
                "id": b.get("id", f"b_{idx + 1}"),
                "text_en": text_en,
                "text_ru": text_ru,
                "bbox": {"x": x, "y": y, "width": w, "height": h},
                "rel_x": rel_x,
                "rel_y": rel_y,
                "rel_w": rel_w,
                "rel_h": rel_h,
                "confidence": b.get("confidence", 85)
            })

        return processed_bubbles

    @classmethod
    def render_translated_page(cls, orig_image_path: str, bubbles: List[Dict[str, Any]], out_image_path: str) -> str:
        """
        Накладывает переведенный русский текст поверх исходных бабблов с помощью Pillow.
        Использует адаптивный шрифт TrueType (Arial Bold) для четкого отображения.
        """
        try:
            from PIL import ImageFont
            with Image.open(orig_image_path) as img:
                canvas = img.convert('RGB')
                draw = ImageDraw.Draw(canvas)
                img_w, img_h = canvas.size

                for b in bubbles:
                    bbox = b.get("bbox", {})
                    x = bbox.get("x", 0)
                    y = bbox.get("y", 0)
                    w = bbox.get("width", 100)
                    h = bbox.get("height", 50)
                    text_ru = b.get("text_ru", "")

                    if not text_ru:
                        continue

                    # Рисуем аккуратный баббл с мягкой тенью и скругленными углами
                    pad = max(6, int(w * 0.03))
                    rect = [x - pad, y - pad, x + w + pad, y + h + pad]
                    
                    # Белая заливка с контрастной черной обводкой
                    draw.rounded_rectangle(rect, radius=max(8, int(pad * 1.5)), fill=(255, 255, 255), outline=(15, 23, 42), width=3)

                    # Вычисляем адаптивный размер шрифта под размер баббла
                    font_size = max(14, min(38, int(h * 0.22)))
                    try:
                        font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', font_size)
                    except Exception:
                        font = ImageFont.load_default()

                    # Перенос слов по строкам с учетом ширины баббла
                    words = text_ru.split()
                    lines = []
                    cur_line = []
                    max_line_chars = max(12, int(w / (font_size * 0.65)))

                    for word in words:
                        cur_line.append(word)
                        if len(" ".join(cur_line)) > max_line_chars:
                            lines.append(" ".join(cur_line))
                            cur_line = []
                    if cur_line:
                        lines.append(" ".join(cur_line))

                    display_text = "\n".join(lines[:6])
                    draw.multiline_text((x + 6, y + 4), display_text, fill=(15, 23, 42), font=font, spacing=4)

                canvas.save(out_image_path, format='JPEG', quality=92)
                return out_image_path
        except Exception as e:
            logger.error(f"Ошибка рендеринга переведенной страницы {orig_image_path}: {e}")
            return orig_image_path

    @classmethod
    async def create_demo_comic_files(cls) -> Dict[str, Any]:
        """
        Создает демонстрационный 3-страничный цветной комикс в стиле Sci-Fi / Superheroes.
        """
        demo_id = "00000000-0000-0000-0000-000000000001"
        comic_dir = cls.get_storage_path(demo_id)

        pages_data = [
            {
                "page_num": 1,
                "title": "Episode 1: The Cosmic Anomaly",
                "bg_color": (15, 20, 32),
                "panels": [
                    {
                        "rect": [40, 40, 860, 410],
                        "fill": (25, 35, 55),
                        "border": (100, 140, 220),
                        "caption": "SECTOR 7 — DEEP SPACE",
                        "bubbles": [
                            {
                                "id": "b1_1",
                                "bbox": [100, 90, 420, 95],
                                "text_en": "Commander, long-range sensors detect an unidentified alien vessel!",
                                "text_ru": "Командир, дальние сенсоры зафиксировали неопознанный корабль пришельцев!"
                            }
                        ]
                    },
                    {
                        "rect": [40, 435, 435, 840],
                        "fill": (45, 25, 45),
                        "border": (200, 100, 180),
                        "bubbles": [
                            {
                                "id": "b1_2",
                                "bbox": [70, 480, 360, 90],
                                "text_en": "They are powering up their pulse cannons! Stand by for impact!",
                                "text_ru": "Они заряжают импульсные пушки! Приготовиться к столкновению!"
                            }
                        ]
                    },
                    {
                        "rect": [465, 435, 860, 840],
                        "fill": (25, 45, 40),
                        "border": (80, 200, 160),
                        "bubbles": [
                            {
                                "id": "b1_3",
                                "bbox": [500, 480, 330, 90],
                                "text_en": "Shields at maximum power! Prepare to intercept!",
                                "text_ru": "Щиты на максимуме! Приготовиться к перехвату!"
                            }
                        ]
                    },
                    {
                        "rect": [40, 865, 860, 1260],
                        "fill": (50, 35, 20),
                        "border": (240, 160, 60),
                        "bubbles": [
                            {
                                "id": "b1_4",
                                "bbox": [130, 920, 620, 85],
                                "text_en": "Energy barrier holding steady. They are initiating contact!",
                                "text_ru": "Энергетический барьер стабилен. Они выходят на связь!"
                            }
                        ]
                    }
                ]
            },
            {
                "page_num": 2,
                "title": "Episode 1: The Encrypted Signal",
                "bg_color": (16, 16, 20),
                "panels": [
                    {
                        "rect": [40, 40, 860, 580],
                        "fill": (30, 25, 45),
                        "border": (180, 120, 230),
                        "caption": "BRIDGE OF THE STARSHIP AURORA",
                        "bubbles": [
                            {
                                "id": "b2_1",
                                "bbox": [120, 100, 560, 90],
                                "text_en": "Incoming transmission on an encrypted quantum frequency!",
                                "text_ru": "Входящая передача на зашифрованной квантовой частоте!"
                            },
                            {
                                "id": "b2_2",
                                "bbox": [200, 420, 540, 85],
                                "text_en": "Can the neural translator decode their linguistic matrix?",
                                "text_ru": "Сможет ли нейросетевой переводчик расшифровать их матрицу языка?"
                            }
                        ]
                    },
                    {
                        "rect": [40, 605, 860, 1260],
                        "fill": (20, 40, 50),
                        "border": (60, 180, 220),
                        "bubbles": [
                            {
                                "id": "b2_3",
                                "bbox": [110, 670, 680, 95],
                                "text_en": "Translation complete: 'Greetings from the Andromeda galaxy! We seek peaceful cooperation.'",
                                "text_ru": "Перевод завершен: «Приветствуем из галактики Андромеда! Мы ищем мирного сотрудничества.»"
                            }
                        ]
                    }
                ]
            },
            {
                "page_num": 3,
                "title": "Episode 1: Dawn of the Alliance",
                "bg_color": (18, 22, 28),
                "panels": [
                    {
                        "rect": [40, 40, 435, 620],
                        "fill": (25, 38, 35),
                        "border": (90, 190, 140),
                        "bubbles": [
                            {
                                "id": "b3_1",
                                "bbox": [70, 90, 340, 90],
                                "text_en": "Lower defense shields. Open a direct communication link!",
                                "text_ru": "Опустите защитные щиты. Откройте прямую линию связи!"
                            }
                        ]
                    },
                    {
                        "rect": [465, 40, 860, 620],
                        "fill": (45, 30, 30),
                        "border": (220, 110, 110),
                        "bubbles": [
                            {
                                "id": "b3_2",
                                "bbox": [500, 90, 330, 90],
                                "text_en": "Confirmed! Their emissary is ready to step aboard.",
                                "text_ru": "Подтверждено! Их посол готов подняться на борт."
                            }
                        ]
                    },
                    {
                        "rect": [40, 645, 860, 1260],
                        "fill": (35, 45, 65),
                        "border": (130, 170, 255),
                        "bubbles": [
                            {
                                "id": "b3_3",
                                "bbox": [120, 710, 660, 95],
                                "text_en": "This is the dawn of a new alliance between our worlds. Welcome, travelers of the stars!",
                                "text_ru": "Это рассвет нового альянса между нашими мирами. Добро пожаловать, странники звёзд!"
                            }
                        ]
                    }
                ]
            }
        ]

        comic_pages = []
        width, height = 900, 1300

        for p_data in pages_data:
            p_num = p_data["page_num"]
            orig_name = f"demo_page_{p_num:03d}_orig.jpg"
            trans_name = f"demo_page_{p_num:03d}_trans.jpg"
            orig_path = os.path.join(comic_dir, orig_name)
            trans_path = os.path.join(comic_dir, trans_name)

            # 1. Генерируем оригинальную страницу комикса
            img_orig = Image.new('RGB', (width, height), color=p_data["bg_color"])
            draw_orig = ImageDraw.Draw(img_orig)
            draw_orig.rectangle([15, 15, width - 15, height - 15], outline=(255, 255, 255), width=3)

            page_bubbles = []
            for panel in p_data["panels"]:
                draw_orig.rectangle(panel["rect"], fill=panel["fill"], outline=panel["border"], width=4)
                if "caption" in panel:
                    cap_rect = [panel["rect"][0] + 10, panel["rect"][1] + 10, panel["rect"][0] + 280, panel["rect"][1] + 35]
                    draw_orig.rectangle(cap_rect, fill=(240, 240, 245), outline=(10, 10, 15), width=2)
                    draw_orig.text((panel["rect"][0] + 20, panel["rect"][1] + 15), panel["caption"], fill=(10, 10, 15))

                for b in panel["bubbles"]:
                    bx, by, bw, bh = b["bbox"]
                    # Рисуем баббл с английским текстом
                    draw_orig.rounded_rectangle([bx, by, bx + bw, by + bh], radius=22, fill=(255, 255, 255), outline=(15, 15, 20), width=3)
                    draw_orig.multiline_text((bx + 16, by + 16), b["text_en"], fill=(15, 15, 20), spacing=4)

                    rel_x = round((bx / width) * 100, 2)
                    rel_y = round((by / height) * 100, 2)
                    rel_w = round((bw / width) * 100, 2)
                    rel_h = round((bh / height) * 100, 2)

                    page_bubbles.append({
                        "id": b["id"],
                        "text_en": b["text_en"],
                        "text_ru": b["text_ru"],
                        "bbox": {"x": bx, "y": by, "width": bw, "height": bh},
                        "rel_x": rel_x,
                        "rel_y": rel_y,
                        "rel_w": rel_w,
                        "rel_h": rel_h,
                        "confidence": 95
                    })

            img_orig.save(orig_path, format='JPEG', quality=95)

            # 2. Генерируем запеченную переведенную страницу (на русском)
            cls.render_translated_page(orig_path, page_bubbles, trans_path)

            comic_pages.append({
                "page_number": p_num,
                "width": width,
                "height": height,
                "original_image_url": f"/static/comics/{demo_id}/{orig_name}",
                "translated_image_url": f"/static/comics/{demo_id}/{trans_name}",
                "bubbles": page_bubbles,
                "is_processed": True
            })

        return {
            "id": uuid.UUID(demo_id),
            "title": "Cyber Vanguard #1: The Cosmic Anomaly",
            "filename": "cyber_vanguard_issue1.cbz",
            "format": "cbz",
            "total_pages": len(comic_pages),
            "current_page": 1,
            "pages": comic_pages
        }
