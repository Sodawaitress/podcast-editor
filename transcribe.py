# transcribe.py
import sys
import json
from pathlib import Path
from faster_whisper import WhisperModel

def transcribe(audio_path, language="zh"):
    audio_path = Path(audio_path)
    model = WhisperModel("small", device="cpu", compute_type="int8")
    
    print(f"转录中：{audio_path.name}")
    segments, _ = model.transcribe(str(audio_path), language=language)
    
    results = []
    for seg in segments:
        results.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip()
        })
        print(f"[{seg.start:.1f}s --> {seg.end:.1f}s] {seg.text}")
    
    # 保存为 JSON，方便后续剪辑模块读取
    out_path = audio_path.with_suffix(".json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n保存完成：{out_path}")
    return results

if __name__ == "__main__":
    transcribe(sys.argv[1])