// 의존성 없는 PNG 디코더 (8비트 RGBA·RGB, 비인터레이스). 테스트에서 스프라이트 픽셀 검사용.
// 네이티브 캔버스 모듈(@napi-rs/canvas) 없이도 어느 환경에서나 같은 결과를 낸다.
import { inflateSync } from 'node:zlib';
const SIGNATURE = '89504e470d0a1a0a';
export function decodePng(buffer) {
    if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('not a PNG');
    let width = 0, height = 0, channels = 0;
    const idat = [];
    for (let at = 8; at < buffer.length;) {
        const length = buffer.readUInt32BE(at), type = buffer.toString('latin1', at + 4, at + 8), data = buffer.subarray(at + 8, at + 8 + length);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4);
            const depth = data[8], color = data[9], interlace = data[12];
            if (depth !== 8 || interlace !== 0 || ![2, 6].includes(color)) throw new Error(`unsupported PNG: depth ${depth}, color ${color}, interlace ${interlace}`);
            channels = color === 6 ? 4 : 3;
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        at += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat)), stride = width * channels, out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride), row = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? row[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            row[i] = v & 255;
        }
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4, s = x * channels;
            out[o] = row[s]; out[o + 1] = row[s + 1]; out[o + 2] = row[s + 2]; out[o + 3] = channels === 4 ? row[s + 3] : 255;
        }
        [prev, row] = [row, prev];
    }
    return { width, height, data: out };
}
