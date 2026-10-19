// 균일 그리드 공간 분할. 매 스텝 rebuild 후 query 로 주변 객체만 조회.
// 셀 배열은 재사용하여 할당을 최소화한다.
export class SpatialGrid {
    constructor(cellSize = 64) {
        this.size = cellSize;
        this.inv = 1 / cellSize;
        this.cells = new Map();
        this.used = [];
        this.result = [];
    }

    key(cx, cy) { return (cx + 32768) * 65536 + (cy + 32768); }

    clear() {
        for (const arr of this.used) arr.length = 0;
        this.used.length = 0;
    }

    insert(obj) {
        const cx = Math.floor(obj.x * this.inv), cy = Math.floor(obj.y * this.inv);
        const k = this.key(cx, cy);
        let arr = this.cells.get(k);
        if (!arr) { arr = []; this.cells.set(k, arr); }
        if (arr.length === 0) this.used.push(arr);
        arr.push(obj);
    }

    // 반경 r 안에 걸칠 수 있는 셀의 객체들 (정밀 판정은 호출측).
    // 기본 결과 배열은 공유되므로 중첩 조회 시에는 별도 out 배열을 넘길 것.
    query(x, y, r, out = this.result) {
        out.length = 0;
        const x0 = Math.floor((x - r) * this.inv), x1 = Math.floor((x + r) * this.inv);
        const y0 = Math.floor((y - r) * this.inv), y1 = Math.floor((y + r) * this.inv);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const arr = this.cells.get(this.key(cx, cy));
                if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
            }
        }
        return out;
    }

    // 셀이 너무 많이 쌓이면 Map 정리 (스테이지 전환 시 호출)
    reset() { this.cells.clear(); this.used.length = 0; }
}
