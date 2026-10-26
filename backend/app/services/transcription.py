import os
import glob
import uuid
import wave
import shutil
import logging
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
import speech_recognition as sr

logger = logging.getLogger("flow_translate.transcription")

TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)


def get_ffmpeg_path() -> str:
    """Определяет путь к ffmpeg на системе."""
    # 1. Проверяем PATH
    which_path = shutil.which("ffmpeg")
    if which_path:
        return which_path

    # 2. Известные пути на Windows
    known_paths = [
        r"C:\Program Files\KMPlayer 64X\LAVFilters64\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
        os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-*\bin\ffmpeg.exe"),
        os.path.expanduser(r"~\scoop\apps\ffmpeg\current\bin\ffmpeg.exe"),
    ]
    for kp in known_paths:
        if "*" in kp:
            matches = glob.glob(kp)
            if matches and os.path.isfile(matches[0]):
                return matches[0]
        elif os.path.isfile(kp):
            return kp

    return "ffmpeg"


def format_seconds(seconds: float) -> str:
    """Форматирует секунды в MM:SS."""
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def format_srt_time(seconds: float) -> str:
    """Форматирует секунды в формат SRT: HH:MM:SS,mmm."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def extract_audio_from_video(video_path: str, output_wav_path: str) -> Dict[str, Any]:
    """
    Извлекает аудиодорожку из видеофайла и сохраняет в 16000Hz 16-bit Mono PCM WAV.
    """
    ffmpeg_bin = get_ffmpeg_path()
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_wav_path
    ]

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        logger.error(f"FFmpeg audio extraction failed: {result.stderr}")
        raise RuntimeError(f"Ошибка извлечения аудио: {result.stderr[-300:]}")

    if not os.path.exists(output_wav_path) or os.path.getsize(output_wav_path) == 0:
        raise RuntimeError("Аудиофайл не был создан или видео не содержит аудиодорожки.")

    with wave.open(output_wav_path, "rb") as wf:
        n_frames = wf.getnframes()
        framerate = wf.getframerate()
        duration = n_frames / float(framerate) if framerate > 0 else 0.0

    return {
        "duration_seconds": round(duration, 2),
        "duration_formatted": format_seconds(duration),
        "sample_rate": framerate,
        "size_bytes": os.path.getsize(output_wav_path)
    }


def _recognize_single_chunk(wav_path: str, offset: float, duration: float, language: str) -> str:
    """Распознаёт отдельный сегмент аудио."""
    r = sr.Recognizer()
    r.energy_threshold = 280
    r.dynamic_energy_threshold = True
    try:
        with sr.AudioFile(wav_path) as source:
            audio_data = r.record(source, offset=offset, duration=duration)
        text = r.recognize_google(audio_data, language=language)
        return text.strip() if text else ""
    except sr.UnknownValueError:
        return ""
    except sr.RequestError as e:
        logger.warning(f"Google Speech API request error at offset {offset}: {e}")
        return ""
    except Exception as e:
        logger.warning(f"Error processing chunk at {offset}: {e}")
        return ""


def transcribe_wav(
    wav_path: str,
    language: str = "ru-RU",
    chunk_duration: float = 18.0,
    max_workers: int = 5
) -> Dict[str, Any]:
    """
    Транскрибирует WAV-файл любой продолжительности (включая 5-10 минут)
    с параллельной обработкой сегментов.
    """
    with wave.open(wav_path, "rb") as wf:
        n_frames = wf.getnframes()
        framerate = wf.getframerate()
        total_duration = n_frames / float(framerate) if framerate > 0 else 0.0

    if total_duration <= 0.2:
        return {
            "text": "",
            "segments": [],
            "srt": "",
            "duration_seconds": 0.0,
            "duration_formatted": "00:00"
        }

    # Если аудио короткое (до 20 секунд), распознаем целиком
    if total_duration <= 20.0:
        single_text = _recognize_single_chunk(wav_path, 0.0, total_duration, language)
        segment = {
            "index": 1,
            "start": 0.0,
            "end": round(total_duration, 2),
            "start_formatted": "00:00",
            "end_formatted": format_seconds(total_duration),
            "text": single_text
        }
        srt = f"1\n00:00:00,000 --> {format_srt_time(total_duration)}\n{single_text}\n" if single_text else ""
        return {
            "text": single_text,
            "segments": [segment] if single_text else [],
            "srt": srt,
            "duration_seconds": round(total_duration, 2),
            "duration_formatted": format_seconds(total_duration)
        }

    # Для аудио до 5-10 минут разбиваем на блоки по chunk_duration
    chunks_meta = []
    current_time = 0.0
    idx = 1
    while current_time < total_duration:
        dur = min(chunk_duration, total_duration - current_time)
        chunks_meta.append((idx, current_time, dur))
        current_time += dur
        idx += 1

    # Параллельное распознавание сегментов
    results_map: Dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_meta = {
            executor.submit(_recognize_single_chunk, wav_path, c_offset, c_dur, language): (c_idx, c_offset, c_dur)
            for c_idx, c_offset, c_dur in chunks_meta
        }
        for future in as_completed(future_to_meta):
            c_idx, c_offset, c_dur = future_to_meta[future]
            try:
                res = future.result()
                results_map[c_idx] = res
            except Exception as e:
                logger.error(f"Failed recognizing chunk {c_idx}: {e}")
                results_map[c_idx] = ""

    segments = []
    text_pieces = []
    srt_lines = []
    active_idx = 1

    for c_idx, c_offset, c_dur in chunks_meta:
        chunk_text = results_map.get(c_idx, "").strip()
        if chunk_text:
            end_time = min(total_duration, c_offset + c_dur)
            segments.append({
                "index": active_idx,
                "start": round(c_offset, 2),
                "end": round(end_time, 2),
                "start_formatted": format_seconds(c_offset),
                "end_formatted": format_seconds(end_time),
                "text": chunk_text
            })
            text_pieces.append(chunk_text)
            srt_lines.append(
                f"{active_idx}\n{format_srt_time(c_offset)} --> {format_srt_time(end_time)}\n{chunk_text}\n"
            )
            active_idx += 1

    full_text = " ".join(text_pieces)
    srt_content = "\n".join(srt_lines)

    return {
        "text": full_text,
        "segments": segments,
        "srt": srt_content,
        "duration_seconds": round(total_duration, 2),
        "duration_formatted": format_seconds(total_duration)
    }


def process_video_transcription(
    video_file_bytes: bytes,
    original_filename: str,
    language: str = "ru-RU"
) -> Dict[str, Any]:
    """
    Полный цикл: сохранение видео -> извлечение аудио дорожки -> транскрибация.
    """
    audio_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower() or ".mp4"
    temp_video_path = os.path.join(TEMP_AUDIO_DIR, f"{audio_id}_in{ext}")
    temp_wav_path = os.path.join(TEMP_AUDIO_DIR, f"{audio_id}.wav")

    try:
        with open(temp_video_path, "wb") as f:
            f.write(video_file_bytes)

        # 1. Извлекаем аудиодорожку в 16kHz WAV
        meta = extract_audio_from_video(temp_video_path, temp_wav_path)

        # 2. Транскрибируем аудио
        trans_res = transcribe_wav(temp_wav_path, language=language)

        return {
            "status": "success",
            "audio_id": audio_id,
            "original_filename": original_filename,
            "duration_seconds": meta["duration_seconds"],
            "duration_formatted": meta["duration_formatted"],
            "sample_rate": meta["sample_rate"],
            "size_bytes": meta["size_bytes"],
            "language": language,
            "text": trans_res["text"],
            "segments": trans_res["segments"],
            "srt": trans_res["srt"],
            "audio_stream_url": f"/api/v1/transcribe/audio/{audio_id}"
        }
    finally:
        # Удаляем исходное видео для экономии диска, а WAV оставляем для плеера
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass


def process_audio_transcription(
    audio_file_bytes: bytes,
    original_filename: str,
    language: str = "ru-RU"
) -> Dict[str, Any]:
    """
    Транскрибация готового аудиофайла.
    """
    audio_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower() or ".wav"
    temp_in_path = os.path.join(TEMP_AUDIO_DIR, f"{audio_id}_in{ext}")
    temp_wav_path = os.path.join(TEMP_AUDIO_DIR, f"{audio_id}.wav")

    try:
        with open(temp_in_path, "wb") as f:
            f.write(audio_file_bytes)

        # Конвертируем в стандартный 16kHz mono WAV
        meta = extract_audio_from_video(temp_in_path, temp_wav_path)
        trans_res = transcribe_wav(temp_wav_path, language=language)

        return {
            "status": "success",
            "audio_id": audio_id,
            "original_filename": original_filename,
            "duration_seconds": meta["duration_seconds"],
            "duration_formatted": meta["duration_formatted"],
            "sample_rate": meta["sample_rate"],
            "size_bytes": meta["size_bytes"],
            "language": language,
            "text": trans_res["text"],
            "segments": trans_res["segments"],
            "srt": trans_res["srt"],
            "audio_stream_url": f"/api/v1/transcribe/audio/{audio_id}"
        }
    finally:
        if os.path.exists(temp_in_path):
            try:
                os.remove(temp_in_path)
            except Exception:
                pass
