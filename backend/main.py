import sys
import re
import os
import uuid
import subprocess
import json
import threading
import uvicorn
import multiprocessing
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PORTABLE BINARY RESOLUTION ---
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BIN_DIR = os.path.join(BASE_DIR, "bin")
YTDLP_EXE = os.path.join(BIN_DIR, "yt-dlp.exe")

DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), "savedlp_downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Windows flag to hide terminal windows when running subprocesses
CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

progress_store = {}
file_store = {}

def sanitize_filename(name: str):
    return re.sub(r'[\\/*?:"<>|]', "-", name)

class TempFileResponse(FileResponse):
    def __init__(self, path: str, filename: str):
        super().__init__(path=path, filename=filename)
        self.file_path = path

    async def __call__(self, scope, receive, send):
        await super().__call__(scope, receive, send)
        try:
            if os.path.exists(self.file_path):
                os.remove(self.file_path)
        except:
            pass

@app.get("/ping")
def ping():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/info")
def get_info(url: str):
    try:
        cmd = [YTDLP_EXE, "-j", "--no-warnings", url]
        # Added creationflags to hide the terminal
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, creationflags=CREATE_NO_WINDOW)
        data = json.loads(result.stdout.strip().split("\n")[-1])

        formats_map = {}
        for f in data.get("formats", []):
            h = f.get("height")
            if not h or h < 360 or h > 2160:
                continue
            if h not in formats_map:
                formats_map[h] = {
                    "height": h,
                    "fps": f.get("fps") or 30, 
                    "filesize": f.get("filesize") or f.get("filesize_approx"),
                }

        sorted_formats = sorted(formats_map.values(), key=lambda x: x["height"], reverse=True)

        return {
            "title": data.get("title", "Unknown"),
            "channel": data.get("channel", data.get("uploader", "Unknown")),
            "duration": data.get("duration", 0),
            "view_count": data.get("view_count", 0),
            "thumbnail": data.get("thumbnail", ""),
            "formats": sorted_formats
        }
    except Exception as e:
        print("INFO ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download")
def download_video(url: str, format: str = "mp4", quality: str = "best", save_dir: str = ""):
    video_id = str(uuid.uuid4())
    progress_store[video_id] = 0

    def run():
        try:
            title_cmd = [YTDLP_EXE, "--print", "title", url]
            # Added creationflags to hide the terminal
            t_result = subprocess.run(title_cmd, capture_output=True, text=True, timeout=15, creationflags=CREATE_NO_WINDOW)
            title = sanitize_filename(t_result.stdout.strip() or "video")

            ext = "png" if format == "thumbnail" else format
            if format not in ["mp3", "wav", "thumbnail"]:
                ext = format

            if save_dir and os.path.exists(save_dir):
                counter = 0
                final_path = os.path.join(save_dir, f"{title}.{ext}")
                while os.path.exists(final_path):
                    counter += 1
                    final_path = os.path.join(save_dir, f"{title}({counter}).{ext}")
            else:
                final_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.{ext}")

            base_cmd = [YTDLP_EXE, "--ffmpeg-location", BIN_DIR, "--newline"]

            if format == "mp3":
                cmd = base_cmd + ["-x", "--audio-format", "mp3", "--audio-quality", "0", "--embed-thumbnail", "--add-metadata", "-o", final_path, url]
            elif format == "wav":
                cmd = base_cmd + ["-x", "--audio-format", "wav", "--embed-thumbnail", "--add-metadata", "-o", final_path, url]
            elif format == "thumbnail":
                cmd = base_cmd + ["--write-thumbnail", "--skip-download", "--convert-thumbnails", "png", "-o", final_path, url]
                ext = "png"
            else:
                fmt = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" if quality == "best" else f"bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<={quality}]"
                cmd = base_cmd + ["-f", fmt, "--merge-output-format", format, "-o", final_path, url]
                if format == "mkv":
                    cmd += ["--write-subs", "--sub-langs", "en", "--embed-subs", "--ignore-errors"]

            # Added creationflags to hide the terminal during active downloads
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=CREATE_NO_WINDOW)

            for line in process.stdout:
                if "%" in line:
                    try:
                        percent = float(line.split("%")[0].strip().split()[-1])
                        progress_store[video_id] = min(percent, 99.0)
                    except:
                        pass
            process.wait()

            fallback_path = final_path.replace(".png", ".webp") if format == "thumbnail" else final_path
            
            if os.path.exists(final_path):
                progress_store[video_id] = 100
                progress_store[f"{video_id}_path"] = final_path
                if not save_dir:
                    file_store[video_id] = (final_path, f"{title}.{ext}")
            elif os.path.exists(fallback_path):
                progress_store[video_id] = 100
                progress_store[f"{video_id}_path"] = fallback_path
                if not save_dir:
                    file_store[video_id] = (fallback_path, f"{title}.{ext}")
            else:
                progress_store[video_id] = -1

        except Exception as e:
            print("DOWNLOAD ERROR:", e)
            progress_store[video_id] = -1

    threading.Thread(target=run, daemon=True).start()
    return {"id": video_id}

@app.get("/progress")
def get_progress(id: str):
    return {
        "progress": progress_store.get(id, 0),
        "save_path": progress_store.get(f"{id}_path", None)
    }

@app.get("/file")
def get_file(id: str):
    entry = file_store.get(id)
    if not entry:
        raise HTTPException(status_code=404, detail="File not ready or saved directly")
    file_path, filename = entry
    del file_store[id]
    del progress_store[id]
    return TempFileResponse(file_path, filename)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_config=None)