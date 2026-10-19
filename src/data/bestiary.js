import { ENEMIES, ELITE, RANGED_UNLOCK_STAGE, DEATH_CLOUD_UNLOCK_STAGE } from './enemies.js';
import { ENCIRCLEMENT } from '../game/encirclement.js';
import { BOSSES, HUNTER_TUNING } from './bosses.js';
import { STAGES } from './stages.js';
import { SPRITES } from './sprites.js';
import { COIN_DROPS } from '../game/coin-drops.js';
const notes={
 shambler:['추적형','몸을 향해 천천히 접근합니다.','접촉 공격으로 이동 공간을 줄입니다.','넓게 돌며 한쪽에 모으고 빈 방향으로 이동하세요.'],
 runner:['고속 추적형','작은 몸으로 빠르게 거리를 좁힙니다.','다른 적 뒤에서 빈틈으로 파고듭니다.','뒤로만 달리지 말고 옆으로 공간을 확보하세요.'],
 brute:['중장갑 근접형','큰 몸과 느린 걸음이 특징입니다.','높은 체력과 접촉 피해로 길을 막습니다.','좁은 틈으로 비집지 말고 느린 발을 이용해 우회하세요.'],
 spitter:['원거리 산성형','사거리 안에서 접근을 멈추고 산성탄을 발사합니다.','산성탄을 피하면서 근접 적도 경계해야 합니다.','탄의 진행 방향과 수직으로 움직이세요.'],
 bloater:['사망 폭발·독 구역형','부푼 몸 주변은 쓰러뜨릴 때도 위험합니다.','사망 즉시 폭발하며 STAGE '+DEATH_CLOUD_UNLOCK_STAGE+'부터 독 장판도 남깁니다.','붙어서 마무리하지 말고 쓰러진 자리에서 즉시 벗어나세요.'],
 splitter:['분열형','큰 숙주가 가까이 접근합니다.','사망하면 작은 추적 개체로 분열합니다.','처치 직후에도 멈추지 말고 작은 적을 정리하세요.'],
 hulk:['고체력 차단형','아주 큰 실루엣이 이동 경로를 가로막습니다.','높은 체력·접촉 피해와 무거운 몸을 가집니다.','퇴로를 먼저 확보하고 집중 공격하세요.'],
 suicider:['고정 돌진·자폭형','노란 돌진선과 폭발 원이 먼저 표시됩니다.','방향을 고정해 돌진한 뒤 정지하여 점화하고 폭발합니다. 접촉 피해나 독 장판은 없습니다.','예고선 옆으로 피한 뒤 원 밖으로 나가세요. 폭발 전에 처치하면 해제됩니다.'],
 gunner:['조준 사격형','금빛 조준선이 고정된 뒤 탄환 한 발을 쏩니다.','산성탄과 다른 빠른 직선 탄환을 발사합니다.','선이 멈추면 옆으로 움직이거나 조준 중 처치하세요.'],
};
const bossTells={charge:'긴 직선 돌진 예고',barrage:'고정된 사격선과 재장전',hunt:`첫 돌진 ${HUNTER_TUNING.warning}초 · 두 번째 ${HUNTER_TUNING.secondWarning}초 예고`,lockshot:'정지하는 저격선과 연속 사격',artillery:'전방에 표시되는 포격 원',toxicTide:'독 웅덩이 사이 출구',crosscut:'연달아 교차하는 칼날 선',echo:'환영 탄막 이후 반대편 메아리',faultline:'양옆 균열 이후 중앙 강타'};
export function firstEnemyStage(id){
 const def=ENEMIES[id];if(!def)return null;
 const minimum=Math.max(def.unlockStage||1,def.ranged?RANGED_UNLOCK_STAGE:1);
 return Object.keys(STAGES).map(Number).sort((a,b)=>a-b).find(stage=>stage>=minimum&&STAGES[stage].weights.some(([,w])=>w[id]>0))||minimum;
}
export function bestiaryEntries(){
 const entries=[];
 for(const [id,def] of Object.entries(ENEMIES))for(const elite of [false,true]){
  const [role,tell,pattern,counter]=notes[id]||['추적형','접근 방향을 살피세요.','접촉을 경계하세요.','안전한 이동 공간을 확보하세요.'];
  const details=[];
  if(def.charge)details.push(`돌진 예고 ${def.charge.warning}초 · 속도 ${def.charge.speed} · 최대 ${def.charge.duration}초 · 점화 ${def.charge.fuse}초 · 폭발 반경 ${def.charge.radius} · 기본 자폭 피해 ${def.charge.dmg} (상한 ${def.charge.damageCap})`);
  if(def.ranged)details.push(`발사 간격 ${def.ranged.cooldown}초 · 탄속 ${def.ranged.speed}${def.ranged.warning?` · 조준 예고 ${def.ranged.warning}초`:''}`);
  if(def.explode)details.push(`사망 폭발 반경 ${def.explode.radius} · 기본 피해 ${def.explode.dmg}`);
  if(def.split)details.push(`사망 시 ${ENEMIES[def.split.type]?.name} ${def.split.count}마리`);
  entries.push({id:`${elite?'elite':'enemy'}-${id}`,enemyId:id,name:(elite?'정예 · ':'')+def.name,kind:elite?'elite':'ordinary',stage:firstEnemyStage(id),role,tell,pattern,counter,details,
   hp:def.hp*(elite?ELITE.hp:1),speed:def.speed*(elite?ELITE.speed:1),damage:def.charge?0:def.dmg*(elite?ELITE.dmg:1),sprite:SPRITES[def.sheet],sheet:def.sheet,tint:elite?'elite':def.tint,
   image:id==='suicider'?'asset/enemies/rabbit-suicider.png':id==='gunner'?'asset/enemies/rabbit-gunner.png':null,
   reward:elite?`경험치 + 코인 ${COIN_DROPS.eliteValue}개 · 장비 상자 없음`:`경험치 · 코인 ${COIN_DROPS.ordinaryChance*100}% 확률 · 회복/자석은 별도 조건`,
   statNote:'스테이지·시간 배율 적용 전 기본값. 정예는 정예 배율 포함. 실제 체력·피해는 구역과 이벤트에 따라 달라집니다.'+(elite?' 정예화 가능한 변종이며 실제 출현은 이벤트 편성을 따릅니다.':'')});
 }
 // Deliberate allowlist: final boss never enters guide data/search/detail/navigation.
 for(let stage=1;stage<=9;stage++){const def=BOSSES[stage];if(!def)continue;
  entries.push({id:`boss-${stage}`,name:def.name,kind:'boss',stage,role:'구역 보스',tell:bossTells[def.signature]||'바닥 예고 표시를 확인하세요.',pattern:stage===3?`빠른 추적 후 방향을 각각 고정하는 2연속 돌진. 돌진 속도 ${[0,1,2].map(p=>Math.round(HUNTER_TUNING.dashSpeed*(1+p*HUNTER_TUNING.phaseSpeedStep))).join(' / ')} (페이즈별), 회복 ${HUNTER_TUNING.recovery}초.`:`고유 패턴: ${bossTells[def.signature]||def.signature}. 체력이 줄면 후속 공격이 강화됩니다.`,counter:def.signatureHint,details:[],hp:def.hp,speed:def.speed,damage:def.dmg,image:`asset/bosses/boss-${String(stage).padStart(2,'0')}.webp`,reward:'처치 시 보스 장비 상자 확정',statNote:'보스 정의의 기본 능력치입니다. 개별 기술의 피해·속도는 접촉 능력치와 다릅니다.'});
 }
 return entries;
}
export function findBestiaryEntry(id){return bestiaryEntries().find(entry=>entry.id===id)||null;}
export function searchBestiary(query='',kind='all'){
 const q=String(query).trim().toLocaleLowerCase();return bestiaryEntries().filter(e=>(kind==='all'||e.kind===kind)&&`${e.name} ${e.role} ${e.stage} ${e.tell} ${e.pattern}`.toLocaleLowerCase().includes(q));
}

export const ENCLOSURE_GUIDE = `STAGE ${ENCIRCLEMENT.minStage}부터 시간형 독 안개 포위가 나타납니다. ${ENCIRCLEMENT.warning}초 예고 후 ${ENCIRCLEMENT.active}초 유지, 재발동 간격 ${ENCIRCLEMENT.cooldown}초. 직접 피해는 없지만 이동 공간을 제한합니다. 팽창체의 사망 독 장판과는 별개입니다.`;
