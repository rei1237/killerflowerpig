import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryPacer,storyCharacterDelay,STORY_PACING} from '../src/ui/story-pacing.js';
test('slow default emits one character per65ms and pauses at punctuation/newlines',()=>{
 const p=createStoryPacer('가,나.\n다');assert.equal(p.tick(0).text,'가');assert.equal(p.tick(64).text,'가');assert.equal(p.tick(65).text,'가,');assert.equal(p.tick(244).text,'가,');assert.equal(p.tick(245).text,'가,나');assert.equal(p.tick(310).text,'가,나.');assert.equal(p.tick(729).text,'가,나.');assert.equal(p.tick(730).text,'가,나.\n');assert.equal(p.tick(1379).done,false);assert.equal(p.tick(1380).done,true);
 assert.equal(storyCharacterDelay('!'),420);assert.equal(storyCharacterDelay('…'),420);
});
test('first tap reveals only; rapid second tap cannot advance; next deliberate tap advances once',()=>{
 const p=createStoryPacer('오래 읽을 이야기입니다.',0);assert.equal(p.tap(0),'reveal');assert.equal(p.snapshot().done,true);assert.equal(p.snapshot().closed,false);
 assert.equal(p.tap(10),'ignore');assert.equal(p.tap(599),'ignore');assert.equal(p.tap(600),'advance');assert.equal(p.tap(2000),'ignore');
});
test('natural completion never auto-advances and has a short reading guard',()=>{
 const p=createStoryPacer('끝');assert.equal(p.tick(0).done,true);assert.equal(p.tick(20000).closed,false);assert.equal(p.tap(20000),'advance');
 const short=createStoryPacer('끝');short.tick(0);assert.equal(short.tap(10),'ignore');assert.equal(short.tap(600),'advance');
});
test('background catchup is bounded and graphemes remain whole',()=>{
 const p=createStoryPacer('가나다라마바사아자차카타파하');assert.equal(p.tick(99999).count,STORY_PACING.maxCatchUp);assert.equal(p.tick(99999).count,3);
 const emoji=createStoryPacer('🌸👩‍🚀연이');assert.equal(emoji.tick(0).text,'🌸');assert.equal(emoji.tick(65).text,'🌸👩‍🚀');
});
test('skip/cancel are idempotent and previous chapter cannot progress after cancellation',()=>{
 const p=createStoryPacer('이전 장면');p.cancel();assert.equal(p.tick(2000).closed,true);assert.equal(p.tap(2000),'ignore');assert.equal(p.skip(),'ignore');
 const next=createStoryPacer('다음 장면',3000);assert.equal(next.skip(),'advance');assert.equal(next.skip(),'ignore');assert.equal(next.tap(9000),'ignore');
});

test('new chapter first tap reveals immediately even before its first rendering tick',()=>{
 const p=createStoryPacer('새 장면 전체 문장',12345);assert.equal(p.tap(12345),'reveal');assert.equal(p.snapshot().text,'새 장면 전체 문장');assert.equal(p.tap(12346),'ignore');assert.equal(p.tap(12945),'advance');
});
