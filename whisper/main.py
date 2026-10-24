import os
import time
import tempfile
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "1"))
raw_lang = os.getenv("WHISPER_LANGUAGE", "es").strip()
WHISPER_LANGUAGE = raw_lang if raw_lang and raw_lang.lower() not in ["", "none", "null", "auto"] else None
WHISPER_VAD_FILTER = os.getenv("WHISPER_VAD_FILTER", "true").lower() in ["true", "1", "yes"]
MAX_AUDIO_SIZE_MB = int(os.getenv("MAX_AUDIO_SIZE_MB", "100"))

model = None
transcribe_lock = asyncio.Lock()

def get_or_load_model():
    global model
    if model is None:
        print(f"[WHISPER] Cargando modelo '{WHISPER_MODEL}'...")
        model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE
        )
        print(f"[WHISPER] Modelo '{WHISPER_MODEL}' listo.")
    return model

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    print(f"[WHISPER] Inicializando servicio Whisper (modelo='{WHISPER_MODEL}', dispositivo='{WHISPER_DEVICE}', tipo='{WHISPER_COMPUTE_TYPE}')...")
    try:
        get_or_load_model()
    except Exception as e:
        print(f"[WHISPER] Nota: La descarga/carga del modelo se completará en la primera petición ({e}).")
    yield
    print("[WHISPER] Apagando servicio Whisper.")

app = FastAPI(title="ICASE Local Whisper Service", lifespan=lifespan)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": WHISPER_MODEL,
        "device": WHISPER_DEVICE,
        "compute_type": WHISPER_COMPUTE_TYPE
    }

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="Debe proporcionar un archivo de audio en el campo 'file'.")

    # Guardar en archivo temporal
    suffix = os.path.splitext(file.filename or "")[1] or ".mp3"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_path = tmp_file.name
            size_bytes = 0
            chunk_size = 1024 * 1024  # 1 MB chunks
            while chunk := await file.read(chunk_size):
                size_bytes += len(chunk)
                if size_bytes > MAX_AUDIO_SIZE_MB * 1024 * 1024:
                    raise HTTPException(
                        status_code=413,
                        detail=f"El archivo excede el tamaño máximo permitido de {MAX_AUDIO_SIZE_MB} MB."
                    )
                tmp_file.write(chunk)

        audio_size_mb = round(size_bytes / (1024 * 1024), 2)
        start_time = time.time()

        # Serializar ejecución para que solo se procese 1 audio a la vez (control de CPU/RAM)
        async with transcribe_lock:
            loop = asyncio.get_running_loop()
            def run_model():
                m = get_or_load_model()
                segments, info = m.transcribe(
                    tmp_path,
                    beam_size=WHISPER_BEAM_SIZE,
                    vad_filter=WHISPER_VAD_FILTER,
                    language=WHISPER_LANGUAGE
                )
                text_parts = [segment.text.strip() for segment in segments]
                full_text = " ".join(t for t in text_parts if t)
                return full_text, info

            transcribed_text, info = await loop.run_in_executor(None, run_model)

        elapsed_sec = round(time.time() - start_time, 2)
        detected_lang = info.language if info and hasattr(info, 'language') else (WHISPER_LANGUAGE or "es")

        print(f"[WHISPER] model={WHISPER_MODEL} device={WHISPER_DEVICE} computeType={WHISPER_COMPUTE_TYPE} audioSizeMB={audio_size_mb} transcriptionSeconds={elapsed_sec}")

        return JSONResponse(content={
            "success": True,
            "text": transcribed_text,
            "language": detected_lang,
            "duration": round(info.duration, 2) if info and hasattr(info, 'duration') and info.duration else None
        })

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[WHISPER] Error durante la transcripción: {exc}")
        raise HTTPException(status_code=500, detail=f"Error en transcripción local: {str(exc)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
