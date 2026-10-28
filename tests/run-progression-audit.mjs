import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimateWaveXP, simulatePlan, summarizePlans, makeBossBuildFixtures } from '../tools/run-progression-audit.mjs';
import { FUSION_RECIPES } from '../src/data/fusions.js';
import { WEAPONS } from '../src/data/weapons.js';
import { BOSS_XP_GEMS, bossGemValue } from '../src/data/boss-rewards.js';
import './helpers/fixed-variants.mjs'; // 변이·보물 난수 스트림 고정 (벤치마크 재현성)

const rows = estimateWaveXP({ residency: 16, seed: 7 });
const fixture = JSON.parse(readFileSync(new URL('./fixtures/planned-boss-builds.json', import.meta.url), 'utf8'));

test('XP estimates use ten real stages, include boss gems separately and reproduce the seeded director', () => {
    assert.equal(rows.length, 10);
    assert.deepEqual(estimateWaveXP({ residency: 16, seed: 7 }), rows);
    for (const r of rows) {
        assert.ok(r.kills > 0 && r.waveXP > 0 && r.eliteKills > 0);
        assert.equal(r.bossXP, BOSS_XP_GEMS * bossGemValue(r.stage));
        assert.ok(r.uncreditedSurvivors > 0, 'survivors are not invented XP');
    }
});

test('boss benchmark snapshots are reproduced by actual rolls and fit the six weapon slot contract', () => {
    assert.deepEqual(makeBossBuildFixtures(), fixture, 'the documented --fixtures command reproduces the complete artifact');
    for (const f of fixture.builds) {
        const run = simulatePlan({ rows, collection: .85, mode: f.mode, seed: f.seed });
        const snapshot = run.stages[f.stage - 1].beforeBoss;
        for (const key of ['level', 'weapons', 'passives', 'stats', 'finals', 'absolutes']) assert.deepEqual(snapshot[key], f[key], `${f.name}/${key}`);
        assert.ok(snapshot.weapons.length <= 6 && Object.keys(snapshot.passives).length <= 12);
        for (const w of snapshot.weapons) assert.ok(w.level >= 1 && w.level <= 8);
        assert.ok(run.exchanges.length <= 1);
    }
});

test('seeded planned versus scattered runs conserve item investment and respect real chest evolution', () => {
    const result = {};
    for (const mode of ['planned', 'scattered', 'absolute', 'butcher']) {
        const runs = [];
        for (let seed = 1; seed <= 40; seed++) {
            const run = simulatePlan({ rows, mode, seed }); runs.push(run);
            const end = run.stages[9].afterReward;
            const choices = Object.entries(run.itemChoices).filter(([id]) => !['gold', 'meat'].includes(id)).reduce((n, [, v]) => n + v, 0);
            const consumed = run.fusions.reduce((n, f) => n + FUSION_RECIPES.find(r => r.id === f.id).inputs.length * 8 - 1, 0);
            const lost = run.exchanges.reduce((n, x) => n + x.lostLevel - 1, 0);
            const invested = end.weapons.reduce((n, w) => n + w.level, 0) + Object.values(end.passives).reduce((a, b) => a + b, 0) + consumed + lost - run.initialInvestment;
            assert.equal(invested, choices + run.chestUpgrades, 'no invented levels from planner');
            const consumedEvolutions = {};
            for (const f of run.fusions) for (const input of FUSION_RECIPES.find(r => r.id === f.id).inputs) {
                consumedEvolutions[input.id] = (consumedEvolutions[input.id] || 0) + 1;
                assert.ok(run.evolutions.filter(e => e.id === input.id && e.stage <= f.stage).length >= consumedEvolutions[input.id]);
            }
            assert.ok(run.exchanges.length <= 1);
            for (const s of run.stages) for (const b of [s.beforeBoss, s.afterReward]) {
                assert.ok(b.weapons.length <= 6 && Object.keys(b.passives).length <= 12);
                for (const w of b.weapons) if (WEAPONS[w.id].fusionOnly) assert.equal(w.evolved, false);
            }
        }
        result[mode] = summarizePlans(runs);
    }
    // 느려진 레벨업(STAGE_XP_YIELD 0.55 + 5·10·13·18·27레벨 가속) + 14개 조합: 모든 장비를 최대로 만드는 것은 불가능하다.
    // 측정(40시드): 집중 빌드 최종 1개 11 / 2개 28 / 3개 1, 도살 빌드 1개 12 / 2개 28, 절대 빌드는 28/40이 절대 무기를 갖춘다.
    assert.ok((result.planned.beforeBoss10Finals[3] || 0) <= 5, 'three finals before the last boss are rare');
    assert.ok((result.planned.beforeBoss10Finals[2] || 0) + (result.planned.beforeBoss10Finals[3] || 0) >= 20, 'a focused build still reaches two finals in most runs');
    assert.ok((result.absolute.beforeBoss10Absolutes[1] || 0) >= 20 && (result.absolute.beforeBoss10Absolutes[1] || 0) < 40, 'absolute route is usually, not always, complete');
    assert.ok((result.butcher.beforeBoss10Finals[2] || 0) + (result.butcher.beforeBoss10Finals[3] || 0) >= 20, 'butcher route usually reaches two finals');
    assert.ok((result.butcher.beforeBoss10Finals[3] || 0) <= 5);
    assert.ok((result.scattered.beforeBoss10Finals[0] || 0) + (result.scattered.beforeBoss10Finals[1] || 0) > 0);
    // 보조 아이템은 슬롯 제한이 없어 진화 짝을 얻으려고 교체할 필요가 없다.
    assert.equal(result.scattered.exchangesUsed, 0);
});

test('the final boss reward cannot retroactively become the build used against that boss', () => {
    const run = simulatePlan({ rows, seed: 101, mode: 'planned' });
    assert.notEqual(run.stages[9].beforeBoss, run.stages[9].afterReward);
    assert.ok(run.stages[9].afterReward.level >= run.stages[9].beforeBoss.level);
    const none = rows.map(r => ({ ...r, waveXP: 0, bossXP: 0 }));
    // 경험치도 필드 보급품도 없으면 선택은 0회
    const noChoices = simulatePlan({ rows: none, seed: 1, fieldCaches: false });
    assert.equal(noChoices.choices, 0);
    assert.equal(noChoices.fusions.length, 0, 'chests alone cannot discover missing weapons or passives');
    assert.equal(noChoices.stages[9].beforeBoss.weapons.length, 1);
    assert.deepEqual(noChoices.stages[9].beforeBoss.passives, {});
});

test('Butcher receives the actual two weapons and passive once without invented choice investment',()=>{
 const none=rows.map(r=>({...r,waveXP:0,bossXP:0}));const run=simulatePlan({rows:none,mode:'butcher',fieldCaches:false});
 assert.equal(run.initialInvestment,3);assert.equal(run.choices,0);assert.deepEqual(run.stages[0].beforeBoss.weapons.map(w=>[w.id,w.level]),[['sword',1],['saw',1]]);assert.deepEqual(run.stages[0].beforeBoss.passives,{whet:1});
});
