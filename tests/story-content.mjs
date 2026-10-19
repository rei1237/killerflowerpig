import test from 'node:test';
import assert from 'node:assert/strict';
import {STORIES,EPILOGUE} from '../src/data/story.js';
const scenes={1:['스쿨버스','연꽃','스카프'],2:['네온','편의점','물웅덩이'],3:['호텔','안개','장갑차'],4:['달','지도','손전등'],5:['상업 지구','분수','무전'],6:['강','다리','밧줄'],7:['방송국','로비','계단'],8:['25층','실험실','배양통','기록'],9:['47층','스튜디오','카메라','왕좌'],10:['50층','보랏빛','모래시계','장부']};
test('all ten concise chapters match the inspected illustration settings and visible props',()=>{
 assert.deepEqual(Object.keys(STORIES),Object.keys(scenes));
 for(const [n,cues] of Object.entries(scenes)){const story=STORIES[n];assert.ok(story.length>=150 && story.length<=500,`${n}: readable chapter length`);for(const cue of cues)assert.ok(story.includes(cue),`${n}: ${cue}`);assert.ok(story.includes('연이'));assert.ok(story.includes('\n\n'));}
});
test('early chapter has no gun-wielding enemy encounter or projectile claim before unlock',()=>{
 assert.doesNotMatch(STORIES[2],/총알|총성|탄창|소총|빗발치는 총탄|총을 쥔 변이체|총기를 다루/);
 assert.match(STORIES[2],/청토끼 무리/);assert.match(STORIES[2],/산탄총|총을 고쳐/);
});
test('final two scenes keep studio guardian then hourglass lord, and ending allows recovery',()=>{
 assert.doesNotMatch(STORIES[9],/수석 연구원|한 남자|흰색 연구 가운|창조주/);
 assert.match(STORIES[9],/최상층/);assert.match(STORIES[10],/분홍 모래시계/);
 assert.match(EPILOGUE,/방송/);assert.match(EPILOGUE,/모든 위험이 사라진 것은 아니었다/);
 assert.doesNotMatch(EPILOGUE,/융합된 괴물의 잔해|수만 개의 신경삭/);
});
