import os
import json
import shutil
import uuid
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("flow_translate.precomputed")

PRECOMPUTED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "precomputed")

class PrecomputedService:
    @classmethod
    def find_matching_precomputed(cls, filename: str) -> Optional[Dict[str, Any]]:
        """
        Проверяет, есть ли для загружаемого файла готовый заранее подготовленный перевод комикса.
        """
        if not os.path.exists(PRECOMPUTED_DIR):
            return None

        fname_lower = filename.lower()
        for folder in os.listdir(PRECOMPUTED_DIR):
            data_file = os.path.join(PRECOMPUTED_DIR, folder, "data.json")
            if not os.path.isfile(data_file):
                continue
            try:
                with open(data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                match_keys = data.get("match_filenames", [])
                for k in match_keys:
                    if k.lower() in fname_lower:
                        logger.info(f"[PRECOMPUTED] Найдено готовое совпадение для '{filename}': {folder}")
                        return {
                            "folder": os.path.join(PRECOMPUTED_DIR, folder),
                            "data": data
                        }
            except Exception as e:
                logger.warning(f"[PRECOMPUTED] Ошибка чтения {data_file}: {e}")
                continue
        return None

    @classmethod
    def apply_precomputed(cls, target_comic_dir: str, comic_id: uuid.UUID, match_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Копирует подготовленные оригинальные и переведенные изображения в папку комикса,
        и возвращает готовые данные всех страниц с бабблами для мгновенного сохранения в БД.
        """
        os.makedirs(target_comic_dir, exist_ok=True)
        images_dir = os.path.join(match_info["folder"], "images")

        pages_data = match_info["data"].get("pages", [])
        db_pages_info = []

        for p in pages_data:
            p_num = p["page_number"]
            img_name = p.get("image_filename", f"page_{p_num:03d}.jpg")
            trans_name = p.get("trans_image_filename", f"page_{p_num:03d}_trans.jpg")

            src_orig = os.path.join(images_dir, img_name)
            dst_orig = os.path.join(target_comic_dir, img_name)
            if os.path.exists(src_orig):
                shutil.copy2(src_orig, dst_orig)

            src_trans = os.path.join(images_dir, trans_name)
            dst_trans = os.path.join(target_comic_dir, trans_name)
            if os.path.exists(src_trans):
                shutil.copy2(src_trans, dst_trans)

            db_pages_info.append({
                "page_number": p_num,
                "width": p.get("width", 1988),
                "height": p.get("height", 3056),
                "original_image_url": f"/static/comics/{comic_id}/{img_name}",
                "translated_image_url": f"/static/comics/{comic_id}/{trans_name}" if os.path.exists(dst_trans) else None,
                "bubbles": p.get("bubbles", []),
                "is_processed": True
            })

        return db_pages_info
