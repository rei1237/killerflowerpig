import { createPractice, advancePractice, focusPracticeAt, choosePracticeUpgrade, PRACTICE_WORLD } from '../game/practice.js';
import { isTargetTap, joystickVector } from '../core/input.js';
import { firingDrawRect, shotFrame, markPlayerShot } from '../game/player-motion.js';
import { PASSIVES } from '../data/weapons.js';
export const PRACTICE_KEY = 'kfp.practice.v1';
const STAGES = [
    ['먼저, 자유롭게 움직여 보세요', 'WASD / 방향키 또는 연습장을 누른 채 드래그하세요. 꽃돼지가 조금 이동하면 다음 단계로 넘어가요.'],
    ['토끼 표적을 짧게 눌러 보세요', '클릭 / 탭으로 집중 조준해요. 같은 적을 다시 누르면 해제돼요. 키보드는 아래 표적 집중 버튼을 사용하세요.'],
    ['파란 경험치 젬으로 다가가세요', '이동해서 경험치 젬을 주워 보세요. 실전에서는 적이 떨어뜨린 젬을 모아 레벨을 올려요. (금화는 네임드 적에게서만 드물게 나와요)'],
    ['강화 하나를 직접 골라 보세요', '실전에서는 경험치 젬으로 레벨을 올려 강화를 선택해요. 여기서는 연습을 위해 선택 화면을 열었어요.'],
    ['준비 완료!', '이동 · 집중 조준 · 수집 · 강화까지 모두 해봤어요. 실전에서도 공격은 자동이에요.'],
];
let root, canvas, ctx, hooks = {}, opened = false, acknowledged = false, state, callback, restoreFocus;
let isolated = [], frameId, lastTime = 0, previousStep = -1, keys = new Set(), pointer = null, joystick = {x:0,y:0};
let hero, rabbit, suspended = false, rasterScale = 1;
const MAP = { KeyW:[0,-1], ArrowUp:[0,-1], KeyS:[0,1], ArrowDown:[0,1], KeyA:[-1,0], ArrowLeft:[-1,0], KeyD:[1,0], ArrowRight:[1,0] };
function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls;if(text)n.textContent=text;return n; }
function btn(cls,text,fn){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
export function shouldOfferPractice(){if(acknowledged)return false;try{return localStorage.getItem(PRACTICE_KEY)!=='done';}catch{return true;}}
export function isPracticeOpen(){return opened;}
export function initPractice(options={}) {
    hooks=options;if(root)return;
    root=el('section','practice-overlay');root.id='practice';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','practice-heading');
    const panel=el('div','practice-panel'),top=el('div','practice-top');
    top.append(el('span','practice-eyebrow','SAFE TRAINING · 안전한 연습장'),btn('practice-skip','건너뛰기',()=>closePractice()));
    const info=el('div','practice-info');info.setAttribute('aria-live','polite');info.setAttribute('aria-atomic','true');
    const count=el('p','practice-count'),heading=el('h2');heading.id='practice-heading';heading.tabIndex=-1;
    info.append(count,heading,el('p','practice-instruction'));
    canvas=el('canvas','practice-canvas');
    // 고해상도 화면에서도 선명하게: 월드 좌표는 그대로, 래스터만 기기 픽셀 비율(최대 2배)로 그린다.
    rasterScale=Math.min(2,Math.max(1,(typeof window!=='undefined'&&window.devicePixelRatio)||1));canvas.width=Math.round(PRACTICE_WORLD.width*rasterScale);canvas.height=Math.round(PRACTICE_WORLD.height*rasterScale);canvas.setAttribute('aria-label','꽃돼지 연습장. 이동, 토끼 집중 조준, 경험치 젬 수집을 연습하세요.');canvas.setAttribute('role','img');ctx=canvas.getContext('2d');
    const actions=el('div','practice-actions');
    const focus=btn('practice-focus','표적 집중',()=>{if(state.step===1||state.step===2){focusPracticeAt(state,state.dummy.x,state.dummy.y-state.dummy.radius);sync();}});
    const choices=el('div','practice-choices');
    for(const id of ['whet','heart']){const b=btn('practice-choice',`${PASSIVES[id].name} · ${PASSIVES[id].per}`,()=>{if(choosePracticeUpgrade(state,id)){sync();root.querySelector('.practice-finish').focus();}});b.dataset.upgrade=id;choices.append(b);}
    const finish=btn('practice-finish','연습 완료',()=>closePractice());
    actions.append(focus,choices,finish);
    const safety=el('p','practice-safety','적 공격·시간 제한 없음 · 연습 결과는 실제 경험치·코인·장비에 저장되지 않아요');
    panel.append(top,info,canvas,actions,safety);root.append(panel);document.body.append(root);
    hero=new Image();hero.src='asset/sprites/player-fire.png';rabbit=new Image();rabbit.src='asset/ui-rabbit.png';
    document.addEventListener?.('visibilitychange',()=>document.hidden?suspendPractice():resumePractice());
    window.addEventListener('pagehide',suspendPractice);window.addEventListener('pageshow',resumePractice);
    window.addEventListener('keydown',keydown,true);window.addEventListener('keyup',keyup,true);window.addEventListener('blur',resetControls);
    canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointermove',pointermove);canvas.addEventListener('pointerup',pointerup);canvas.addEventListener('pointercancel',()=>{pointer=null;joystick={x:0,y:0};});
    canvas.addEventListener('lostpointercapture',()=>{pointer=null;joystick={x:0,y:0};});
}
function resetControls(){keys.clear();pointer=null;joystick={x:0,y:0};lastTime=0;}
function pointerdown(e){
    if(!opened||state.complete||state.step===3)return;
    if(pointer){pointer.multitouch=true;return;}
    if(e.isPrimary===false||e.button>0)return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,time:performance.now(),distance:0,dragging:false,multitouch:false};
    canvas.setPointerCapture?.(e.pointerId);e.preventDefault();
}
function pointermove(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    pointer.distance=Math.max(pointer.distance,Math.hypot(dx,dy));pointer.lastX=e.clientX;pointer.lastY=e.clientY;
    if(pointer.distance>8)pointer.dragging=true;
    if(pointer.dragging)joystick=joystickVector(dx,dy);
    e.preventDefault();
}
function pointerup(e){
    if(!pointer||pointer.id!==e.pointerId)return;
    const p=pointer;pointer=null;joystick={x:0,y:0};
    const distance=Math.max(p.distance,Math.hypot(e.clientX-p.x,e.clientY-p.y));
    if(isTargetTap({duration:performance.now()-p.time,distance,multitouch:p.multitouch,canceled:false})){
        const rect=canvas.getBoundingClientRect();
        focusPracticeAt(state,(e.clientX-rect.left)*PRACTICE_WORLD.width/rect.width,(e.clientY-rect.top)*PRACTICE_WORLD.height/rect.height);sync();
    }
    e.preventDefault();
}
function keydown(e){
    if(!opened)return;e.stopImmediatePropagation();
    if(e.code==='Escape'){e.preventDefault();closePractice();return;}
    if(MAP[e.code]){keys.add(e.code);e.preventDefault();return;}
    if(e.code!=='Tab')return;
    const items=[...root.querySelectorAll('button')].filter(n=>!n.disabled&&!n.hidden&&!n.parentElement?.hidden),first=items[0],last=items[items.length-1];
    if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){e.preventDefault();first.focus();}
}
function keyup(e){if(!opened)return;e.stopImmediatePropagation();keys.delete(e.code);}
function sync(){
    if(previousStep===state.step)return;previousStep=state.step;
    const [title,description]=STAGES[state.step];
    root.querySelector('#practice-heading').textContent=title;root.querySelector('.practice-instruction').textContent=description;
    root.querySelector('.practice-count').textContent=state.complete?'4 / 4 · 연습 완료':`${state.step+1} / 4 · 직접 해보기`;
    root.querySelector('.practice-focus').hidden=state.step!==1&&state.step!==2;
    root.querySelector('.practice-choices').hidden=state.step!==3;
    root.querySelector('.practice-finish').hidden=!state.complete;
    root.dataset.step=String(state.step);
    if(state.step===3){resetControls();root.querySelector('[data-upgrade="whet"]').focus();}
}
function suspendPractice(){suspended=true;cancelAnimationFrame(frameId);frameId=null;resetControls();}
function resumePractice(){if(document.hidden)return;suspended=false;resetControls();schedulePractice();}
function schedulePractice(){if(opened&&!suspended&&!document.hidden&&frameId==null)frameId=requestAnimationFrame(tick);}
function tick(time){
    frameId=null;
    if(!opened||suspended||document.hidden)return;
    const dt=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
    let x=0,y=0;for(const code of keys){const v=MAP[code];if(v){x+=v[0];y+=v[1];}}
    const len=Math.hypot(x,y);let move=len?{x:x/len,y:y/len}:joystick;
    advancePractice(state,move,dt);sync();draw();schedulePractice();
}
function draw(){
    if(!ctx)return;const p=state.player,w=PRACTICE_WORLD.width,h=PRACTICE_WORLD.height;
    ctx.setTransform?.(rasterScale,0,0,rasterScale,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#101f35';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#a3c7ee0d';ctx.lineWidth=1;
    for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=20;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.fillStyle='#9bb5d1';ctx.font='12px sans-serif';ctx.fillText('TRAINING',20,25);
    const d=state.dummy;
    if(state.step>=1){
        ctx.save();ctx.globalAlpha=state.step===1?1:.7;
        if(rabbit.complete&&rabbit.naturalWidth)ctx.drawImage(rabbit,d.x-40,d.y-80,80,80);
        else{ctx.fillStyle='#85b8db';ctx.beginPath();ctx.ellipse(d.x,d.y-30,25,35,0,0,Math.PI*2);ctx.fill();}
        ctx.restore();ctx.fillStyle='#d6e8ff';ctx.textAlign='center';ctx.fillText('연습 표적',d.x,d.y+18);
        if(state.target||state.step===1){ctx.strokeStyle=state.target?'#ffe19a':'#94dcff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(d.x,d.y-30,43,0,Math.PI*2);ctx.stroke();}
    }
    if(state.step>=2&&!state.coin.collected){
        // 연습용 경험치 젬 (실전의 파란 젬과 같은 모양)
        const c=state.coin,bob=Math.sin(state.clock*4)*3;ctx.strokeStyle='#8fd8ff88';ctx.beginPath();ctx.arc(c.x,c.y,27,0,Math.PI*2);ctx.stroke();
        ctx.save();ctx.translate(c.x,c.y+bob);ctx.shadowColor='#5fc8ff';ctx.shadowBlur=14;ctx.fillStyle='#4fb4ff';
        ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(11,0);ctx.lineTo(0,15);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle='#d9f3ff';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(5,-1);ctx.lineTo(0,2);ctx.lineTo(-5,-1);ctx.closePath();ctx.fill();ctx.restore();
        ctx.fillStyle='#bfe7ff';ctx.fillText('경험치 젬',c.x,c.y+44);
    }
    if(state.target&&state.step<3){
        if(!Number.isFinite(p.shotAt)||state.clock-p.shotAt>.65)markPlayerShot(p,state.clock,d.x-p.x);
        const t=(state.clock-p.shotAt)/.65;
        ctx.fillStyle='#a8f7de';ctx.beginPath();ctx.arc(p.x+(d.x-p.x)*t,p.y-28+(d.y-30-(p.y-28))*t,4,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(p.x,p.y,22,7,0,0,Math.PI*2);ctx.fill();
    if(hero.complete&&hero.naturalWidth){ctx.save();ctx.translate(p.x,p.y);if(p.flip)ctx.scale(-1,1);ctx.drawImage(hero,...firingDrawRect(shotFrame(state.clock-p.shotAt)));ctx.restore();}
    else{ctx.fillStyle='#f7bdc7';ctx.beginPath();ctx.arc(p.x,p.y-20,20,0,Math.PI*2);ctx.fill();}
    ctx.textAlign='start';
    if(state.step===0){ctx.fillStyle='#ffffff16';ctx.fillRect(20,h-20,w-40,4);ctx.fillStyle='#99e4ef';ctx.fillRect(20,h-20,(w-40)*Math.min(1,state.moved/80),4);}
}
export function openPractice({onDone}={}){
    if(opened)return false;if(!root)initPractice(hooks);opened=true;state=createPractice();callback=onDone;restoreFocus=document.activeElement;previousStep=-1;resetControls();
    hooks.onOpen?.();isolated=[...document.body.children].filter(n=>n!==root).map(n=>[n,n.inert]);for(const[n]of isolated)n.inert=true;
    root.hidden=false;sync();root.querySelector('#practice-heading').focus({preventScroll:true});schedulePractice();return true;
}
function endPractice(completed){
    if(!opened)return false;opened=false;cancelAnimationFrame(frameId);frameId=null;resetControls();root.hidden=true;
    if(completed){acknowledged=true;try{localStorage.setItem(PRACTICE_KEY,'done');}catch{/* Storage cannot block practice. */}}
    for(const[n,inert]of isolated)n.inert=inert;isolated=[];
    const done=completed?callback:null;callback=null;state=null;hooks.onClose?.();
    if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});restoreFocus=null;
    done?.();return true;
}
export function closePractice(){return endPractice(true);}
// Forced navigation cleans up without marking the guide seen or starting a run.
export function cancelPractice(){return endPractice(false);}
