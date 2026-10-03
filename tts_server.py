import os
import sys
import io
import hashlib
import time
import soundfile as sf
import torch
import torchaudio

# Monkeypatch torchaudio.load to use soundfile directly (clean, robust, avoids torchcodec FFmpeg C++ DLL mismatch)
def safe_torchaudio_load(uri, **kwargs):
    data, sr = sf.read(uri, dtype='float32')
    tensor = torch.from_numpy(data)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    else:
        tensor = tensor.t()
    return tensor, sr

torchaudio.load = safe_torchaudio_load

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from f5_tts.api import F5TTS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VOICE_REF_FILE = os.path.join(BASE_DIR, "data", "voices", "baymax_sample.wav")
VOICE_REF_TEXT = "Olá, eu sou Baymax, seu agente pessoal de saúde."
CACHE_DIR = os.path.join(BASE_DIR, "data", "voices", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

print(f"[TTS Server] Inicializando motor neural F5-TTS com aceleracao CUDA (RTX 3050)...")
device = "cuda" if torch.cuda.is_available() else "cpu"
tts_engine = F5TTS(device=device)
print(f"[TTS Server] Motor pronto no dispositivo: {device}. Voz de referencia: {VOICE_REF_FILE}")

app = FastAPI(title="Echo Companion - Neural TTS Local (Baymax)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SpeakRequest(BaseModel):
    text: str
    speed: float = 1.0
    nfe_step: int = 32

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "F5-TTS",
        "voice": "Baymax (Dublagem BR)",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "ref_audio_exists": os.path.exists(VOICE_REF_FILE)
    }

@app.post("/clone-speak")
def clone_speak(req: SpeakRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto vazio")

    # Cache key baseado no texto, velocidade e steps
    cache_key = hashlib.md5(f"{text}_{req.speed}_{req.nfe_step}".encode("utf-8")).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.wav")

    if os.path.exists(cache_file):
        with open(cache_file, "rb") as f:
            audio_bytes = f.read()
        return Response(content=audio_bytes, media_type="audio/wav", headers={"X-TTS-Cache": "HIT"})

    t0 = time.time()
    try:
        wav, sr, _ = tts_engine.infer(
            ref_file=VOICE_REF_FILE,
            ref_text=VOICE_REF_TEXT,
            gen_text=text,
            speed=req.speed,
            nfe_step=req.nfe_step,
            file_wave=cache_file
        )
        duration = time.time() - t0
        print(f"[TTS Server] Gerado em {duration:.2f}s para texto ({len(text)} chars): '{text[:40]}...'")

        with open(cache_file, "rb") as f:
            audio_bytes = f.read()

        return Response(content=audio_bytes, media_type="audio/wav", headers={"X-TTS-Cache": "MISS", "X-TTS-Time": f"{duration:.2f}"})

    except Exception as e:
        print(f"[TTS Server] Erro na inferencia F5-TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=4885, log_level="info")
