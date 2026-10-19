#!/usr/bin/env bash
# 배경/일러스트를 WebP로, BGM을 저비트레이트 MP3로 변환한다. (원본은 asset/ 에 그대로 둠)
# 필요: python3 + Pillow, ffmpeg
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'EOF'
from PIL import Image
import os
jobs = {
    'asset/bg/stage1.webp': 'asset/bg_stage1_1776859252407.png',
    'asset/bg/stage3.webp': 'asset/bg_stage3_1776859290142.png',
    'asset/bg/stage5.webp': 'asset/bg_stage5_1776859700265.png',
    'asset/bg/stage7.webp': 'asset/bg_stage7_1776859783868.png',
    'asset/bg/stage9.webp': 'asset/bg_stage9_1776859795988.png',
    'asset/ui/title.webp': 'asset/꽃돼지 the killer of zombie.png',
    'asset/ui/victory.webp': 'asset/꽃돼지 승리.png',
    'asset/ui/gameover.webp': 'asset/게임오버.png',
    'asset/ui/clear.webp': 'asset/게임 클리어.jpg',
}
for dst, src in jobs.items():
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('P', 'RGBA', 'LA') else 'RGB')
    if dst.startswith('asset/bg/'):
        im = im.resize((768, 768), Image.LANCZOS)  # 타일로 반복되므로 768이면 충분
    im.save(dst, 'WEBP', quality=80, method=6)
    print(f'{src}: {os.path.getsize(src)//1024}KB -> {dst}: {os.path.getsize(dst)//1024}KB')
EOF

mkdir -p asset/audio
ffmpeg -loglevel error -y -i asset/freepik-silent-ops.mp3 -ac 2 -b:a 96k asset/audio/bgm.mp3
ffmpeg -loglevel error -y -i asset/Pixels_in_Bloom.mp3 -ac 2 -b:a 96k asset/audio/epilogue.mp3
ls -la asset/audio
