import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { simulateTech, TECH_ROUTES, TECH_SCENES } from './helpers/tech-power.mjs';
import { runBalanceScene, balanceConfiguration, BALANCE_SCENES, measurePlagueFieldUptime } from '../tools/cannon-growth-qa.mjs';
import { images } from '../src/core/assets.js';
import { WEAPONS } from '../src/data/weapons.js';
import { FUSION_RECIPES } from '../src/data/fusions.js';

// A single normalized 1.35x all-tech band mixed boss damage, 18-target damage,
// sustain and execution into one number. It also changed every class's score
// whenever an unrelated class improved. These contracts instead retain measured
// pre-change damage floors and test explicit equal-investment role tradeoffs.
//
// These immortal-target probes are deterministic regression diagnostics. They
// are NOT a guarantee of full gameplay balance or a survival/clear-time model.
// Normal-enemy execution is excluded via elite fixtures and tested separately
// with finite HP in executioner-identity.mjs.
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/tech-role-baseline.json', import.meta.url)));
const roles = new Map();
function role(tech, phase, scene) {
    const key = `${tech}:${phase}:${scene}`;
    if (!roles.has(key)) roles.set(key, runBalanceScene({ tech, ...balanceConfiguration(tech, phase), scene, seconds: 30 }));
    return roles.get(key);
}

for (const tech of Object.keys(TECH_ROUTES)) for (const stage of ['late', 'fusion']) {
    test(`${tech} ${stage} retains its recorded pre-change damage floor in all four controls`, () => {
        const [weapons, fusion] = TECH_ROUTES[tech];
        const build = stage === 'late' ? weapons.map(id => [id, 8, true]) : [[fusion, 8, false]];
        // The historical helper uses the original muzzle geometry, independently
        // of the modern-body moving probes below.
        delete images.playerFire;
        for (const scene of TECH_SCENES) {
            // Thorns now orbit at a fixed close radius by request; the immobile scatter
            // probe parks targets 85px+ away, outside any close ring, so it no longer measures them.
            if (scene === 'scatter' && build.some(([id]) => id === 'thorns')) continue;
            const previous = baseline.techs[`${tech}:${stage}`][scene];
            const current = simulateTech(tech, build, scene), ratio = current / previous;
            // 최종·절대 무기 2차 대폭 하향(요청)으로 조합 단계는 과거 기록의 절반까지 내려갈 수 있다. 진화 단계 하한은 그대로.
            const floor = stage === 'fusion' ? 0.5 : 1 - baseline.tolerance;
            assert.ok(ratio >= floor, `${tech}/${stage}/${scene}: ${ratio.toFixed(4)} of ${baseline.commit}`);
            // 총기 역할 분리로 진화 산탄총·레일 소총이 강화되어 건라인 진화 경로는 더 이상 '불변 대조군'이 아니다 (하한만 유지).
        }
    });
}

test('moving role probes use equal weapon/passive budgets at each comparable progression point', () => {
    for (const [phase, investment] of [['equal_starter', 3], ['mid', 14], ['evolved', 31], ['final', 38]]) {
        for (const tech of Object.keys(TECH_ROUTES)) assert.equal(balanceConfiguration(tech, phase).investment, investment);
    }
});

test('equal-budget evolved and final fixtures retain every required evolution passive', () => {
    for (const tech of Object.keys(TECH_ROUTES)) for (const phase of ['evolved', 'final']) {
        const { build, passives } = balanceConfiguration(tech, phase);
        const inputs = phase === 'evolved' ? build.map(([id]) => id) :
            FUSION_RECIPES.find(recipe => recipe.output === build[0][0]).inputs.map(input => input.id);
        for (const id of inputs) assert.ok(passives[WEAPONS[id].evolve.with] >= 1, `${tech}/${phase} missing ${WEAPONS[id].evolve.with}`);
    }
});

for (const phase of ['mid', 'evolved', 'final']) {
    test(`${phase}: Executioner keeps its mobility identity over Gunline (frontal boss firepower belongs to Gunline)`, () => {
        // 총기 역할 분리: 건라인(전방 집중 화력·관통)이 보스 화력을, 처형자는 기동성·치명타·일반 적 처형을 맡는다.
        const executioner = role('executioner', phase, 'boss_focused'), gunline = role('gunline', phase, 'boss_focused');
        assert.ok(executioner.dps > 0 && gunline.dps > 0);
        assert.ok(executioner.survival.speed > gunline.survival.speed);
        assert.equal(executioner.survival.armor, 0);
        assert.equal(executioner.survival.regenPerSecond, 0);
    });
    test(`${phase}: Bloom combines broad coverage and sustain without multiplying single-target damage by ray count`, () => {
        const bloom = role('bloom', phase, 'boss_focused'), gunline = role('gunline', phase, 'boss_focused');
        // The requested Cannon buff intentionally supersedes "always weaker
        // than Gunline on bosses". Keep the distinct crowd/sustain role plus
        // exact one-hit-per-volley assertions in cannon-growth.mjs instead.
        assert.ok(bloom.dps > 0);
        assert.ok(role('bloom', phase, 'swarm_stationary').dps > bloom.dps * 3);
        assert.ok(role('bloom', phase, 'swarm_stationary').dps > role('gunline', phase, 'swarm_stationary').dps);
        // 무기 밸런스 재조정(tools/weapon-balance-bench.mjs --routes): 꽃잎포가 사기적이던 때만 흩어진 적에서도 탄막 사수를 앞섰다.
        // 연꽃 정원의 무리 우위는 근접 무리(swarm)로 지키고, 흩어진 이동 적에서는 크게 뒤처지지만 않게 한다.
        assert.ok(role('bloom', phase, 'dispersed_moving').dps > role('gunline', phase, 'dispersed_moving').dps * .55);
        assert.ok(bloom.survival.maxHp > gunline.survival.maxHp);
        assert.ok(bloom.survival.regenPerSecond > 0);
        assert.ok(bloom.survival.pollenRecharge > 0);
    });
    test(`${phase}: Plague has sustained swarm damage and armor with a real field-uptime limitation`, () => {
        const plague = role('plague', phase, 'boss_focused'), gunline = role('gunline', phase, 'boss_focused');
        assert.ok(plague.dps > 0);
        if (phase === 'final') {
            // Final Plague can exceed Gunline against a stationary boss inside
            // stacked fields. That is valid sustained-field strength, not a
            // reason to nerf it back to the old cross-role ordering. The later
            // explicit non-gun buff also supersedes that ordering at mid-game.
            // Test its actual limitation instead: a moving target exits a live,
            // fixed field even with the real slow applied and predictive landing.
            const still = measurePlagueFieldUptime({ moving: false }), moving = measurePlagueFieldUptime({ moving: true });
            assert.ok(moving.damage > 0 && moving.damage < still.damage);
            assert.ok(moving.coveredSeconds < still.coveredSeconds * .65);
            assert.ok(moving.fieldAliveAtEnd && moving.slowPeak > 0);
            assert.deepEqual(moving.finalCenter, moving.landing, 'a readable field never follows the escaped target');
            assert.ok(moving.lastHitTime < moving.seconds - .5);
        }
        assert.ok(role('plague', phase, 'swarm_stationary').dps > role('gunline', phase, 'swarm_stationary').dps);
        assert.ok(plague.survival.armor > gunline.survival.armor);
    });
    test(`${phase}: Butcher rewards close contact per target and keeps an HP/armor advantage`, () => {
        const near = role('butcher', phase, 'swarm_stationary'), far = role('butcher', phase, 'boss_focused');
        const gunline = role('gunline', phase, 'boss_focused');
        assert.ok(near.dps / near.targetCount > far.dps, `per-target close ${near.dps / near.targetCount}, far ${far.dps}`);
        assert.ok(far.dps < gunline.dps);
        assert.ok(far.survival.maxHp > gunline.survival.maxHp);
        assert.ok(far.survival.armor > gunline.survival.armor);
    });
}

for (const tech of Object.keys(TECH_ROUTES)) test(`${tech} improves its own equal-budget progression in stationary and moving probes`, () => {
    const phases = ['equal_starter', 'mid', 'evolved', 'final'];
    for (const scene of BALANCE_SCENES) {
        for (let i = 1; i < phases.length; i++) {
            const before = role(tech, phases[i - 1], scene), after = role(tech, phases[i], scene);
            assert.ok(after.dps > before.dps, `${tech}/${scene}: ${phases[i - 1]} ${before.dps} -> ${phases[i]} ${after.dps}`);
        }
    }
});
