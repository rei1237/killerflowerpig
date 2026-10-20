// Real sword weapon release: one readable local arc per weapon cooldown.
// Inventory, evolution and inherited fusion cores use the ordinary weapon pipeline.
import { G } from './state.js';
import { hitEnemy } from './enemies.js';
import { preferredTarget } from './targeting.js';
import { markPlayerAttack } from './attack-animation.js';
export function swordStats(w, s = w.s) {
    return { damage: s.dmg, cooldown: s.cd,
        radius: Math.min(w.id === 'sword_wheel' ? 200 : 175, (s.radius || 100) * Math.sqrt(s.area)),
        halfArc: Math.min(Math.PI * .65, Math.PI * .4 + Math.max(0, s.amount - 1) * .08), bleed: s.bleed || 0, crit: s.crit || 0, critBonus: s.critBonus || 0 };
}
export function withinSwordArc(target, x, y, angle, radius, halfArc) {
    const dx = target.x - x, dy = target.y - target.radius - y, distance = Math.hypot(dx, dy);
    if (distance > radius + target.radius) return false;
    if (distance <= target.radius) return true;
    const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
    return Math.abs(delta) <= halfArc + Math.asin(Math.min(1, target.radius / distance));
}
export function fireSword(w, s) {
    const p = G.player;
    if (!p || p.dead) return false;
    const stats = swordStats(w, s), x = p.x, y = p.y - 20;
    let target = preferredTarget(x, y, stats.radius + 35), distance = Infinity;
    if (target && Math.hypot(target.x-x,target.y-target.radius-y)>stats.radius+target.radius) target=null;
    if (!target) for (let i=0;i<G.enemies.count;i++) { const e=G.enemies.items[i]; if(!e.alive)continue;
        const d=Math.hypot(e.x-x,e.y-e.radius-y);if(d<stats.radius+e.radius&&d<distance){target=e;distance=d;} }
    if (!target && G.boss?.alive && Math.hypot(G.boss.x-x,G.boss.y-G.boss.radius-y)<stats.radius+G.boss.radius) target=G.boss;
    if (!target) { w.cd = Math.min(w.cd, .12); return false; } // retry cheaply without an empty swing
    const angle = Math.atan2(target.y-target.radius-y,target.x-x);
    p.swordSwing = { at:G.clock,x,y,angle,radius:stats.radius,halfArc:stats.halfArc };
    markPlayerAttack(p,G.clock,w,Math.cos(angle),{tech:G.tech,family:'sword'});
    const weapon = w.sourceId || w.id;
    for(let i=0;i<G.enemies.count;i++){const e=G.enemies.items[i];if(e.alive&&withinSwordArc(e,x,y,angle,stats.radius,stats.halfArc))
        hitEnemy(e,stats.damage,{weapon,kx:Math.cos(angle),ky:Math.sin(angle),knock:180,bleed:stats.bleed,crit:stats.crit,critBonus:stats.critBonus});}
    const boss=G.boss;if(boss?.alive&&withinSwordArc(boss,x,y,angle,stats.radius,stats.halfArc))boss.hurt(stats.damage,{weapon,crit:stats.crit,critBonus:stats.critBonus});
    return true;
}
export function drawButcherSword(ctx, reducedMotion=false) {
    const swing=G.player?.swordSwing;if(!swing)return;
    const age=G.clock-swing.at;if(age<0||age>.18)return;
    ctx.save();ctx.strokeStyle='#ffe9b3';ctx.globalAlpha=.7*(1-age/.18);ctx.lineWidth=reducedMotion?3:7;
    ctx.beginPath();ctx.arc(swing.x,swing.y,swing.radius,swing.angle-swing.halfArc,swing.angle+swing.halfArc);ctx.stroke();ctx.restore();
}
