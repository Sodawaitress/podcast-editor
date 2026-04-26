import subprocess
from pathlib import Path

def cut_audio(input_path, segments, output_path):
    if not segments:
        return
    
    input_path = str(input_path)
    output_path = str(output_path)
    tmp_dir = Path(output_path).parent / "tmp_clips"
    tmp_dir.mkdir(exist_ok=True)
    
    clip_paths = []
    
    # 每段加淡入淡出
    for i, seg in enumerate(segments):
        clip_path = str(tmp_dir / f"clip_{i}.mp3")
        duration = seg["end"] - seg["start"]
        fade = min(0.05, duration / 4)  # 最多50ms淡入淡出
        
        subprocess.run([
            "ffmpeg", "-y",
            "-i", input_path,
            "-ss", str(seg["start"]),
            "-to", str(seg["end"]),
            "-af", f"afade=t=in:st=0:d={fade},afade=t=out:st={duration - fade}:d={fade}",
            clip_path
        ], capture_output=True)
        
        clip_paths.append(clip_path)
    
    # 写 concat 列表
    list_path = str(tmp_dir / "list.txt")
    with open(list_path, "w") as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")
    
    # 拼接
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        output_path
    ], capture_output=True)
    
    # 清理临时文件
    import shutil
    shutil.rmtree(tmp_dir)
    
    print(f"导出完成：{output_path}")