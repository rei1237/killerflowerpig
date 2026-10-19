// 오브젝트 풀: 활성 객체는 items[0..count) 에 밀집 저장, 제거는 swap-remove (O(1), GC 없음)
export class Pool {
    constructor(factory, initial = 0) {
        this.factory = factory;
        this.items = [];
        this.count = 0;
        for (let i = 0; i < initial; i++) this.items.push(factory());
    }

    spawn() {
        if (this.count === this.items.length) this.items.push(this.factory());
        return this.items[this.count++];
    }

    // 역순 순회 중에 호출해야 안전
    release(index) {
        const last = --this.count;
        if (index !== last) {
            const tmp = this.items[index];
            this.items[index] = this.items[last];
            this.items[last] = tmp;
        }
    }

    clear() { this.count = 0; }
}
