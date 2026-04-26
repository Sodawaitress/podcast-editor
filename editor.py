import ffmpeg
from pathlib import Path

def cut_audio(input_path, segments, output_path):
    inputs = []
    for seg in segments:
        clip = ffmpeg.input(input_path, ss=seg["start"], to=seg["end"])
        inputs.append(clip)
    
    ffmpeg.concat(*inputs, v=0, a=1).output(output_path).run(overwrite_output=True)
    print(f"导出完成：{output_path}")