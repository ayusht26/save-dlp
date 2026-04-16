import re
import os
import uuid
import subprocess
import json
import threading
import time
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

progress_store = {}
file_store = {}

def sanitize_filename(name: str):
    return re.sub(r'[\\/*?:"<>|]', "-", name)

# ✅ FIX 1: Background Cleanup Task
def cleanup_old_files():
    while True:
        try:
            now = time.time()
            for f in os.listdir(DOWNLOAD_DIR):
                path = os.path.join(DOWNLOAD_DIR, f)
                if os.path.isfile(path) and os.stat(path).st_mtime < now - 3600:
                    os.remove(path)
        except:
            pass
        time.sleep(600)  # Check every 10 minutes

threading.Thread(target=cleanup_old_files, daemon=True).start()

# Helper function to dynamically add cookie bypass if the file exists
def get_bypass_args():
    args = ["--user-agent", "Mozilla/5.0", "--force-ipv4", "--legacy-server-connect"]
    if os.path.exists("cookies.txt"):
        args.extend(["--cookies", "cookies.txt"])
    return args


@app.get("/formats")
def get_formats(url: str):
    try:
        cmd = ["yt-dlp", "-J", "--no-warnings"] + get_bypass_args() + [url]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if not result.stdout.strip():
            print("YT-DLP EMPTY OUTPUT")
            print("STDERR:", result.stderr)
            return {"formats": []}

        try:
            data = json.loads(result.stdout)
        except Exception as e:
            print("JSON ERROR:", e)
            print("RAW OUTPUT:", result.stdout[:500])
            print("STDERR:", result.stderr)
            return {"formats": []}

        if not data or not isinstance(data, dict):
            print("YT-DLP returned invalid data (Likely an IP block/Bot detection)")
            return {"formats": []}

        formats_map = {}

        for f in data.get("formats", []):
            if not isinstance(f, dict):
                continue

            h = f.get("height")
            if not h or h < 480 or h > 2160:
                continue

            if h not in formats_map:
                formats_map[h] = {
                    "height": h,
                    "fps": f.get("fps") or 30,
                    "filesize": f.get("filesize") or f.get("filesize_approx")
                }

        return {
            "formats": sorted(
                formats_map.values(),
                key=lambda x: x["height"],
                reverse=True
            )
        }

    except Exception as e:
        print("FORMAT ERROR:", e)
        return {"formats": []}


@app.get("/thumbnail")
def get_thumbnail(url: str):
    try:
        cmd = ["yt-dlp", "--print", "thumbnail"] + get_bypass_args() + [url]
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
            title_cmd = ["yt-dlp", "--print", "title"] + get_bypass_args() + [url]
            t_result = subprocess.run(title_cmd, capture_output=True, text=True)
            title = sanitize_filename(t_result.stdout.strip() or "video")

            if format == "mp3":
                cmd = [
                    "yt-dlp",
                    "--newline",
                    "-x", "--audio-format", "mp3",
                    "-o", output_template
                ] + get_bypass_args() + [url]
                ext = "mp3"
            else:
                fmt = "bestvideo+bestaudio/best" if quality == "best" else f"bestvideo[height<={quality}]+bestaudio/bestvideo[height<={quality}]/best"
                cmd = [
                    "yt-dlp",
                    "--newline",
                    "-f", fmt,
                    "--merge-output-format", format,
                    "-o", output_template
                ] + get_bypass_args() + [url]
                ext = format

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )

            for line in process.stdout:
                if "%" in line:
                    try:
                        percent = float(line.split("%")[0].strip().split()[-1])
                        progress_store[video_id] = min(percent, 99.0)
                    except:
                        pass

            process.wait()

            file_path = None
            
            for f in os.listdir(DOWNLOAD_DIR):
                if f.startswith(video_id) and f.endswith(f".{ext}"):
                    file_path = os.path.join(DOWNLOAD_DIR, f)
                    break
            
            if not file_path:
                for f in os.listdir(DOWNLOAD_DIR):
                    if f.startswith(video_id) and not f.endswith(".part") and not f.endswith(".ytdl"):
                        file_path = os.path.join(DOWNLOAD_DIR, f)
                        ext = f.split(".")[-1]
                        break

            if file_path and os.path.exists(file_path):
                file_store[video_id] = (file_path, f"{title}.{ext}")
                progress_store[video_id] = 100
            else:
                print("FILE NOT FOUND AFTER DOWNLOAD")
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

    return FileResponse(file_path, filename=filename)