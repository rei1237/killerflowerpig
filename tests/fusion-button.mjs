import test from 'node:test';
import assert from 'node:assert/strict';
// 최소 DOM: 버튼 3개만 흉내 낸다.
const nodes = new Map();
function button(id) {
    const classes = new Set();
    return { id, dataset: {}, attrs: {}, children: [],
        classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) },
        setAttribute(k, v) { this.attrs[k] = v; },
        get textContent() { return this.text + this.children.map(c => c.textContent).join(''); },
        set textContent(v) { this.text = v; this.children = []; }, text: '',
        appendChild(c) { this.children.push(c); } };
}
globalThis.document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, button(id)); return nodes.get(id); }, createElement: () => ({ textContent: '' }) };
const { G } = await import('../src/game/state.js');
const { createWeapon } = await import('../src/game/weapons.js');
const { WEAPONS } = await import('../src/data/weapons.js');
const { resetBuild } = await import('../src/game/progression.js');
const { previewFusion, readyFusions, FUSION_RECIPES } = await import('../src/game/fusion.js');
const { syncFusionButtons } = await import('../src/ui/fusion-button.js');
const weapon = (id, level = 8, slot = 0, evolved = level === 8) => Object.assign(createWeapon(id, slot), { level, evolved: !!WEAPONS[id].evolve && evolved });
function setup(weapons) { resetBuild(); G.mode = 'play'; G.player = { stats: {}, dead: false }; G.weapons = weapons; }

test('readyFusions agrees exactly with the full preview across missing, low-level, unevolved, ready and full-inventory builds', () => {
    const builds = [[], [weapon('cannon', 4), weapon('thorns', 8, 1)], [weapon('cannon', 8, 0, false), weapon('thorns', 8, 1)],
        [weapon('cannon'), weapon('thorns', 8, 1)], [weapon('shotgun'), weapon('rifle', 8, 1), weapon('pistols', 8, 2)],
        ['shotgun', 'rifle', 'pistols', 'gas', 'saw', 'thorns'].map((id, i) => weapon(id, 8, i))];
    for (const build of builds) {
        setup(build);
        assert.deepEqual(readyFusions(), FUSION_RECIPES.filter(r => previewFusion(r.id).ok).map(r => r.id), JSON.stringify(build.map(w => [w.id, w.level, w.evolved])));
    }
});

test('fusion buttons switch to a highlighted "조합 가능 (N)" state only when a recipe is ready, and stay clickable for browsing', () => {
    setup([weapon('cannon', 4), weapon('thorns', 8, 1)]);
    assert.equal(syncFusionButtons(true), 0);
    for (const id of ['btn-fusion', 'btn-levelup-fusion', 'btn-pause-fusion']) {
        const b = document.getElementById(id);
        assert.equal(b.classList.contains('fusion-available'), false); assert.equal(b.dataset.ready, '0');
        assert.match(b.textContent, /아이템 조합/); assert.equal(b.disabled, undefined, 'never disabled');
    }
    assert.match(document.getElementById('btn-fusion').textContent, /레시피 확인/);
    setup([weapon('cannon'), weapon('thorns', 8, 1)]);
    const ready = syncFusionButtons();
    assert.equal(ready, readyFusions().length); assert.ok(ready >= 1);
    for (const id of ['btn-fusion', 'btn-levelup-fusion', 'btn-pause-fusion']) {
        const b = document.getElementById(id);
        assert.equal(b.classList.contains('fusion-available'), true); assert.match(b.textContent, new RegExp(`조합 가능 \\(${ready}\\)`));
        assert.match(b.attrs['aria-label'], /조합 가능/);
    }
});
