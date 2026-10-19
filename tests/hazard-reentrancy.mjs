import test from 'node:test';
import assert from 'node:assert/strict';
import { G, clearWorld } from '../src/game/state.js';
import { spawnHazard, updateHazards } from '../src/game/hazards.js';

// 장판 틱이 보스를 때려 페이즈가 바뀌면 보스가 자신의 예고 장판을 풀에서 제거한다.
// 이때 updateHazards 루프가 같은 객체를 다시 해제해 풀 count 가 음수가 되던 문제 회귀 테스트.
test('boss hit inside a hazard tick may remove other hazards without corrupting the pool', () => {
    clearWorld();
    G.clock = 1; G.events = {}; G.caps = { particles: 0, texts: 0 };
    G.player = { x: 0, y: 0, stats: { crit: 0, armor: 0, critMul: 2 } };
    const telegraphs = [spawnHazard('tline', 0, 0, { delay: 0.05 }), spawnHazard('tcircle', 0, 0, { delay: 0.05 })];
    let hits = 0;
    G.boss = {
        alive: true, x: 0, y: 0, radius: 30,
        hurt() {
            hits++;
            for (let i = G.hazards.count - 1; i >= 0; i--) {
                if (telegraphs.includes(G.hazards.items[i])) { G.hazards.items[i].alive = false; G.hazards.release(i); }
            }
        },
    };
    spawnHazard('fire', 0, 0, { radius: 60, duration: 5, dmg: 1, tick: 0.1 });
    spawnHazard('fire', 0, 0, { radius: 60, duration: 0.05, dmg: 1, tick: 0.1 });
    updateHazards(0.1);
    assert.ok(hits >= 1);
    assert.ok(G.hazards.count >= 0 && G.hazards.count <= G.hazards.items.length);
    const live = G.hazards.items.slice(0, G.hazards.count);
    assert.equal(new Set(live).size, live.length, 'no duplicates in the live range');
    for (const h of telegraphs) assert.ok(!live.includes(h));
    assert.ok(spawnHazard('fire', 0, 0, {}), 'pool can still spawn');
});
