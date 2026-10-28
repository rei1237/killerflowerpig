// 2P 영냥이 성장 키트. 연이 아틀리에(yeoni-atelier) '월정석 사냥'의 영냥이 무기·보조 능력과
// 진화 짝(pair)을 이 게임 전투에 맞게 옮겼다. 영냥이는 자기 경험치로 레벨업하며 직접 고른다.
// - 기술(skill) Lv1~5, 부적(charm) Lv1~3. 슬롯 제한 없음.
// - 조합: 기술 Lv5 + 짝 부적(Lv1 이상) → 진화 기술. 레벨업 카드와 영냥이 조합표에서 할 수 있다.
export const PARTNER_SKILL_MAX = 5;
export const PARTNER_CHARM_MAX = 3;
// 원작 진화 배율 1.35 → 1.5 (영냥이는 1P보다 약하므로 상향)
export const PARTNER_EVOLVED_POWER = 1.5;
// 기술 레벨당 피해 증가
export const PARTNER_SKILL_GROWTH = 0.18;
export const PARTNER_START = Object.freeze({ skills: Object.freeze({ bolt: 1, orbit: 1 }), charms: Object.freeze({}) });

export const PARTNER_SKILL_KIT = Object.freeze({
    bolt: { name: '사주 성광', icon: '✦', desc: '가까운 적을 부채꼴로 베는 주력 참격 · 치명타 25%', per: '피해 +18% · 범위 +5%', pair: 'bell',
        evo: { name: '사주 월광참', icon: '🌙', desc: '반경 +30% · 넓은 216° 참격 · 피해 ×1.5' } },
    orbit: { name: '별자리 궤도', icon: '✧', desc: '별이 영냥이 주위를 돌며 닿는 적을 벤다', per: '별 +1 (Lv3·4·5) · 피해 +18%', pair: 'hat',
        evo: { name: '황도 십이궁', icon: '♈', desc: '별 +3개 · 궤도 반경 +25% · 피해 ×1.5' } },
    crescent: { name: '초승달 부메랑', icon: '☾', desc: '적을 향해 날아갔다 돌아오는 부메랑', per: '부메랑 +1 (Lv3·5) · 피해 +18%', pair: 'paw',
        evo: { name: '보름달 회전', icon: '🌕', desc: '부메랑 +2 · 사거리 +30% · 피해 ×1.5' } },
    tarot: { name: '타로 낙하', icon: '🃏', desc: '무작위 적 위로 예고 후 카드가 떨어진다', per: '카드 +1 · 피해 +18%', pair: 'luck',
        evo: { name: '운명의 수레바퀴', icon: '🎡', desc: '카드 +3 · 범위 +25% · 피해 ×1.5' } },
    // 원거리: 가장 가까운 적들을 향해 휘어 날아가는 별빛 탄환 (레벨업 선택으로 얻는다)
    starshot: { name: '별빛 탄환', icon: '🌠', desc: '먼 적을 쫓아가는 원거리 유도탄 · 관통 1', per: '탄 +1 (Lv2·4) · 관통 +1 (Lv5) · 피해 +18%', pair: 'whisker',
        evo: { name: '유성우', icon: '☄️', desc: '탄 +2 · 관통 +2 · 사거리 +20% · 피해 ×1.5' } },
    aura: { name: '달빛 수호부', icon: '◎', desc: '받는 피해 감소 · 3초마다 영냥이와 곁의 연이 회복', per: '피해 감소 +2.5%p · 회복 +25%', pair: 'fish_stock',
        evo: { name: '월광 결계', icon: '🔮', desc: '회복 2배 · 피해 감소 +10%p' } },
});
export const PARTNER_SKILL_ORDER = Object.freeze(['bolt', 'orbit', 'starshot', 'crescent', 'tarot', 'aura']);
export const PARTNER_RANGED = Object.freeze(['starshot', 'crescent', 'tarot']);

// 상호 보완: 연이의 테크가 약한 쪽을 메워 주는 영냥이 기술. 레벨업에 더 자주 나오고(weight),
// 피해 +bonus 를 받는다. 이유(why)는 카드와 HUD에 그대로 보여 준다.
export const PARTNER_COMPLEMENT_BONUS = 0.15;
export const PARTNER_COMPLEMENT_WEIGHT = 2.2;
export const PARTNER_COMPLEMENT = Object.freeze({
    gunline: { skills: ['bolt', 'orbit', 'aura'], why: '연이는 전방 원거리 화력 · 영냥이는 뒤·근접을 지킨다' },
    bloom: { skills: ['starshot', 'tarot', 'bolt'], why: '연이의 일직선 광선 밖, 옆·먼 적을 영냥이가 맡는다' },
    plague: { skills: ['starshot', 'bolt', 'crescent'], why: '장판을 벗어난 적·초반 압박을 영냥이가 끊는다' },
    executioner: { skills: ['aura', 'orbit', 'tarot'], why: '방어가 없는 연이를 영냥이가 지키고 무리를 흩는다' },
    butcher: { skills: ['starshot', 'tarot', 'crescent'], why: '근접 연이 대신 영냥이가 먼 적·원거리 적을 잡는다' },
});
export const complementFor = tech => PARTNER_COMPLEMENT[tech] || null;

export const PARTNER_CHARMS = Object.freeze({
    paw: { name: '고양이 발걸음', icon: '🐾', desc: '이동 속도 +8%', per: 0.08 },
    hat: { name: '마법모자', icon: '🎩', desc: '공격 범위 +10%', per: 0.10 },
    bell: { name: '별 방울', icon: '🔔', desc: '재사용 대기 -7%', per: 0.07 },
    fish_stock: { name: '생선 비축', icon: '🐟', desc: '최대 HP +20', per: 20 },
    whisker: { name: '자석 수염', icon: '🧲', desc: '경험치 흡수 반경 +30%', per: 0.30 },
    luck: { name: '행운', icon: '🍀', desc: '치명타 확률 +6%', per: 0.06 },
});
export const PARTNER_CHARM_ORDER = Object.freeze(['bell', 'hat', 'paw', 'luck', 'fish_stock', 'whisker']);

// 경험치: 영냥이가 주운 젬은 100% 영냥이에게, 연이에게 SHARE 만큼 나눠 준다 (반대도 같다).
export const PARTNER_XP = Object.freeze({ share: 0.4, magnet: 64 });
// 1P 곡선보다 완만한 2P 곡선 (난이도 배율의 70%)
export function partnerXpBase(lv) {
    return 10 + (lv - 1) * 10 + Math.max(0, lv - 5) * 12 + Math.max(0, lv - 12) * 30 + Math.max(0, lv - 20) * 60;
}
