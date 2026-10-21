import { atlases } from '../core/assets.js';
import { searchBestiary, findBestiaryEntry, ENCLOSURE_GUIDE } from '../data/bestiary.js';
let root,list,detail,search,filter,status,previous,next,opened=false,selected=null,hooks={},returnFocus,isolated=[],results=[];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function button(text,action){const n=el('button','bestiary-button',text);n.type='button';n.addEventListener('click',action);return n;}
function sprite(entry){
 const box=el('div','bestiary-art');box.setAttribute('role','img');box.setAttribute('aria-label',entry.name);
 const role=entry.kind==='elite'&&entry.tint==='normal'?null:atlases[`enemyRole_${entry.enemyId}`],atlas=role||atlases[entry.sheet];
 if(atlas){const canvas=el('canvas','bestiary-sprite'),ctx=canvas.getContext?.('2d'),f=atlas.anims?.walk?.[0];if(ctx&&f){canvas.width=240;canvas.height=180;const scale=Math.min(220/f.sw,160/f.sh);atlas.draw(ctx,'walk',0,120+(f.ox-f.sw/2)*scale,170,scale,false,role&&entry.kind!=='elite'?'normal':entry.tint);box.append(canvas);return box;}}
 const fallback=()=>{box.replaceChildren();if(!entry.sprite){box.append(el('span','','이미지 준비 중'));return;}const m=entry.sprite,f=m.anims.walk[0],scale=1.25;
  const frame=el('span','bestiary-sprite');Object.assign(frame.style,{display:'block',width:`${f.sw*scale}px`,height:`${f.sh*scale}px`,backgroundImage:`url("${m.image}")`,backgroundSize:`${m.w*scale}px ${m.h*scale}px`,backgroundPosition:`-${f.sx*scale}px -${f.sy*scale}px`});box.append(frame);};
 if(entry.image){const img=el('img');img.src=entry.image;img.alt=entry.name;img.loading='lazy';img.addEventListener('error',fallback,{once:true});box.append(img);}else fallback();return box;
}
function select(id,focus=false){
 const entry=findBestiaryEntry(id);if(!entry||!results.some(e=>e.id===id))return false;selected=id;detail.replaceChildren();
 const heading=el('h3','bestiary-name',entry.name);heading.tabIndex=-1;
 const tag=el('p','bestiary-tag',`${entry.kind==='boss'?'보스':entry.kind==='elite'?'정예 변종':'일반 개체'} · ${entry.kind==='elite'?'기본 개체 ':''}STAGE ${entry.stage}부터${entry.kind==='elite'?' · 정예 출현은 이벤트 편성':''} · ${entry.role}`);
 const stats=el('p','bestiary-stats',`기본 HP ${entry.hp.toLocaleString()} · 이동 속도 ${Number(entry.speed.toFixed(2))} · 접촉 피해 ${Number(entry.damage.toFixed(2))}`);
 const section=(name,text)=>{const wrap=el('section');wrap.append(el('h4','',name),el('p','',text));return wrap;};
 detail.append(sprite(entry),heading,tag,stats,el('p','bestiary-note',entry.statNote),section('예고 신호',entry.tell),section('공격 패턴',entry.pattern),section('대응 방법',entry.counter));
 for(const text of entry.details)detail.append(el('p','bestiary-timing',text));detail.append(section('처치 보상',entry.reward));
 for(const b of list.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.entry===id?'true':'false');
 const index=results.findIndex(e=>e.id===id);previous.disabled=index<=0;next.disabled=index>=results.length-1;
 if(focus)heading.focus({preventScroll:true});detail.scrollTop=0;return true;
}
function renderResults(){
 results=searchBestiary(search.value,filter.value);list.replaceChildren();status.textContent=`${results.length}개 기록 · 처음부터 모두 열람 가능`;
 for(const entry of results){const b=button(entry.name,()=>select(entry.id,true));b.dataset.entry=entry.id;list.append(b);}
 if(!results.length){selected=null;detail.replaceChildren(el('p','','검색 결과가 없어요. 다른 이름이나 특징을 입력하세요.'));previous.disabled=next.disabled=true;return;}
 select(results.some(e=>e.id===selected)?selected:results[0].id);
}
function navigate(delta){const at=results.findIndex(e=>e.id===selected);const entry=results[at+delta];if(entry)select(entry.id,true);}
function keydown(e){
 if(!opened)return;e.stopImmediatePropagation();const key=e.key||e.code;
 if(key==='Escape'){e.preventDefault();closeBestiary();return;}
 if(key==='Tab'){const targets=[...root.querySelectorAll('button, input, select')].filter(n=>!n.disabled&&!n.hidden);const first=targets[0],last=targets.at(-1);if(e.shiftKey&&(document.activeElement===first||!targets.includes(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!targets.includes(document.activeElement))){e.preventDefault();first?.focus();}return;}
 if(document.activeElement===search||document.activeElement===filter)return;
 if(key==='ArrowLeft'||key==='ArrowRight'){e.preventDefault();navigate(key==='ArrowLeft'?-1:1);}
}
export function initBestiary(options={}){
 hooks=options;if(root)return;root=el('div','bestiary-overlay');root.id='bestiary';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','bestiary-title');
 const panel=el('section','bestiary-panel'),header=el('header','bestiary-header'),title=el('h2','','청토끼 도감');title.id='bestiary-title';const close=button('닫기',closeBestiary);close.dataset.action='close';header.append(title,close);
 const intro=el('p','bestiary-intro','전투 전에 예고 신호와 피하는 방법을 확인하세요. 기록은 시작부터 모두 열려 있어요.');
 const environment=el('p','bestiary-enclosure',ENCLOSURE_GUIDE);
 const controls=el('div','bestiary-controls');const searchLabel=el('label','','이름·특징 검색');search=el('input');search.type='search';search.placeholder='예: 돌진, 산성, 헌터';search.setAttribute('aria-label','청토끼 이름 또는 특징 검색');search.addEventListener('input',renderResults);searchLabel.append(search);
 const filterLabel=el('label','','종류');filter=el('select');filter.setAttribute('aria-label','도감 종류 필터');for(const [value,label] of [['all','전체'],['ordinary','일반'],['elite','정예'],['boss','보스']]){const o=el('option','',label);o.value=value;filter.append(o);}filter.addEventListener('change',renderResults);filterLabel.append(filter);controls.append(searchLabel,filterLabel);
 status=el('p','bestiary-count');status.setAttribute('role','status');const body=el('div','bestiary-body');list=el('nav','bestiary-list');list.setAttribute('aria-label','청토끼 기록 목록');detail=el('article','bestiary-detail');detail.setAttribute('aria-label','선택한 청토끼 특징');body.append(list,detail);
 const footer=el('footer','bestiary-footer');previous=button('이전 기록',()=>navigate(-1));next=button('다음 기록',()=>navigate(1));footer.append(previous,next);panel.append(header,intro,environment,controls,status,body,footer);root.append(panel);document.body.append(root);window.addEventListener('keydown',keydown,true);
}
export function isBestiaryOpen(){return opened;}
export function openBestiary(){if(opened)return false;if(!root)initBestiary(hooks);opened=true;returnFocus=document.activeElement;hooks.onOpen?.();isolated=[...document.body.children].filter(n=>n!==root).map(n=>[n,n.inert]);for(const [n] of isolated)n.inert=true;search.value='';filter.value='all';selected=null;root.hidden=false;renderResults();search.focus({preventScroll:true});return true;}
export function closeBestiary(){if(!opened)return false;opened=false;root.hidden=true;for(const [n,prior] of isolated)n.inert=prior;isolated=[];hooks.onClose?.();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});return true;}
