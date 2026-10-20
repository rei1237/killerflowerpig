// Pure, manually advanced typewriter. The UI supplies its monotonic clock and
// retains ownership of timers, combat pause, dismissal and callbacks.
export const STORY_PACING = Object.freeze({characterMs:65,commaMs:180,sentenceMs:420,newlineMs:650,tapGuardMs:600,maxCatchUp:3});
export function storyCharacterDelay(character) {
    if (character === '\n') return STORY_PACING.newlineMs;
    if (/[.!?。！？…]/u.test(character)) return STORY_PACING.sentenceMs;
    if (/[,;:，、；：]/u.test(character)) return STORY_PACING.commaMs;
    return STORY_PACING.characterMs;
}
export function createStoryPacer(text, startedAt=0) {
    text=String(text ?? '');
    const chars=typeof Intl.Segmenter==='function' ? [...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)].map(x=>x.segment) : Array.from(text);
    const start=Number.isFinite(startedAt)?startedAt:0;
    let count=0,done=chars.length===0,closed=false,nextAt=start,lastTime=start,guardUntil=start;
    const snapshot=()=>({text:chars.slice(0,count).join(''),done,closed,count,total:chars.length});
    function clock(now){if(Number.isFinite(now))lastTime=Math.max(lastTime,now);return lastTime;}
    function complete(now){count=chars.length;done=true;guardUntil=now+STORY_PACING.tapGuardMs;}
    return {
        snapshot,
        rebase(now) {
            const previous = lastTime;
            const delta = clock(now) - previous;
            nextAt += delta;
            guardUntil += delta;
        },
        tick(now){
            now=clock(now);if(closed||done)return snapshot();
            let emitted=0;
            while(now>=nextAt && count<chars.length && emitted<STORY_PACING.maxCatchUp){nextAt+=storyCharacterDelay(chars[count++]);emitted++;}
            // Background-tab delays do not silently skip the entire story.
            if(emitted===STORY_PACING.maxCatchUp && nextAt<=now)nextAt=now+storyCharacterDelay(chars[count-1]);
            if(count===chars.length)complete(now);
            return snapshot();
        },
        tap(now){
            now=clock(now);if(closed||now<guardUntil)return 'ignore';
            if(!done){complete(now);return 'reveal';}
            closed=true;return 'advance';
        },
        skip(){if(closed)return 'ignore';closed=true;return 'advance';},
        cancel(){closed=true;},
    };
}
