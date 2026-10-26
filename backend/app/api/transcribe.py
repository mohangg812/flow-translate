import os
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse

from app.services.transcription import (
    process_video_transcription,
    process_audio_transcription,
    get_ffmpeg_path,
    TEMP_AUDIO_DIR
)

logger = logging.getLogger("flow_translate.api.transcribe")

router = APIRouter(prefix="/transcribe", tags=["Транскрибация"])

MAX_FILE_SIZE = 250 * 1024 * 1024  # 250 MB


@router.get("/status", summary="Проверка доступности FFmpeg и модуля транскрибации")
async def transcription_status():
    ffmpeg_bin = get_ffmpeg_path()
    is_available = os.path.exists(ffmpeg_bin) if os.path.isabs(ffmpeg_bin) else bool(ffmpeg_bin)
    return {
        "status": "online",
        "service": "Flow Translate Video/Audio Transcriber",
        "ffmpeg_available": is_available,
        "ffmpeg_path": ffmpeg_bin
    }


@router.post("/video", summary="Транскрибация видео: разбиение на аудиодорожку и распознавание речи")
async def transcribe_video_endpoint(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ru-RU")
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не передано."
        )

    # Чтение содержимого с контролем размера
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Размер видеофайла превышает лимит 250 МБ."
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загружен пустой файл."
        )

    try:
        result = process_video_transcription(
            video_file_bytes=content,
            original_filename=file.filename,
            language=language or "ru-RU"
        )
        return result
    except Exception as e:
        logger.error(f"Ошибка при обработке видео {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки видео: {str(e)}"
        )


@router.post("/audio", summary="Транскрибация аудиофайла")
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    language: Optional[str] = Form("ru-RU")
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя файла не передано."
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Размер аудиофайла превышает лимит 250 МБ."
        )

    try:
        result = process_audio_transcription(
            audio_file_bytes=content,
            original_filename=file.filename,
            language=language or "ru-RU"
        )
        return result
    except Exception as e:
        logger.error(f"Ошибка при обработке аудио {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки аудио: {str(e)}"
        )


@router.get("/audio/{audio_id}", summary="Стриминг извлеченной аудиодорожки (WAV)")
async def get_extracted_audio(audio_id: str):
    # Ограничение имени для предотвращения path traversal
    safe_id = os.path.basename(audio_id)
    wav_path = os.path.join(TEMP_AUDIO_DIR, f"{safe_id}.wav")
    if not os.path.exists(wav_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аудиодорожка не найдена или срок хранения истёк."
        )

    return FileResponse(
        wav_path,
        media_type="audio/wav",
        filename=f"audio_track_{safe_id[:8]}.wav"
    )
