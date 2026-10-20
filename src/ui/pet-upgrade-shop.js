import { PET_UPGRADES, normalizePetUpgrades } from '../data/pet-upgrades.js';
import { save, buyPetUpgrade } from '../core/save.js';
export function renderPetUpgradeShop(list,onChange){
 const levels=normalizePetUpgrades(save),owned=save.inventory.includes('pet_yeongnyang');
 for(const track of PET_UPGRADES){
  const level=levels[track.id],revision=save.revision,card=document.createElement('div');card.className='shop-item';card.dataset.petTraining=track.id;
  const name=document.createElement('div');name.className='s-name';name.textContent=track.name;
  const detail=document.createElement('div');detail.className='s-desc';detail.textContent=`영구 훈련 ${level}/${track.max} · ${track.unit} ${track.base+level*track.step}${level<track.max?` → ${track.base+(level+1)*track.step}`:' (최대)'} · 다음 정상 행동부터 적용 · 공격/치유 주기는 유지, 즉시 회복 없음.`;
  const button=document.createElement('button');button.type='button';button.className='btn btn-small';button.disabled=!owned||level>=track.max||save.gold<track.cost[level];button.textContent=!owned?'영냥이 보유 필요':level>=track.max?'최대 훈련':`훈련 ● ${track.cost[level]}`;
  const status=document.createElement('p');status.setAttribute('role','status');
  button.onclick=()=>{const result=buyPetUpgrade(track.id,level,revision);if(result.ok)onChange();else {onChange();status.textContent=result.code==='REVISION_CONFLICT'?'다른 탭의 저장을 확인했어요. 가격을 확인하고 다시 눌러주세요.':'훈련을 저장하지 못했어요. 골드는 차감되지 않았습니다.';list.appendChild(status);}};
  card.append(name,detail,button,status);list.appendChild(card);
 }
}
