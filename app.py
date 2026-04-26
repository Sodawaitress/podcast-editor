import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory
from transcribe import transcribe
from editor import cut_audio

app = Flask(__name__)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route("/upload", methods=["POST"])
def upload():
    file = request.files["audio"]
    path = UPLOAD_DIR / file.filename
    file.save(path)
    segments = transcribe(str(path))
    return jsonify({"filename": file.filename, "segments": segments})

@app.route("/export", methods=["POST"])
def export():
    data = request.json
    filename = data["filename"]
    segments = data["segments"]
    audio_path = UPLOAD_DIR / filename
    out_path = UPLOAD_DIR / f"edited_{filename}"
    cut_audio(str(audio_path), segments, str(out_path))
    return send_file(str(out_path), as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True, port=5001)