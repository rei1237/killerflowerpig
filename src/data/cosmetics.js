// 외형 전용 수집품. 기존 능력치 장신구와 소유권·장착 슬롯을 공유하지 않는다.
export const COSMETIC_SLOTS = Object.freeze(['outfit', 'ornament']);
export const COSMETICS = Object.freeze([
    {
        id: 'dusk_lotus_cape', slot: 'outfit', name: '황혼 연꽃 망토',
        unlockStage: 1, price: 360, label: '의상',
        desc: '저녁빛을 머금은 연꽃 망토. 걸음마다 고운 자락이 피어납니다.',
        art: 'asset/cosmetics/dusk_lotus_cape-icon.png',
        bodySprites: { normal: 'asset/sprites/player-cape-fire.png', lotus: 'asset/sprites/player-cape-lotus-fire.png' },
    },
    {
        id: 'jade_lotus_guard', slot: 'outfit', name: '비취 연꽃 예복',
        unlockStage: 2, price: 780, label: '의상',
        desc: '비취빛 연잎과 금빛 매듭으로 단장한 예복. 작은 영웅의 품격을 더합니다.',
        art: 'asset/cosmetics/jade_lotus_guard-icon.png',
        bodySprites: { normal: 'asset/sprites/player-jade-fire.png', lotus: 'asset/sprites/player-jade-lotus-fire.png' },
    },
    {
        id: 'dawn_petal_halo', slot: 'ornament', name: '새벽 꽃잎 광환',
        unlockStage: 3, price: 1200, label: '장식',
        desc: '머리 위에 새벽빛 꽃잎이 둥글게 피어납니다. 의상과 함께 장착할 수 있습니다.',
        art: 'asset/cosmetics/dawn_petal_halo-icon.png',
        layerSprite: 'asset/sprites/player-halo-layer.png',
    },
].map(item => Object.freeze(item)));
