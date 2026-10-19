#!/usr/bin/env python3
"""
스프라이트 시트 → 게임용 아틀라스 베이킹 도구.

원본 시트(asset/*.png)는 그대로 두고, 다음을 생성한다:
  asset/sprites/<id>.webp   : 프레임만 잘라 축소·패킹한 아틀라스
  src/data/sprites.js       : 프레임 좌표/앵커 메타데이터 (ES module)

- 시트 왼쪽의 "걷기/공격/죽음" 라벨 열은 잘라낸다.
- 각 행(걷기/공격/죽음)에서 알파 투영으로 프레임을 자동 검출한다.
- 프레임마다 몸통 중심(불투명 픽셀 x 중앙값)과 발 위치(bbox 하단)를 앵커로 기록해
  공격 프레임에서 무기가 튀어나와도 캐릭터가 흔들리지 않게 한다.

사용법: python3 tools/bake_sprites.py   (Pillow, numpy 필요)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'asset')
OUT_IMG = os.path.join(ROOT, 'asset', 'sprites')
OUT_JS = os.path.join(ROOT, 'src', 'data', 'sprites.js')

ALPHA_T = 24
PAD = 2

# id: (파일, 라벨 열 폭, 행 정의, 걷기 프레임 목표 높이)
# 행 정의: [(애니 이름, 기대 프레임 수)] — 시트 높이를 균등 분할
SHEETS = {
    'player':   ('꽃돼지 총.png', 0, 'grid4x2', 112),
    'rabbit1':  ('청토끼.png', 170, [('walk', 6), ('attack', 6), ('dead', 6)], 112),
    'rabbit2':  ('청토끼 2.png', 175, [('walk', 6), ('attack', 6), ('dead', 5)], 112),
    'rabbit3':  ('청토끼 3.png', 160, [('walk', 6), ('attack', 6), ('dead', 5)], 112),
    'boss1':    ('청토끼 보스.png', 190, [('walk', 6), ('attack', 6), ('dead', 6)], 224),
    'boss2':    ('청토끼 보스2.png', 300, [('walk', 6), ('attack', 6), ('dead', 6)], 240),
    'bossKing': ('청토끼 킹.png', 300, [('walk', 6), ('attack', 6), ('dead', 6)], 240),
}


def runs(proj, min_val=1):
    """투영 배열에서 연속 구간 [start, end) 목록."""
    on = proj >= min_val
    out, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(on)])
    return out


def segment_row(mask, y0, y1, expected):
    band = mask[y0:y1]
    segs = runs(band.sum(axis=0), 2)
    while len(segs) > expected:
        # 합쳤을 때 가장 좁아지는 이웃 쌍부터 병합 → 흩어진 파편(뼈 조각 등)이 먼저 하나로 묶임
        widths = [segs[i + 1][1] - segs[i][0] for i in range(len(segs) - 1)]
        k = int(np.argmin(widths))
        segs[k] = [segs[k][0], segs[k + 1][1]]
        del segs[k + 1]
    # 붙어 있는 프레임(공격 이펙트가 이어진 경우)은 가장 넓은 구간을 투영 최저점에서 분할
    proj = band.sum(axis=0)
    while len(segs) < expected:
        k = max(range(len(segs)), key=lambda i: segs[i][1] - segs[i][0])
        x0, x1 = segs[k]
        a, b = x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4
        cut = a + int(np.argmin(proj[a:b]))
        segs[k:k + 1] = [[x0, cut], [cut, x1]]
        print(f'  split row@{y0} segment {x0}-{x1} at {cut}', file=sys.stderr)
    frames = []
    for x0, x1 in segs:
        sub = band[:, x0:x1]
        ys, xs = np.where(sub)
        by0, by1 = ys.min(), ys.max() + 1
        bx0, bx1 = xs.min(), xs.max() + 1
        # 몸통 중심: 하단 60% 영역의 불투명 픽셀 x 중앙값 (무기/파편 영향 최소화)
        lower = ys >= by0 + (by1 - by0) * 0.4
        cx = float(np.median(xs[lower])) if lower.any() else (bx0 + bx1) / 2
        frames.append({
            'x': x0 + bx0, 'y': y0 + by0, 'w': bx1 - bx0, 'h': by1 - by0,
            'cx': x0 + cx,
        })
    return frames


def grid_frames(mask, cols, rows):
    h, w = mask.shape
    cw, ch = w / cols, h / rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = int(c * cw), int(r * ch)
            sub = mask[y0:int(y0 + ch), x0:int(x0 + cw)]
            ys, xs = np.where(sub)
            bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            lower = ys >= by0 + (by1 - by0) * 0.4
            cx = float(np.median(xs[lower]))
            frames.append({'x': x0 + bx0, 'y': y0 + by0, 'w': bx1 - bx0, 'h': by1 - by0, 'cx': x0 + cx})
    return frames


def bake(sid, fname, label_w, rows, target_h):
    im = Image.open(os.path.join(SRC, fname)).convert('RGBA')
    arr = np.array(im)
    arr[:, :label_w, 3] = 0
    mask = arr[:, :, 3] > ALPHA_T
    src = Image.fromarray(arr)

    anims = {}
    if rows == 'grid4x2':
        anims['walk'] = grid_frames(mask, 4, 2)
    else:
        h = im.height
        n = len(rows)
        for i, (name, count) in enumerate(rows):
            y0, y1 = int(h * i / n), int(h * (i + 1) / n)
            anims[name] = segment_row(mask, y0, y1, count)

    walk_h = float(np.median([f['h'] for f in anims['walk']]))
    scale = min(1.0, target_h / walk_h)

    # 축소 후 셸프 패킹
    tiles = []
    for name, frames in anims.items():
        for f in frames:
            crop = src.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
            tw, th = max(1, round(f['w'] * scale)), max(1, round(f['h'] * scale))
            crop = crop.resize((tw, th), Image.LANCZOS)
            tiles.append((name, f, crop))

    max_w = 1024
    x = y = shelf_h = 0
    placed = []
    for name, f, crop in tiles:
        if x + crop.width + PAD > max_w:
            x, y = 0, y + shelf_h + PAD
            shelf_h = 0
        placed.append((name, f, crop, x, y))
        x += crop.width + PAD
        shelf_h = max(shelf_h, crop.height)
    atlas_w = max(px + c.width for _, _, c, px, _ in placed)
    atlas_h = y + shelf_h
    atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))

    meta = {'image': f'asset/sprites/{sid}.webp', 'w': atlas_w, 'h': atlas_h,
            'walkH': round(walk_h * scale), 'anims': {}}
    for name, f, crop, px, py in placed:
        atlas.paste(crop, (px, py))
        meta['anims'].setdefault(name, []).append({
            'sx': px, 'sy': py, 'sw': crop.width, 'sh': crop.height,
            # 앵커(몸통 중심 x, 발 y) 기준 오프셋
            'ox': round((f['cx'] - f['x']) * scale, 1), 'oy': crop.height,
        })

    out = os.path.join(OUT_IMG, f'{sid}.webp')
    atlas.save(out, 'WEBP', quality=88, method=6)
    old = os.path.getsize(os.path.join(SRC, fname))
    print(f'{sid:9s} {im.width}x{im.height} {old // 1024}KB -> {atlas_w}x{atlas_h} '
          f'{os.path.getsize(out) // 1024}KB  frames={sum(len(v) for v in anims.values())}')
    return meta


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    data = {sid: bake(sid, *spec) for sid, spec in SHEETS.items()}
    with open(OUT_JS, 'w', encoding='utf-8') as fp:
        fp.write('// 자동 생성 파일 — tools/bake_sprites.py 로 재생성하세요. 직접 수정 금지.\n')
        fp.write('export const SPRITES = ')
        json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
        fp.write(';\n')


if __name__ == '__main__':
    main()
