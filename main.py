import re
import os
import uuid
import subprocess
import json
import threading
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

DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

progress_store = {}   # { video_id: float 0-100 or -1 on error }
file_store = {}       # { video_id: (filepath, filename) }


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


@app.get("/formats")
def get_formats(url: str):
    try:
        cmd = ["yt-dlp", "-j", "--no-warnings", url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        data = json.loads(result.stdout.strip().split("\n")[-1])

        formats_map = {}
        for f in data.get("formats", []):
            h = f.get("height")
            if not h or h < 480 or h > 2160:
                continue

            if h not in formats_map:
                formats_map[h] = {
                    "height": h,
                    "fps": f.get("fps") or 30,
                    "filesize": f.get("filesize") or f.get("filesize_approx")
                }

        return {"formats": sorted(formats_map.values(), key=lambda x: x["height"], reverse=True)}

    except Exception as e:
        print("FORMAT ERROR:", e)
        return {"formats": []}


@app.get("/thumbnail")
def get_thumbnail(url: str):
    try:
        cmd = ["yt-dlp", "--print", "thumbnail", url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return {"thumbnail": result.stdout.strip()}
    except:
        return {"thumbnail": None}


@app.get("/download")
def download_video(url: str, format: str = "mp4", quality: str = "best"):
    video_id = str(uuid.uuid4())
    progress_store[video_id] = 0
    output_template = os.path.join(DOWNLOAD_DIR, f"{video_id}.%(ext)s")

    def run():
        try:
            # Resolve display title
            title_cmd = ["yt-dlp", "--print", "title", url]
            t_result = subprocess.run(title_cmd, capture_output=True, text=True)
            title = sanitize_filename(t_result.stdout.strip() or "video")

            if format == "mp3":
                cmd = [
                    "yt-dlp", "--newline",
                    "-x", "--audio-format", "mp3",
                    "-o", output_template, url
                ]
                ext = "mp3"
            else:
                fmt = "bestvideo+bestaudio" if quality == "best" else f"bestvideo[height<={quality}]+bestaudio"
                cmd = [
                    "yt-dlp", "--newline",
                    "-f", fmt,
                    "--merge-output-format", format,
                    "-o", output_template, url
                ]
                if format == "mkv":
                    cmd += ["--write-subs", "--sub-langs", "en", "--embed-subs", "--ignore-errors"]
                ext = format

            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

            for line in process.stdout:
                if "%" in line:
                    try:
                        percent = float(line.split("%")[0].strip().split()[-1])
                        progress_store[video_id] = min(percent, 99.0)
                    except:
                        pass
            process.wait()

            # Locate the output file to send back
            file_path = next(
                (os.path.join(DOWNLOAD_DIR, f) for f in os.listdir(DOWNLOAD_DIR) 
                 if f.startswith(video_id) and f.endswith(ext)),
                None
            )

            if file_path and os.path.exists(file_path):
                file_store[video_id] = (file_path, f"{title}.{ext}")
                progress_store[video_id] = 100
            else:
                progress_store[video_id] = -1

        except Exception as e:
            print("DOWNLOAD ERROR:", e)
            progress_store[video_id] = -1

    threading.Thread(target=run, daemon=True).start()
    return {"id": video_id}


@app.get("/progress")
def get_progress(id: str):
    return {"progress": progress_store.get(id, 0)}


@app.get("/file")
def get_file(id: str):
    entry = file_store.get(id)
    if not entry:
        p = progress_store.get(id, 0)
        if p == -1:
            raise HTTPException(status_code=500, detail="Download failed")
        raise HTTPException(status_code=404, detail="File not ready yet")

    file_path, filename = entry

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    # Clean up stores after serving
    del file_store[id]
    del progress_store[id]

    return TempFileResponse(file_path, filename)