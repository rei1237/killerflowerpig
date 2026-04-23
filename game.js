/**
 * ============================================================================
 * [Game Engine Core - Final Master]
 * AI Assistant 가이드: 이 파일은 HTML5 Canvas 기반 횡스크롤 게임의 코어 로직입니다.
 * - ASSETS 객체에 이미지 경로를 추가하면 도형이 자동으로 이미지/스프라이트로 교체됩니다.
 * - Player, Enemy, Gate, Projectile 등 모든 객체는 독립적인 클래스/리터럴로 관리됩니다.
 * ============================================================================
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');
const installButton = document.getElementById('install-btn');
const startButton = document.getElementById('start-btn');
const mainMenuButtons = document.getElementById('main-menu-buttons');
const MOBILE_OPTIMIZED_CLASS = 'mobile-optimized';
let deferredInstallPrompt = null;

// --- 1. 에셋 및 전역 상태 설정 ---

const ASSETS = {
    player: 'asset/꽃돼지 총.png',
    bullet: '',
    enemy: 'asset/청토끼.png',
    boss: 'asset/청토끼 보스.png',
    win: 'asset/꽃돼지 승리.png',
    gameover: 'asset/게임오버.png',
    title: 'asset/꽃돼지 the killer of zombie.png',
    bgm: 'asset/freepik-silent-ops.mp3',
    bg1: 'asset/bg_stage1_1776859252407.png',
    bg3: 'asset/bg_stage3_1776859290142.png',
    bg5: 'asset/bg_stage5_1776859700265.png',
    bg7: 'asset/bg_stage7_1776859783868.png',
    bg9: 'asset/bg_stage9_1776859795988.png',
    gate: ''
};

const GAME_STATE = { START: 'START', PLAYING: 'PLAYING', STAGE_CLEAR: 'STAGE_CLEAR', BOSS_FIGHT: 'BOSS_FIGHT', GAME_OVER: 'GAME_OVER', WIN: 'WIN' };
let currentState = GAME_STATE.START;

// --- 1-1. 스테이지 및 보스 설정 ---
const STAGE_DATA = {
    1: { goal: 20, enemySpeed: 2.0, spawnRate: 2800, homing: false, sky: '#050a14', city: '#0a1220', fog: '#0f172a', storyText: "꽃돼지 연이의 분홍빛 코 끝에 닿은 공기는\n이미 부패해 있었다. 놈들이 오고 있다.\n\n청색 털을 적신 것은 피인가, 아니면 저주인가.\n연이는 총구의 차가운 감촉을 느끼며 방아쇠에 발을 올렸다." },
    2: { goal: 30, enemySpeed: 2.3, spawnRate: 2500, homing: false, enemyShoot: true, sky: '#0a0a14', city: '#161625', fog: '#1e1e2e', storyText: "폐허가 된 도시, 한때 평화로웠던 거리는\n이제 살육의 메아리만이 맴돈다.\n\n썩어가는 청토끼들의 눈빛엔 이성이 없었다.\n오직 생명을 찢어발기려는 갈망뿐." },
    3: { goal: 40, enemySpeed: 2.6, spawnRate: 2200, homing: true, homingSpeed: 0.3, enemyShoot: true, sky: '#0f0f0f', city: '#1a1a1a', fog: '#262626', storyText: "독성 안개가 숨통을 조여온다.\n시야가 흐려지지만, 연이의 총구는 흔들림이 없다.\n\n쓰러진 동료들의 복수를 위해\n이 지옥을 벗어나야만 한다." },
    4: { goal: 50, enemySpeed: 2.9, spawnRate: 2000, homing: true, homingSpeed: 0.5, enemyShoot: true, sky: '#0a0d14', city: '#141a26', fog: '#1e293b', storyText: "끝없는 무리의 습격. 네온사인의 잔해 아래서\n놈들은 그림자처럼 피어났다.\n\n자비란 없다.\n방아쇠를 당기는 것만이 유일한 대화일 뿐." },
    5: { goal: 60, enemySpeed: 3.2, spawnRate: 1800, homing: true, homingSpeed: 0.7, enemyShoot: true, sky: '#14051a', city: '#1f0a28', fog: '#2d1a3a', storyText: "도시의 네온사인이 꺼져갈수록\n청토끼들의 저주받은 울음소리는 더욱 기괴해졌다.\n\n세상을 좀먹는 역병의 근원.\n연이는 결심했다. 모든 것을 끝내겠노라고." },
    6: { goal: 70, enemySpeed: 3.5, spawnRate: 1600, homing: true, homingSpeed: 0.9, enemyShoot: true, sky: '#1a0505', city: '#2a0a0a', fog: '#3a1a1a', storyText: "오염된 강줄기를 따라 지옥의 중심부로 다가선다.\n흐르는 것은 물이 아니라 썩어문드러진 절망.\n\n하지만 핏빛 꽃잎은\n진흙 속에서도 피어나는 법이다." },
    7: { goal: 80, enemySpeed: 3.8, spawnRate: 1400, homing: true, homingSpeed: 1.1, enemyShoot: true, sky: '#02040a', city: '#0a0e1a', fog: '#101a2a', storyText: "어둠이 빛을 삼키는 심연의 입구.\n숨소리조차 들리지 않는 적막 속에서\n놈들의 심장 박동만이 울려 퍼진다.\n\n두려움은 이미 버린 지 오래다." },
    8: { goal: 90, enemySpeed: 4.1, spawnRate: 1200, homing: true, homingSpeed: 1.3, enemyShoot: true, sky: '#0a0908', city: '#141210', fog: '#1a1816', storyText: "마치 살아있는 듯 꿈틀거리는 핏빛 안개.\n환영인지 현실인지 모를 악몽 속에서,\n연이는 묵묵히 탄창을 갈아 끼웠다.\n\n이곳이 무덤이 될지언정 물러서지 않는다." },
    9: { goal: 100, enemySpeed: 4.5, spawnRate: 1000, homing: true, homingSpeed: 1.5, enemyShoot: true, sky: '#02040a', city: '#000000', fog: '#0f172a', storyText: "모든 희망이 부서진 땅.\n남은 것은 거대한 절망의 잔해뿐이다.\n\n놈들의 왕이 가까워질수록 하늘은 핏빛으로 물들고,\n대지는 비명을 지른다." },
    10: { goal: 150, enemySpeed: 5.0, spawnRate: 800, homing: true, homingSpeed: 2.0, enemyShoot: true, sky: '#000000', city: '#000000', fog: '#450a0a', storyText: "심연의 끝에서 마침내 마주한 진실.\n거대한 그림자가 세상을 덮치려 할 때,\n\n꽃돼지 연이의 눈동자에선\n마지막 희망의 불꽃이 타올랐다." }
};

let currentStage = 1;
let enemiesKilled = 0;
let boss = null;
let score = 0;

let projectiles = [];
let enemies = [];
let particles = [];
let gates = [];
let spawnTimer = 0;
let gateSpawnTimer = 0;
let storyTypingIndex = 0;
let storyDisplayTime = 0;
let gameOverStartTime = 0;
let floatingTexts = []; // "BONUS!" 효과 등을 위한 플로팅 텍스트
const SPAWN_INTERVAL = 2000;
const GATE_SPAWN_INTERVAL = 6000;
const EASY_MODE_CONFIG = {
    // 적 관련 - 더 느리고 덜 위협적
    enemySpeedMultiplier: 0.3,        // 45% → 30% (훨씬 느린 적)
    spawnRateMultiplier: 3.0,       // 2배 → 3배 덜 자주 등장
    goalMultiplier: 0.6,              // 2배 → 0.6배 (더 적은 적 처치 필요)
    homingSpeedMultiplier: 0.3,       // 50% → 30% (홈링 더 느림)
    enemyHpMultiplierA: 0.5,          // 66% → 50% (적 체력 감소)
    enemyHpMultiplierB: 0.4,        // 60% → 40% (적 체력 더 감소)
    enemyShootIntervalMultiplier: 3.0, // 2배 → 3배 덜 자주 발사
    maxActiveEnemies: 4,              // 6 → 4 (동시 적 수 감소)

    // 플레이어 관련 - 더 강하고 안전함
    playerHpMultiplier: 3.0,          // 2배 → 3배 더 많은 HP
    playerDamageMultiplier: 2.0,      // 1.5배 → 2배 더 강한 공격
    playerInvincibleMultiplier: 3.0,  // 2배 → 3배 더 긴 무적시간
    playerSpeedMultiplier: 1.2,       // 20% 더 빠른 이동
    fireRateMultiplier: 0.7,          // 30% 더 빠른 발사

    // 보스 관련 - 훨씬 쉬운 보스
    bossMoveScaleMultiplier: 0.3,     // 50% → 30% (보스 이동 느림)
    bossAttackIntervalMultiplier: 3.0, // 2배 → 3배 덜 자주 공격
    bossSummonEnemySpeedMultiplier: 0.3, // 50% → 30% (소환된 적 더 느림)
    bossSummonEnemyHpMultiplier: 0.4, // 60% → 40% (소환된 적 체력 감소)
    bossProjectileSpeedMultiplier: 0.6, // 보스 발체 속도 60% 감소

    // 게임 템포
    gameSpeedMultiplier: 0.75           // 전체 게임 속도 75% (25% 느림)
};

function isMobileTouchDevice() {
    const ua = navigator.userAgent || '';
    const byUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
    const byPointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return byUA || byPointer;
}

function applyMobileOptimizations() {
    const isMobile = isMobileTouchDevice();
    gameContainer.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
    canvas.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
    if (installButton) installButton.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
}

function isMobileLandscapePlayMode() {
    // 세로 모드일 때는 이지 모드 활성화 (더 쉬운 게임)
    return isMobileTouchDevice() && window.innerWidth < window.innerHeight;
}

function isMobileLandscapeOrientation() {
    // 진짜 가로 모드 (width > height)
    return isMobileTouchDevice() && window.innerWidth > window.innerHeight;
}

// 모바일에서 게임 속도 배율 반환
function getMobileGameSpeedMultiplier() {
    return isMobileEasyModeActive() ? EASY_MODE_CONFIG.gameSpeedMultiplier : 1.0;
}

function isMobileEasyModeActive() { // EASY MODE
    return isMobileLandscapePlayMode();
}

function getCurrentStageData() { // EASY MODE
    const baseStage = STAGE_DATA[currentStage] || STAGE_DATA[1];
    if (!isMobileEasyModeActive()) return baseStage;
    return {
        ...baseStage,
        goal: Math.ceil(baseStage.goal * EASY_MODE_CONFIG.goalMultiplier),
        enemySpeed: baseStage.enemySpeed * EASY_MODE_CONFIG.enemySpeedMultiplier,
        spawnRate: baseStage.spawnRate * EASY_MODE_CONFIG.spawnRateMultiplier,
        homingSpeed: baseStage.homingSpeed ? baseStage.homingSpeed * EASY_MODE_CONFIG.homingSpeedMultiplier : baseStage.homingSpeed,
        enemyShoot: false // EASY MODE
    };
}

function getPlayerInvincibleDuration() { // EASY MODE
    return isMobileEasyModeActive() ? 1000 * EASY_MODE_CONFIG.playerInvincibleMultiplier : 1000;
}

function getViewportSize() {
    // 모바일에서는 visualViewport가 있으면 사용, 아니면 innerWidth/Height 사용
    const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return {
        width: Math.floor(width),
        height: Math.floor(height)
    };
}

function enterMobileFullscreen() {
    if (!isMobileTouchDevice()) return;
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;

    // 가로 모드일 때만 전체화면 요청 (사용자 경험 개선)
    if (isMobileLandscapeOrientation()) {
        root.requestFullscreen().catch(() => { });
    }
}

function updateInstallButtonVisibility() { // MOBILE LANDSCAPE
    if (!installButton) return;
    // START 상태에서만 버튼 표시, 게임 중에는 무조건 숨김
    if (currentState !== GAME_STATE.START) {
        installButton.hidden = true;
        return;
    }
    // PWA 설치 가능하거나 이미 설치된 경우에 표시 (가이드용)
    const shouldShow = deferredInstallPrompt || !isPWAInstalled();
    installButton.hidden = !shouldShow;
}

// PWA가 이미 설치되었는지 확인
function isPWAInstalled() {
    // display-mode가 standalone이나 fullscreen이면 설치된 것
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    // iOS의 경우 navigator.standalone으로 확인
    if (navigator.standalone === true) {
        return true;
    }
    return false;
}

// 설치 가이드 모달 표시
function showInstallGuide() {
    const modal = document.getElementById('install-guide');
    const mobileGuide = document.getElementById('install-mobile-guide');
    const desktopGuide = document.getElementById('install-desktop-guide');
    const installedMsg = document.getElementById('install-installed-msg');

    if (!modal) return;

    // 이미 설치된 경우
    if (isPWAInstalled()) {
        mobileGuide.hidden = true;
        desktopGuide.hidden = true;
        installedMsg.hidden = false;
    }
    // 모바일/태블릿
    else if (isMobileTouchDevice()) {
        mobileGuide.hidden = false;
        desktopGuide.hidden = true;
        installedMsg.hidden = true;
    }
    // 데스크톱
    else {
        mobileGuide.hidden = true;
        desktopGuide.hidden = false;
        installedMsg.hidden = true;
    }

    modal.hidden = false;
}

function hideInstallGuide() {
    const modal = document.getElementById('install-guide');
    if (modal) modal.hidden = true;
}

// 실제 PWA 설치 시도
async function installPWA() {
    // 이미 설치된 경우 가이드만 표시
    if (isPWAInstalled()) {
        showInstallGuide();
        return;
    }

    // 설치 프롬프트가 있는 경우 (Chrome/Android)
    if (deferredInstallPrompt) {
        try {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('PWA installed successfully');
                deferredInstallPrompt = null;
            }
        } catch (error) {
            console.error('Install failed:', error);
            showInstallGuide();
        }
    }
    // iOS Safari나 설치 프롬프트가 없는 경우 가이드 표시
    else {
        showInstallGuide();
    }
}

function updateMainMenuVisibility() {
    if (!mainMenuButtons) return;
    const shouldShow = currentState === GAME_STATE.START;
    mainMenuButtons.hidden = !shouldShow;
}

// 게임 시작 함수
function startGame() {
    if (currentState !== GAME_STATE.START) return;
    enterMobileFullscreen();
    AudioManager.init();
    AudioManager.startBGM();
    currentState = GAME_STATE.PLAYING;
    storyTypingIndex = 0;
    storyDisplayTime = Date.now();
    updateMainMenuVisibility();
}

if (installButton) {
    installButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        await installPWA();
    });
}

// 설치 가이드 닫기 버튼
const closeInstallGuideBtn = document.getElementById('close-install-guide');
if (closeInstallGuideBtn) {
    closeInstallGuideBtn.addEventListener('click', hideInstallGuide);
}

// 게임 시작 버튼 이벤트
if (startButton) {
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
    });
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility();
    // PWA 설치 가능할 때 INSTALL 버튼 표시
    if (installButton) installButton.hidden = false;
    // 설치 완료 알림
    addFloatingText('📲 Ready to Install!', canvas.width / 2, canvas.height / 2 - 100, '#2ecc71');
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    // 설치 완료 축하 메시지
    addFloatingText('✅ Game Installed!', canvas.width / 2, canvas.height / 2 - 100, '#2ecc71');
});

// 이미 설치된 상태 확인 및 버튼 업데이트
if (isPWAInstalled()) {
    console.log('PWA is already installed');
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => { });
    });
}

const AudioManager = {
    bgm: null,
    ctx: null,
    initialized: false,
    init: function () {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgm = new Audio(ASSETS.bgm);
        this.bgm.loop = true;
        this.bgm.volume = 0.5;
        this.initialized = true;
    },
    startBGM: function () {
        if (this.bgm) this.bgm.play().catch(e => console.log("Audio play blocked"));
    },
    playSFX: function (type) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const now = this.ctx.currentTime;
        if (type === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(); osc.stop(now + 0.1);
        } else if (type === 'explode') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(); osc.stop(now + 0.3);
        } else if (type === 'hit') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(); osc.stop(now + 0.1);
        } else if (type === 'heal') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(); osc.stop(now + 0.15);
        } else if (type === 'powerup') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(); osc.stop(now + 0.2);
        } else if (type === 'shield') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(); osc.stop(now + 0.3);
        } else if (type === 'bomb') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(); osc.stop(now + 0.4);
        }
    }
};

const ImageLoader = {
    images: {},
    loadImage: function (key, src) {
        if (!src) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.images[key] = img; resolve(img); };
            img.onerror = () => { resolve(null); };
            img.src = src;
        });
    },
    loadAllAssets: async function () {
        const promises = Object.entries(ASSETS)
            .filter(([key, src]) => src && !src.endsWith('.mp3'))
            .map(([key, src]) => this.loadImage(key, src));
        await Promise.all(promises);
    },
    get: function (key) { return this.images[key]; }
};

const Player = {
    x: 50, y: 0, width: 64, height: 64,
    speed: 0.15,
    fireRate: 200,
    minFireRate: 50,
    lastFireTime: 0,
    damage: 10,
    targetY: 0,
    init: function () {
        this.y = canvas.height / 2 - this.height / 2;
        this.targetY = this.y;
        this.fireRate = 200;
        this.damage = isMobileEasyModeActive() ? Math.round(10 * EASY_MODE_CONFIG.playerDamageMultiplier) : 10; // EASY MODE
        this.hp = isMobileEasyModeActive() ? Math.round(5 * EASY_MODE_CONFIG.playerHpMultiplier) : 5; // EASY MODE
        this.maxHp = this.hp; // EASY MODE
        this.shield = 0;
        this.bombCount = 3;
        this.aniFrame = 0;
        this.state = 'ALIVE';
        this.lastFrameTime = 0;
        this.supportTimer = 0; // 지원군 지속 시간
        this.skillNotifications = []; // 활성 스킬 알림
    },
    update: function (currentTime) {
        if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.BOSS_FIGHT) return;
        const time = currentTime || 0;

        if (this.state === 'DEAD') {
            if (time - this.lastFrameTime > 150) {
                this.aniFrame++;
                this.lastFrameTime = time;
                if (this.aniFrame >= 4) {
                    this.aniFrame = 3;
                    endGame();
                }
            }
            this.y += 2;
            return;
        }

        if (this.shield > 0) this.shield -= 16;
        if (this.supportTimer > 0) this.supportTimer -= 16;

        // 스킬 알림 수명 관리
        this.skillNotifications = this.skillNotifications.filter(n => {
            n.timeLeft -= 16;
            return n.timeLeft > 0;
        });

        // 모바일에서 더 빠른 이동 속도 적용
        const moveSpeed = isMobileEasyModeActive() ? this.speed * EASY_MODE_CONFIG.playerSpeedMultiplier : this.speed;
        let dy = this.targetY - this.y;
        this.y += dy * moveSpeed;
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > canvas.height) this.y = canvas.height - this.height;
        const totalAniFrames = 8;
        // 모바일에서 더 빠른 발사 속도 적용
        const fireRateMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.fireRateMultiplier : 1.0;
        const fire = Math.max(this.fireRate * fireRateMultiplier, 10);
        const aniCycleTime = fire * 1.5;
        const frameDuration = aniCycleTime / totalAniFrames;

        this.aniFrame = Math.floor((time % aniCycleTime) / (frameDuration || 1)) % totalAniFrames;
        if (time - this.lastFireTime >= fire) {
            this.shoot();
            this.lastFireTime = time;
        }
    },
    shoot: function () {
        // 총알 생성 및 공격력에 따라 크기/속도 조정
        const baseDamage = 10; // 기본 데미지 기준값
        const baseSpeed = 10; // 기본 총알 속도
        const damageRatio = this.damage / baseDamage;
        const bulletWidth = Math.max(12, Math.round(16 * damageRatio)); // 최소 12px, 더 크게 증가
        const bulletHeight = Math.max(8, Math.round(12 * damageRatio)); // 더 크게 증가
        // 속도는 공격력업당 15%씩만 증가 (예: 데미지 50이면 기본속도 + 60%)
        const speedMultiplier = 1 + ((this.damage - baseDamage) / 10) * 0.15;
        const bulletSpeed = baseSpeed * speedMultiplier;
        const projectile = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65, bulletSpeed, 0, this.damage);
        // 크기 조정 반영
        projectile.width = bulletWidth;
        projectile.height = bulletHeight;
        projectiles.push(projectile);

        // 지원군 사격 (위, 아래 추가 지원)
        if (this.supportTimer > 0) {
            const projTop = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65 - 80, bulletSpeed, 0, this.damage);
            projTop.width = bulletWidth;
            projTop.height = bulletHeight;
            const projBottom = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65 + 80, bulletSpeed, 0, this.damage);
            projBottom.width = bulletWidth;
            projBottom.height = bulletHeight;
            projectiles.push(projTop);
            projectiles.push(projBottom);
        }

        AudioManager.playSFX('shoot');
    },
    draw: function (ctx) {
        const img = ImageLoader.get('player');
        if (img) {
            const cols = 4;
            const rows = 2;
            const frameW = img.width / cols;
            const frameH = img.height / rows;
            let rowIdx = 0;
            let colIdx = 0;

            if (this.state === 'DEAD') {
                rowIdx = 1; // 사망 모션
                colIdx = Math.min(this.aniFrame, cols - 1);
            } else {
                rowIdx = Math.floor(this.aniFrame / cols) % rows;
                colIdx = this.aniFrame % cols;
            }

            const sx = colIdx * frameW + 22;
            const sy = rowIdx * frameH;
            const cropWidth = frameW - 30;

            if (this.shield > 0) {
                ctx.save();
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#9b59b6';
                ctx.drawImage(img, sx, sy, cropWidth, frameH, this.x, this.y, this.width, this.height);
                ctx.restore();
            } else {
                ctx.drawImage(img, sx, sy, cropWidth, frameH, this.x, this.y, this.width, this.height);
            }

            // 지원군 렌더링 (잔상 효과 느낌으로 배치)
            if (this.supportTimer > 0) {
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.drawImage(img, sx, sy, cropWidth, frameH, this.x - 20, this.y - 80, this.width, this.height);
                ctx.drawImage(img, sx, sy, cropWidth, frameH, this.x - 20, this.y + 80, this.width, this.height);
                ctx.restore();
            }
        }
    }
};

class Projectile {
    constructor(x, y, vx, vy, damage) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.damage = damage;
        this.width = 20; this.height = 10;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x > canvas.width || this.x < -100 || this.y < -100 || this.y > canvas.height + 100) this.active = false;
    }
    draw(ctx) {
        if (this.isBossEnergyBall) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const time = Date.now() / 200;
            ctx.save();
            ctx.shadowBlur = 40; ctx.shadowColor = '#e74c3c';
            ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 5;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i * 45 + time * 60) * Math.PI / 180;
                const r = 22 + Math.sin(time + i) * 6;
                const px = centerX + Math.cos(angle) * r;
                const py = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.beginPath(); ctx.arc(centerX, centerY, 20 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 30; ctx.shadowColor = '#fff';
            ctx.fillStyle = '#ff4757';
            ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.isEnemyBullet) {
            const time = Date.now();
            ctx.save();
            // 더 크고 밝은 플라즈마 덩어리 느낌
            ctx.shadowBlur = 25; ctx.shadowColor = '#ff0000';

            // 본체 그라데이션
            const grad = ctx.createRadialGradient(this.x + 10, this.y, 0, this.x + 10, this.y, 15);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.3, '#ff4757');
            grad.addColorStop(1, 'transparent');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(this.x + 10, this.y, 15 + Math.sin(time / 100) * 2, 8 + Math.cos(time / 100) * 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // 뒤쪽 꼬리 잔상 (도트 스타일)
            ctx.fillStyle = 'rgba(255, 71, 87, 0.5)';
            ctx.fillRect(this.x + 15, this.y - 4, 10, 8);
            ctx.fillRect(this.x + 22, this.y - 2, 6, 4);

            ctx.restore();
        } else {
            const centerX = this.x + this.width / 2;
            const centerY = this.y;
            // 총알 크기에 비례하여 꽃 크기 조정 (기준: 너비 20, 높이 10)
            // 더 완만한 증가: 기본 1.0, 최대 약 2.0 배
            const scaleX = 1 + (this.width - 20) / 40;
            const scaleY = 1 + (this.height - 10) / 20;
            const petalSize = 6 * scaleX;
            const petalDistance = 5 * scaleX;
            const centerRadius = 5 * scaleX;
            const innerRadius = 3 * scaleX;
            ctx.save();
            ctx.fillStyle = '#ff6b9d';
            for (let i = 0; i < 5; i++) {
                const angle = (i * 72 - 90) * Math.PI / 180;
                const px = centerX + Math.cos(angle) * petalDistance;
                const py = centerY + Math.sin(angle) * petalDistance;
                ctx.beginPath(); ctx.arc(px, py, petalSize, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#ffd93d';
            ctx.beginPath(); ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 10 * scaleX; ctx.shadowColor = '#ff6b9d';
            ctx.fillStyle = '#ff6b9d';
            ctx.beginPath(); ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 64; this.height = 64;
        // 적 체력 대폭 상향 및 난이도 증가
        const hpMultiplierA = isMobileEasyModeActive() ? EASY_MODE_CONFIG.enemyHpMultiplierA : 1; // EASY MODE
        const hpMultiplierB = isMobileEasyModeActive() ? EASY_MODE_CONFIG.enemyHpMultiplierB : 1; // EASY MODE
        this.hp = Math.round((60 * hpMultiplierA) + (currentStage * 50 * hpMultiplierB)); this.maxHp = this.hp; // EASY MODE
        const gameSpeed = getMobileGameSpeedMultiplier();
        this.speed = isMobileEasyModeActive() ? 3 * EASY_MODE_CONFIG.enemySpeedMultiplier * gameSpeed : 3; this.active = true; // EASY MODE
        this.state = 'WALK';
        this.aniFrame = 0; this.lastFrameTime = 0; this.frameRate = 120; this.totalFrames = 6;
        const enemyShootIntervalMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.enemyShootIntervalMultiplier : 1; // EASY MODE
        this.lastShootTime = 0; this.shootInterval = (2000 + Math.random() * 2000) * enemyShootIntervalMultiplier; // EASY MODE
    }
    update(timestamp) {
        if (!this.active) return;
        const stage = getCurrentStageData(); // EASY MODE
        if (this.state === 'WALK') {
            this.x -= this.speed;
            if (stage.homing && Player.hp > 0) {
                const dy = Player.y + Player.height / 2 - (this.y + this.height / 2);
                this.y += Math.sign(dy) * (stage.homingSpeed || 0.5);
            }
            if (this.x + this.width < 0) {
                this.active = false;
                // 놓친 적은 무적 상태와 관계없이 1마리당 HP 1 감소
                if (this.state !== 'DEAD') {
                    Player.hp--; AudioManager.playSFX('hit');
                    if (Player.hp <= 0) endGame();
                }
            }
            if (stage.enemyShoot && timestamp - this.lastShootTime > this.shootInterval && this.x < canvas.width - 100) {
                this.state = 'ATTACK'; this.aniFrame = 0; this.lastFrameTime = timestamp; this.lastShootTime = timestamp;

                // 플레이어 방향으로 탄환 발사 (조준 사격)
                const targetX = Player.x + Player.width / 2;
                const targetY = Player.y + Player.height / 2;
                const dx = targetX - this.x;
                const dy = targetY - (this.y + this.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                const speed = 7; // 탄환 속도

                // 적 발체 속도 - 모바일에서 더 느리게
                const enemyProjSpeedMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.gameSpeedMultiplier : 1.0;
                const vx = (dx / dist) * speed * enemyProjSpeedMultiplier;
                const vy = (dy / dist) * speed * enemyProjSpeedMultiplier;

                const bullet = new Projectile(this.x, this.y + this.height / 2, vx, vy, 0);
                bullet.isEnemyBullet = true; bullet.width = 16; bullet.height = 16;
                projectiles.push(bullet);
            }
            if (checkCollision(this, Player) && Player.shield <= 0) {
                this.state = 'ATTACK'; this.aniFrame = 0; this.lastFrameTime = timestamp;
                Player.hp--; Player.shield = getPlayerInvincibleDuration(); AudioManager.playSFX('hit'); // EASY MODE
                if (Player.hp <= 0) endGame();
            }
        }
        if (timestamp - this.lastFrameTime > this.frameRate) {
            this.aniFrame++; this.lastFrameTime = timestamp;
            if (this.aniFrame >= this.totalFrames) {
                if (this.state === 'DEAD') this.active = false;
                else if (this.state === 'ATTACK') this.state = 'WALK';
                this.aniFrame = 0;
            }
        }
    }
    draw(ctx) {
        const img = ImageLoader.get('enemy');
        if (img) {
            const cols = 7; const rows = 3; const frameW = img.width / cols; const frameH = img.height / rows;
            let rowIdx = this.state === 'ATTACK' ? 1 : (this.state === 'DEAD' ? 2 : 0);
            const frameIdx = Math.min(this.aniFrame, 5);
            const sx = (frameIdx + 1) * frameW; const sy = rowIdx * frameH;
            const margin = 8;
            ctx.save(); ctx.translate(this.x + this.width / 2, this.y + this.height / 2); ctx.scale(-1, 1);
            ctx.drawImage(img, sx + margin, sy + margin, frameW - margin * 2, frameH - margin * 2, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        }
        // 적 체력 바 (요청 사항: 상단에 표시)
        if (this.state !== 'DEAD') {
            const barW = 50; const barH = 4;
            const bx = this.x + (this.width - barW) / 2;
            const by = this.y - 15;
            const clampedHp = Math.max(0, Math.min(this.hp, this.maxHp)); // EASY MODE
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bx, by, barW, barH);
            ctx.fillStyle = '#ff4757';
            ctx.fillRect(bx, by, (clampedHp / this.maxHp) * barW, barH);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);
            
            // 정확한 체력 수치 텍스트 추가
            ctx.fillStyle = '#ffffff';
            ctx.font = '8px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.floor(clampedHp)}/${this.maxHp}`, this.x + this.width / 2, by - 5);
        }
    }
}

class GatePair {
    constructor(x) {
        this.x = x; this.width = 60; this.speed = 3.5; this.active = true;
        const halfHeight = canvas.height / 2;
        // 공격력/사격속도 비중 대폭 상향 (프롬프트 반영)
        const types = [
            { type: 'FIRE_RATE', value: 30, text: 'SPEED UP', color: '#3498db', icon: 'gun' },
            { type: 'FIRE_RATE', value: 30, text: 'SPEED UP', color: '#3498db', icon: 'gun' },
            { type: 'DAMAGE', value: 10, text: 'POWER UP', color: '#2ecc71', icon: 'sword' },
            { type: 'DAMAGE', value: 10, text: 'POWER UP', color: '#2ecc71', icon: 'sword' },
            { type: 'HEAL', value: 2, text: 'REPAIR', color: '#e74c3c', icon: 'heart' },
            { type: 'SHIELD', value: 15000, text: 'SHIELD', color: '#9b59b6', icon: 'shield' },
            { type: 'ULTIMATE', value: 1, text: 'BOMB', color: '#f1c40f', icon: 'bomb' }
        ];

        // 스테이지 5부터 지원군 스킬 게이트 등장
        if (currentStage >= 5) {
            types.push({ type: 'SUPPORT', value: 20000, text: 'SUPPORT', color: '#e67e22', icon: 'shield' });
        }

        const shuffled = [...types].sort(() => Math.random() - 0.5);
        const selected = [];
        for (const t of shuffled) {
            if (!selected.some(s => s.type === t.type)) selected.push(t);
            if (selected.length === 2) break;
        }
        this.topGate = { ...selected[0], y: 50, height: halfHeight - 60 };
        this.bottomGate = { ...selected[1], y: halfHeight + 10, height: halfHeight - 60 };
    }
    update() {
        this.x -= this.speed;
        if (this.x + this.width < 0) this.active = false;
        if (this.checkPlayerCollision(this.topGate)) { this.applyBuff(this.topGate); this.active = false; }
        else if (this.checkPlayerCollision(this.bottomGate)) { this.applyBuff(this.bottomGate); this.active = false; }
    }
    checkPlayerCollision(gatePart) {
        return Player.x < this.x + this.width && Player.x + Player.width > this.x &&
            Player.y < gatePart.y + gatePart.height && Player.y + Player.height > gatePart.y;
    }
    applyBuff(gatePart) {
        let isBonus = false;
        let bonusScore = 1000;

        if (gatePart.type === 'FIRE_RATE') {
            if (Player.fireRate <= Player.minFireRate) isBonus = true;
            else { Player.fireRate = Math.max(Player.fireRate - gatePart.value, Player.minFireRate); AudioManager.playSFX('powerup'); }
        } else if (gatePart.type === 'DAMAGE') {
            if (Player.damage >= 50) isBonus = true;
            else { Player.damage = Math.min(Player.damage + gatePart.value, 50); AudioManager.playSFX('powerup'); }
        } else if (gatePart.type === 'HEAL') {
            if (Player.hp >= Player.maxHp) { isBonus = true; bonusScore = 500; }
            else { Player.hp = Math.min(Player.hp + gatePart.value, Player.maxHp); AudioManager.playSFX('heal'); }
        } else if (gatePart.type === 'SHIELD') {
            if (Player.shield > 0) { isBonus = true; bonusScore = 1500; }
            else {
                Player.shield = gatePart.value;
                addSkillNotification("SHIELD ACTIVE", gatePart.value);
                AudioManager.playSFX('shield');
            }
        } else if (gatePart.type === 'ULTIMATE') {
            if (Player.bombCount >= 5) { isBonus = true; bonusScore = 2000; }
            else { Player.bombCount++; AudioManager.playSFX('bomb'); }
        } else if (gatePart.type === 'SUPPORT') {
            if (Player.supportTimer > 0) { isBonus = true; bonusScore = 3000; }
            else {
                Player.supportTimer = gatePart.value;
                addSkillNotification("SUPPORT CALLED", gatePart.value);
                AudioManager.playSFX('powerup');
            }
        }

        if (isBonus) {
            score += bonusScore;
            addFloatingText(`BONUS! +${bonusScore}`, this.x, gatePart.y + gatePart.height / 2, "#f1c40f");
            AudioManager.playSFX('powerup'); // 보너스 시에도 효과음
        }

        createExplosion(this.x + this.width / 2, gatePart.y + gatePart.height / 2, gatePart.color);
    }
    draw(ctx) {
        this.drawGateStructure(ctx, this.topGate);
        this.drawGateStructure(ctx, this.bottomGate);
    }
    drawGateStructure(ctx, gate) {
        const x = this.x; const y = gate.y; const w = this.width; const h = gate.height;

        // 격리 구역 바리케이드 금속 기둥
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#333'; ctx.fillRect(x + 5, y, w - 10, h);

        // 해저드 테이프 띠 (위/아래)
        ctx.save();
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(x, y, w, 15); ctx.fillRect(x, y + h - 15, w, 15);
        ctx.fillStyle = '#000';
        for (let i = 0; i < w; i += 10) {
            ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + 5, y); ctx.lineTo(x + i - 2, y + 15); ctx.lineTo(x + i - 7, y + 15); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x + i, y + h - 15); ctx.lineTo(x + i + 5, y + h - 15); ctx.lineTo(x + i - 2, y + h); ctx.lineTo(x + i - 7, y + h); ctx.fill();
        }
        ctx.restore();

        // 픽셀 코어 라이트 (버프 색상 - 방사능 물질 느낌)
        ctx.fillStyle = gate.color; ctx.globalAlpha = 0.6; ctx.fillRect(x + 10, y + 20, w - 20, h - 40); ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 2, y + 20, 4, h - 40); // 중앙 코어 코일

        // 아이콘 및 텍스트
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        this.drawPixelIcon(ctx, gate.icon, -15, -40, 30);

        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.shadowBlur = 5; ctx.shadowColor = '#000'; // 텍스트 가독성
        ctx.fillText(gate.text, 0, 25);
        ctx.restore();
    }
    drawPixelIcon(ctx, type, x, y, size) {
        ctx.fillStyle = '#fff';
        if (type === 'gun') {
            ctx.fillRect(x, y + 10, 20, 10); ctx.fillRect(x + 5, y + 20, 5, 10);
        } else if (type === 'sword') {
            ctx.fillRect(x + 10, y, 10, 25); ctx.fillRect(x, y + 25, 30, 5); ctx.fillRect(x + 10, y + 30, 10, 5);
        } else if (type === 'heart') {
            ctx.fillRect(x + 5, y, 10, 5); ctx.fillRect(x + 20, y, 10, 5);
            ctx.fillRect(x, y + 5, 35, 15); ctx.fillRect(x + 5, y + 20, 25, 5); ctx.fillRect(x + 15, y + 25, 5, 5);
        } else if (type === 'shield') {
            ctx.fillRect(x, y, 30, 20); ctx.fillRect(x + 5, y + 20, 20, 10); ctx.fillRect(x + 12, y + 30, 6, 5);
        } else if (type === 'bomb') {
            ctx.beginPath(); ctx.arc(x + 15, y + 15, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(x + 12, y - 5, 6, 10);
        }
    }
}

class Particle {
    constructor(x, y, color = '#e74c3c') {
        this.x = x; this.y = y; this.size = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 10; this.speedY = (Math.random() - 0.5) * 10;
        this.life = 1.0; this.decay = Math.random() * 0.02 + 0.02; this.color = color;
    }
    update() { this.x += this.speedX; this.y += this.speedY; this.life -= this.decay; }
    draw(ctx) { ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size); ctx.globalAlpha = 1.0; }
}

const Background = {
    speed: 5, roadLineOffset: 0,
    update: function () {
        if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.BOSS_FIGHT) return;
        this.roadLineOffset -= this.speed;
    },
    draw(ctx) {
        let bgKey = 'bg1';
        if (currentStage >= 3) bgKey = 'bg3';
        if (currentStage >= 5) bgKey = 'bg5';
        if (currentStage >= 7) bgKey = 'bg7';
        if (currentStage >= 9) bgKey = 'bg9';

        const bgImg = ImageLoader.get(bgKey);
        const isAbyss = currentStage >= 9;

        if (bgImg) {
            // "Seamless Mirror Looping" 기술 적용 - 화면 전체를 채우도록 루프 추가
            const scale = canvas.height / bgImg.height;
            const w = bgImg.width * scale;
            const h = canvas.height;

            // 전체 가로 이동 거리 (0 ~ 2w 범위로 루프)
            const totalOffset = Math.abs(this.roadLineOffset * 0.3) % (w * 2);

            // 화면 왼쪽 끝에서부터 오른쪽 끝까지 이미지를 채움
            let startX = -totalOffset;
            while (startX < canvas.width) {
                // 현재 그릴 이미지의 인덱스 (0, 1, 2...)
                // 짝수 인덱스는 정방향, 홀수 인덱스는 반전(거울) 방향
                const segmentIndex = Math.floor((startX + totalOffset + 0.1) / w);
                const isMirrored = segmentIndex % 2 === 1;

                if (isMirrored) {
                    ctx.save();
                    ctx.translate(startX + w, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(bgImg, 0, 0, w, h);
                    ctx.restore();
                } else {
                    ctx.drawImage(bgImg, startX, 0, w, h);
                }
                startX += w;
            }
        } else {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 요청사항: 하단 도로선 제거 및 배경 확장
        // 배경 이미지가 화면 전체를 채우도록 처리되었으므로 별도의 도로선은 그리지 않습니다.

        // 분위기 조성을 위한 하단 그라데이션 (배경과 자연스럽게 섞임)
        const roadGrad = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
        roadGrad.addColorStop(0, 'rgba(0,0,0,0)');
        roadGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);

        const stage = getCurrentStageData(); // EASY MODE
        const fogColor = isAbyss ? '#450a0a' : stage.fog;
        this.drawFogLayer(ctx, fogColor);
    },
    drawFogLayer: function (ctx, color) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height * 0.9);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, color + '44');
        ctx.fillStyle = grad;
        ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.4);
        ctx.restore();
    }
};

function advanceStage() {
    if (currentStage < 10) {
        currentStage++; enemiesKilled = 0; boss = null;
        currentState = GAME_STATE.PLAYING;
        storyTypingIndex = 0; storyDisplayTime = Date.now(); // 스토리 타이핑 리셋
        Player.fireRate = 200;
        Player.damage = isMobileEasyModeActive() ? Math.round(10 * EASY_MODE_CONFIG.playerDamageMultiplier) : 10; // EASY MODE
        Player.hp = Player.maxHp;
        particles.push(...Array(30).fill(0).map(() => new Particle(canvas.width / 2, canvas.height / 2, '#f1c40f')));
    } else { currentState = GAME_STATE.WIN; }
}

function startBossFight() { currentState = GAME_STATE.BOSS_FIGHT; boss = new Boss(currentStage); }

function drawHUD(ctx) {
    ctx.font = '12px "Press Start 2P"';

    // 1. 플레이어 HP 바 (좀비 서바이벌: 녹슨 금속 & 해저드 라인)
    const hpx = 20; const hpy = 20; const hpw = 200; const hph = 20;

    // 해저드 테이프(Hazard Tape) 배경무늬
    ctx.save();
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(hpx - 6, hpy - 6, hpw + 12, hph + 12);
    ctx.fillStyle = '#000';
    for (let i = 0; i < hpw + 12; i += 15) {
        ctx.beginPath(); ctx.moveTo(hpx - 6 + i, hpy - 6); ctx.lineTo(hpx - 6 + i + 8, hpy - 6);
        ctx.lineTo(hpx - 6 + i - 4, hpy + hph + 6); ctx.lineTo(hpx - 6 + i - 12, hpy + hph + 6); ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#2c3e50'; ctx.fillRect(hpx - 2, hpy - 2, hpw + 4, hph + 4); // 금속 프레임

    // 핏자국 및 녹(Rust) 픽셀 아트 효과
    ctx.fillStyle = '#8e44ad'; // 어두운 보라/빨강 녹
    ctx.fillRect(hpx - 2, hpy - 2, 4, 4); ctx.fillRect(hpx + hpw - 4, hpy + hph - 2, 6, 2);
    ctx.fillStyle = '#c0392b'; // 핏자국
    ctx.fillRect(hpx + 50, hpy - 2, 8, 3); ctx.fillRect(hpx + 53, hpy + 1, 2, 5);

    ctx.fillStyle = '#000'; ctx.fillRect(hpx, hpy, hpw, hph); // 내부 배경

    const hpRatio = Player.hp / Player.maxHp;
    const hpColor = hpRatio > 0.5 ? '#2ecc71' : (hpRatio > 0.2 ? '#f1c40f' : '#e74c3c');
    ctx.fillStyle = hpColor; ctx.fillRect(hpx, hpy, hpw * hpRatio, hph);

    // HUD 텍스트 (피 묻은 듯한 붉은색 포인트 추가)
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(`SURVIVOR HP`, hpx, hpy + 45);
    ctx.fillStyle = hpColor;
    ctx.fillText(`${Player.hp}/${Player.maxHp}`, hpx + 140, hpy + 45); // 간격을 140으로 늘려 겹침 방지

    // 2. 점수 시스템 UI (우측 상단)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE:`, canvas.width - 20, 25);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`${score.toString().padStart(6, '0')}`, canvas.width - 20, 45);

    // 3. 스테이지 및 목표 텍스트 (중앙 상단)
    ctx.textAlign = 'center'; ctx.fillStyle = '#00ffff';
    ctx.fillText(`STAGE ${currentStage}`, canvas.width / 2, 25);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(`OBJ: ${enemiesKilled}/${getCurrentStageData().goal}`, canvas.width / 2, 45); // EASY MODE

    // 3. 폭탄 카운트 (픽셀 아트 폭탄 아이콘)
    for (let i = 0; i < Player.bombCount; i++) {
        const bx = canvas.width - 120 + i * 25; const by = 55;
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(bx + 4, by - 5, 2, 5); // 심지
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(bx + 5, by + 5, 6, 0, Math.PI * 2); ctx.fill();
    }

    // 4. 스킬 알림 UI (화면 중앙 하단)
    ctx.textAlign = 'center';
    Player.skillNotifications.forEach((n, idx) => {
        const isEnding = n.timeLeft < 3000;
        const blink = Math.sin(Date.now() / 100) > 0;

        ctx.fillStyle = (isEnding && blink) ? '#e74c3c' : '#fff';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText(`${n.text}: ${(n.timeLeft / 1000).toFixed(1)}s`, canvas.width / 2, canvas.height - 50 - (idx * 20));

        // 경고 메시지
        if (isEnding) {
            ctx.fillStyle = blink ? '#ff4757' : 'transparent';
            ctx.font = '8px "Press Start 2P"';
            ctx.fillText("WARNING: EFFECT ENDING", canvas.width / 2, canvas.height - 35 - (idx * 20));
        }
    });
}

function addSkillNotification(text, duration) {
    // 중복 알림 제거
    Player.skillNotifications = Player.skillNotifications.filter(n => n.text !== text);
    Player.skillNotifications.push({ text: text, timeLeft: duration });
}

function checkCollision(r1, r2) {
    if (!r1 || !r2) return false;
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

const BOSS_SPRITE_MAP = { // MOBILE LANDSCAPE
    WALK: {
        y: 10, h: 116,
        frames: [
            { x: 215, w: 87 },
            { x: 345, w: 87 },
            { x: 476, w: 87 },
            { x: 593, w: 97 },
            { x: 734, w: 88 },
            { x: 867, w: 87 }
        ]
    },
    ATTACK: {
        y: 144, h: 119,
        frames: [
            { x: 205, w: 127 },
            { x: 340, w: 124 },
            { x: 465, w: 148 },
            { x: 615, w: 132 },
            { x: 753, w: 92 },
            { x: 872, w: 89 }
        ]
    },
    DEAD: {
        y: 270, h: 114,
        frames: [
            { x: 213, w: 101 },
            { x: 336, w: 100 },
            { x: 448, w: 149 },
            { x: 608, w: 118 },
            { x: 730, w: 128 },
            { x: 867, w: 88 }
        ]
    }
};

class Boss {
    constructor(level = 1) {
        this.x = canvas.width - 250; this.y = canvas.height / 2 - 100;
        this.width = 200; this.height = 200; this.level = level;
        this.hp = 2500 * level + (level === 10 ? 15000 : 0); this.maxHp = this.hp;
        const bossMoveMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossMoveScaleMultiplier : 1; // EASY MODE
        const gameSpeed = getMobileGameSpeedMultiplier();
        this.speedY = (3 + (level * 0.5)) * bossMoveMultiplier * gameSpeed; this.active = true; this.state = 'WALK'; // EASY MODE
        this.aniFrame = 0; this.lastFrameTime = 0; this.lastAttackTime = 0;
        this.deathHandled = false;
    }
    update(timestamp) {
        if (!this.active) return;
        const deadFrameCount = BOSS_SPRITE_MAP.DEAD.frames.length;
        const attackFrameCount = BOSS_SPRITE_MAP.ATTACK.frames.length;
        const walkFrameCount = BOSS_SPRITE_MAP.WALK.frames.length;
        if (this.state === 'DEAD') {
            if (timestamp - this.lastFrameTime > 150) {
                this.aniFrame++;
                this.lastFrameTime = timestamp;
                if (this.aniFrame >= deadFrameCount) {
                    this.aniFrame = deadFrameCount - 1; // 사망 마지막 프레임 고정
                    if (!this.deathHandled) {
                        this.deathHandled = true;
                        this.active = false;
                        currentState = GAME_STATE.STAGE_CLEAR;
                        AudioManager.playSFX('explode');
                    }
                }
            }
            return;
        }
        this.y += this.speedY; if (this.y < 50 || this.y + this.height > canvas.height - 50) this.speedY *= -1;
        const bossAttackIntervalMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossAttackIntervalMultiplier : 1; // EASY MODE
        const interval = (this.hp < 3000 ? 1000 : 1800) * bossAttackIntervalMultiplier; // EASY MODE
        if (timestamp - this.lastAttackTime > interval) {
            const p = Math.random();
            // 모바일에서는 7스테이지 이후부터만 소환 패턴 사용 (초보 보호)
            const canSummonMinions = !isMobileEasyModeActive() || currentStage >= 7;

            if (p < 0.4 && canSummonMinions) {
                // 부하 소환 패턴 (7스테이지 이후 모바일에서만)
                for (let i = 0; i < 3; i++) {
                    const e = new Enemy(this.x, this.y + this.height / 2 + (i - 1) * 80);
                    const summonEnemySpeedMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossSummonEnemySpeedMultiplier : 1; // EASY MODE
                    const summonEnemyHpMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossSummonEnemyHpMultiplier : 1; // EASY MODE
                    e.speed = 5 * summonEnemySpeedMultiplier; e.hp = Math.round(200 * summonEnemyHpMultiplier); enemies.push(e); // EASY MODE
                }
            } else if (p < 0.7 || !canSummonMinions) {
                // 보스 에너지 볼 - 모바일에서는 더 느리고 데미지 감소
                // 소환 불가능한 스테이지에서는 확률 증가 (0.4~0.7 → 0~0.7)
                const bossProjSpeed = isMobileEasyModeActive() ? 6 * EASY_MODE_CONFIG.bossProjectileSpeedMultiplier : 6;
                const bossProjDamage = isMobileEasyModeActive() ? 2 : 3;
                const b = new Projectile(this.x, this.y + this.height / 2, -bossProjSpeed, 0, 0);
                b.isBossEnergyBall = true; b.lifeDamage = bossProjDamage; b.width = 45; b.height = 45; projectiles.push(b);
            } else {
                // 보스 산탄 - 모바일에서는 속도 감소
                const bossScatterSpeed = isMobileEasyModeActive() ? 8 * EASY_MODE_CONFIG.bossProjectileSpeedMultiplier : 8;
                for (let i = -1; i <= 1; i++) {
                    const b = new Projectile(this.x, this.y + this.height / 2, -bossScatterSpeed, i * 1.5, 0);
                    b.isEnemyBullet = true; projectiles.push(b);
                }
            }
            this.lastAttackTime = timestamp; this.state = 'ATTACK'; this.aniFrame = 0;
        }
        if (timestamp - this.lastFrameTime > 150) {
            this.aniFrame++;
            this.lastFrameTime = timestamp;

            if (this.state === 'ATTACK' && this.aniFrame >= attackFrameCount) {
                this.state = 'WALK';
                this.aniFrame = 0;
            } else if (this.state === 'WALK') {
                this.aniFrame %= walkFrameCount;
            }
        }
    }
    draw(ctx) {
        const img = ImageLoader.get('boss');
        if (img) {
            const animSet = BOSS_SPRITE_MAP[this.state] || BOSS_SPRITE_MAP.WALK;
            const frame = animSet.frames[this.aniFrame % animSet.frames.length];
            const frameW = frame.w;
            const frameH = animSet.h;
            const sx = frame.x;
            const sy = animSet.y;

            // 원본 비율 유지 + 약간 확대해 잘림 없이 표현
            const scale = 1.25;
            const drawW = this.width * scale;
            const drawH = (frameH / frameW) * drawW;
            const anchorY = this.y + this.height;
            const drawCenterX = this.x + this.width / 2;

            ctx.save();
            ctx.translate(drawCenterX, anchorY - drawH / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(img, sx, sy, frameW, frameH, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }
        // 보스 체력 바 (정교한 픽셀 프레임)
        const bx = canvas.width / 2 - 200; const by = 70; const bw = 400; const bh = 20;
        const bossHpClamped = Math.max(0, Math.min(this.hp, this.maxHp));
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
        ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ff4757'; ctx.fillRect(bx, by, (bossHpClamped / this.maxHp) * bw, bh);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Press Start 2P"'; ctx.textAlign = 'center';
        ctx.fillText('BOSS: BLUE RABBIT', canvas.width / 2, by + 15);
    }
}

function spawnEnemyWave() {
    if (isMobileEasyModeActive() && enemies.filter(e => e.active && e.state !== 'DEAD').length >= EASY_MODE_CONFIG.maxActiveEnemies) return; // EASY MODE
    const stage = getCurrentStageData(); // EASY MODE
    const e = new Enemy(canvas.width + 50, Math.random() * (canvas.height - 100) + 50);
    e.speed = stage.enemySpeed;
    enemies.push(e);
}

function createExplosion(x, y, color = '#e74c3c') { for (let i = 0; i < 15; i++) particles.push(new Particle(x, y, color)); }
function endGame() {
    if (currentState !== GAME_STATE.GAME_OVER) gameOverStartTime = Date.now();
    currentState = GAME_STATE.GAME_OVER;
}
function resetGame() { projectiles = []; enemies = []; particles = []; gates = []; currentStage = 1; enemiesKilled = 0; boss = null; currentState = GAME_STATE.PLAYING; gameOverStartTime = 0; Player.init(); updateMainMenuVisibility(); }

function createBombExplosion() {
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    for (let ring = 0; ring < 5; ring++) {
        for (let i = 0; i < 30 + ring * 10; i++) {
            const angle = (i / (30 + ring * 10)) * Math.PI * 2;
            const p = new Particle(cx, cy, ['#ff4757', '#ffa502', '#ff6b81', '#eccc68', '#ff9ff3'][ring % 5]);
            p.speedX = Math.cos(angle) * (3 + ring * 2); p.speedY = Math.sin(angle) * (3 + ring * 2);
            p.size = 8 - ring; p.decay = 0.01 + ring * 0.005; particles.push(p);
        }
    }
}

function useBomb() {
    if (Player.bombCount > 0) {
        Player.bombCount--; createBombExplosion();
        for (const e of enemies) { if (e.state !== 'DEAD') { e.state = 'DEAD'; e.aniFrame = 0; } }
        if (boss && boss.active) {
            boss.hp -= 500;
            if (boss.hp <= 0 && boss.state !== 'DEAD') {
                boss.state = 'DEAD';
                boss.aniFrame = 0;
                boss.lastFrameTime = Date.now();
            }
        }
        AudioManager.playSFX('explode');
    }
}

window.addEventListener('mousemove', (e) => Player.targetY = e.clientY - Player.height / 2);
// 데스크톱 클릭 처리 (START 상태에서는 버튼만 작동)
window.addEventListener('mousedown', () => {
    if (currentState === GAME_STATE.START) {
        // START 상태에서는 버튼 클릭만 처리 (자동 시작 안함)
        return;
    }
    enterMobileFullscreen();
    AudioManager.init(); AudioManager.startBGM();
    if (currentState === GAME_STATE.GAME_OVER || currentState === GAME_STATE.WIN) resetGame();
    else if (currentState === GAME_STATE.STAGE_CLEAR) advanceStage();
});

// 데스크탑 더블 클릭 폭탄
window.addEventListener('dblclick', (e) => {
    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) {
        useBomb();
        e.preventDefault();
    }
});

// --- 모바일 터치 및 더블 탭 지원 ---
let lastTapTime = 0;

window.addEventListener('touchstart', (e) => {
    if (currentState === GAME_STATE.START) {
        // START 상태에서는 버튼 클릭만 처리 (자동 시작 안함)
        return;
    }

    enterMobileFullscreen();
    AudioManager.init(); AudioManager.startBGM();

    // 상태 전환 로직
    if (currentState === GAME_STATE.GAME_OVER || currentState === GAME_STATE.WIN) resetGame();
    else if (currentState === GAME_STATE.STAGE_CLEAR) advanceStage();

    // 더블 탭 감지 (폭탄 사용)
    const currentTime = Date.now();
    const tapLength = currentTime - lastTapTime;
    if (tapLength > 0 && tapLength < 300 && (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT)) {
        useBomb();
        e.preventDefault();
    }
    lastTapTime = currentTime;

    // 터치한 위치로 이동
    if (e.touches.length > 0) {
        Player.targetY = e.touches[0].clientY - Player.height / 2;
    }
}, { passive: false });

window.addEventListener('contextmenu', (e) => {
    if (isMobileTouchDevice()) e.preventDefault(); // MOBILE LANDSCAPE
});

window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        Player.targetY = e.touches[0].clientY - Player.height / 2;
    }
    e.preventDefault(); // 모바일 브라우저 화면 스크롤 방지
}, { passive: false });

window.addEventListener('keydown', (e) => { if (e.code === 'Space' && (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT)) useBomb(); });

function resizeCanvas() {
    const viewport = getViewportSize(); // MOBILE LANDSCAPE
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    Player.init();
}
function handleResize() {
    applyMobileOptimizations();
    resizeCanvas();

    // 모바일 가로 모드에서 자동 전체화면
    if (isMobileLandscapeOrientation() && !document.fullscreenElement) {
        enterMobileFullscreen();
    }
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);
applyMobileOptimizations();
resizeCanvas();

function gameLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 메인 메뉴 가시성 업데이트 (START 상태에서만 표시)
    updateMainMenuVisibility();
    updateInstallButtonVisibility();
    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT || currentState === GAME_STATE.STAGE_CLEAR) {
        // STAGE_CLEAR일 때도 보스 업데이트 필요 (사망 애니메이션 완료)
        if (currentState !== GAME_STATE.STAGE_CLEAR) {
            Background.update(); Player.update(timestamp);
        }
        if (timestamp - gateSpawnTimer > GATE_SPAWN_INTERVAL && currentState !== GAME_STATE.STAGE_CLEAR) { gates.push(new GatePair(canvas.width + 50)); gateSpawnTimer = timestamp; }
        const stage = getCurrentStageData(); // EASY MODE
        if (timestamp - spawnTimer > stage.spawnRate && currentState === GAME_STATE.PLAYING && !boss) { spawnEnemyWave(); spawnTimer = timestamp; }
        if (boss) boss.update(timestamp);
        for (let i = gates.length - 1; i >= 0; i--) { if (currentState !== GAME_STATE.STAGE_CLEAR) { gates[i].update(); if (!gates[i].active) gates.splice(i, 1); } }
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i]; p.update(); if (!p.active) { projectiles.splice(i, 1); continue; }

            // 플레이어의 공격 (적에게 맞음)
            if (!p.isEnemyBullet && !p.isBossEnergyBall) {
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j]; if (e.state === 'DEAD') continue;
                    if (checkCollision(p, e)) {
                        e.hp -= p.damage; p.active = false;
                        if (e.hp <= 0) { e.state = 'DEAD'; e.aniFrame = 0; enemiesKilled++; score += 100; createExplosion(e.x, e.y); AudioManager.playSFX('explode'); if (enemiesKilled >= stage.goal && !boss) startBossFight(); }
                        break;
                    }
                }
                if (boss && boss.active && boss.state !== 'DEAD' && checkCollision(p, boss)) {
                    boss.hp -= p.damage; p.active = false; createExplosion(p.x, p.y, '#ff4757');
                    if (boss.hp <= 0 && boss.state !== 'DEAD') {
                        boss.state = 'DEAD';
                        boss.aniFrame = 0;
                        boss.lastFrameTime = timestamp;
                        score += 5000;
                    }
                }
            } else {
                // 적의 공격 (플레이어에게 맞음)
                if (Player.state === 'ALIVE' && checkCollision(p, Player)) {
                    p.active = false; createExplosion(p.x, p.y, '#ff4757');
                    if (Player.shield <= 0) {
                        Player.hp -= (p.isBossEnergyBall ? 3 : 1);
                        Player.shield = getPlayerInvincibleDuration(); AudioManager.playSFX('hit'); // EASY MODE
                        if (Player.hp <= 0) {
                            Player.state = 'DEAD';
                            Player.aniFrame = 0;
                            Player.lastFrameTime = timestamp;
                            createExplosion(Player.x, Player.y, '#c0392b');
                        }
                    }
                }
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) { enemies[i].update(timestamp); if (!enemies[i].active) enemies.splice(i, 1); }
        for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].life <= 0) particles.splice(i, 1); }
    }
    Background.draw(ctx); drawHUD(ctx);
    if (boss) boss.draw(ctx);
    for (const g of gates) g.draw(ctx);
    for (const p of projectiles) p.draw(ctx);
    for (const e of enemies) e.draw(ctx);
    for (const pt of particles) pt.draw(ctx);
    Player.draw(ctx);

    // 플로팅 텍스트 업데이트 및 그리기
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1; ft.life -= 0.02;
        if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = ft.life;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }

    drawStoryText(ctx, timestamp); // 스토리 연출 레이어 추가

    if (currentState === GAME_STATE.START) drawStartScreen();
    if (currentState === GAME_STATE.GAME_OVER) drawGameOverScreen();
    if (currentState === GAME_STATE.WIN) drawWinScreen();
    if (currentState === GAME_STATE.STAGE_CLEAR) drawStageClearScreen();
    requestAnimationFrame(gameLoop);
}

function drawStartScreen() {
    ctx.fillStyle = '#0a0505'; // 좀비물 특유의 핏빛 섞인 어둠
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const titleImg = ImageLoader.get('title');
    const time = Date.now();
    const pulse = Math.sin(time / 400) * 0.05 + 1.0;

    // 좀비 분위기의 피 흘러내리는 픽셀 효과 (위에서 아래로)
    ctx.fillStyle = '#450a0a';
    for (let i = 0; i < canvas.width; i += 40) {
        const dripLength = Math.abs(Math.sin((i + time / 500) * 0.1)) * 100 + 20;
        ctx.fillRect(i, 0, 10, dripLength);
        ctx.fillRect(i + 2, dripLength, 6, 5); // 핏방울
    }

    // 배경 입자 효과 (독성 포자 느낌)
    if (time % 100 < 5) {
        particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height, 'rgba(46, 204, 113, 0.3)'));
    }

    // 화면 크기에 따른 스케일 계산 (모바일 대응 개선)
    const isMobile = isMobileTouchDevice();
    const minDim = Math.min(canvas.width, canvas.height);
    const maxDim = Math.max(canvas.width, canvas.height);
    const isPortrait = window.innerHeight > window.innerWidth;

    // 모바일에서는 더 큰 최소 스케일 보장
    let scaleFactor;
    if (isMobile) {
        if (isPortrait) {
            // 세로 모드: 더 작은 스케일 사용
            scaleFactor = Math.max(0.65, Math.min(0.85, minDim / 500));
        } else {
            // 가로 모드: 중간 스케일 사용
            scaleFactor = Math.max(0.75, Math.min(1, minDim / 600));
        }
    } else {
        // 데스크톱
        scaleFactor = Math.min(1, minDim / 600);
    }

    // 화면 크기별 레이아웃 계산
    const marginTop = isMobile ? 30 * scaleFactor : 50;
    const contentSpacing = isMobile ? 20 * scaleFactor : 40;

    if (titleImg) {
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#00ffff';
        const maxTitleW = isMobile ? Math.min(400 * scaleFactor, canvas.width * 0.9) : 500 * pulse * scaleFactor;
        const w = maxTitleW;
        const h = (w / titleImg.width) * titleImg.height;
        // 모바일에서는 상단에 배치
        const titleY = isMobile ? marginTop : canvas.height / 2 - h / 2 - 80 * scaleFactor;
        ctx.drawImage(titleImg, canvas.width / 2 - w / 2, titleY, w, h);
        ctx.restore();
    }

    // 메인 타이틀 텍스트
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 외곽 광채 효과 (거대한 핏빛 광채)
    ctx.shadowBlur = 30 * scaleFactor;
    ctx.shadowColor = '#e74c3c';
    ctx.fillStyle = '#fff';
    // 모바일에서 더 큰 폰트 크기 보장
    const titleFontSize = isMobile ? Math.max(24, Math.floor(36 * scaleFactor)) : Math.floor(36 * scaleFactor);
    ctx.font = `bold ${titleFontSize}px "Press Start 2P"`;
    // 모바일에서는 타이틀 이미지 아래에 텍스트 배치
    const textY = isMobile && titleImg ? marginTop + (350 * scaleFactor) + 20 * scaleFactor : canvas.height / 2 + 30 * scaleFactor;
    ctx.fillText('Yeon', canvas.width / 2, textY);

    const subtitleFontSize = isMobile ? Math.max(10, Math.floor(13 * scaleFactor)) : Math.floor(13 * scaleFactor);
    ctx.font = `${subtitleFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#e74c3c';
    ctx.shadowBlur = 10 * scaleFactor;
    ctx.fillText('THE KILLER OF BLUE ZOMBIE', canvas.width / 2, textY + 40 * scaleFactor);
    ctx.restore();

    // 2D 도트 스타일 게임 가이드 패널
    // 모바일에서는 패널 크기를 더 작게 조정
    const panelW = isMobile ? canvas.width * 0.95 : Math.min(760 * scaleFactor, canvas.width * 0.9);
    const panelH = isMobile ? Math.min(200 * scaleFactor, canvas.height * 0.35) : Math.min(180 * scaleFactor, canvas.height * 0.25);
    const panelX = canvas.width / 2 - panelW / 2;
    // 모바일에서는 타이틀 아래 또는 중앙 근처에 배치
    let panelY;
    if (isMobile) {
        if (isPortrait) {
            // 세로: 중앙에 배치
            panelY = canvas.height / 2 - panelH / 2 + 20 * scaleFactor;
        } else {
            // 가로: 하단에 배치
            panelY = canvas.height - panelH - 60 * scaleFactor;
        }
    } else {
        // 데스크톱: 하단
        panelY = canvas.height - panelH - 40 * scaleFactor;
    }
    const pulseAlpha = 0.5 + Math.sin(time / 250) * 0.15;

    ctx.save();
    // 외곽 프레임
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(panelX - 6, panelY - 6, panelW + 12, panelH + 12);
    ctx.fillStyle = '#111';
    ctx.fillRect(panelX - 3, panelY - 3, panelW + 6, panelH + 6);

    // 본문 패널
    ctx.fillStyle = 'rgba(8, 12, 20, 0.92)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4);

    // 도트 장식
    ctx.fillStyle = `rgba(0,255,255,${pulseAlpha})`;
    const dotSpacing = Math.max(16, 24 * scaleFactor);
    for (let i = 0; i < panelW; i += dotSpacing) {
        ctx.fillRect(panelX + i, panelY + 22 * scaleFactor, 4 * scaleFactor, 4 * scaleFactor);
        ctx.fillRect(panelX + i + 8 * scaleFactor, panelY + panelH - 26 * scaleFactor, 4 * scaleFactor, 4 * scaleFactor);
    }

    // 모바일에서 가독성 좋은 폰트 크기
    const fontSizeGuide = isMobile ? Math.max(10, Math.floor(11 * scaleFactor)) : Math.max(7, Math.floor(10 * scaleFactor));
    const fontSizeText = isMobile ? Math.max(9, Math.floor(10 * scaleFactor)) : Math.max(6, Math.floor(8 * scaleFactor));
    const lineHeight = Math.max(18, 24 * scaleFactor);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1c40f';
    ctx.font = `${fontSizeGuide}px "Press Start 2P"`;
    ctx.fillText('MISSION GUIDE', panelX + 20 * scaleFactor, panelY + 28 * scaleFactor);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSizeText}px "Press Start 2P"`;
    let lineY = panelY + 56 * scaleFactor;

    // 모바일에서는 간단한 안내 텍스트 사용
    if (isMobile && isPortrait) {
        // 세로 모드: 간략한 가이드
        ctx.fillText('- DRAG to Move', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- AUTO FIRE', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- DOUBLE TAP for BOMB', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- DEFEAT BOSS', panelX + 20 * scaleFactor, lineY);
    } else {
        // 가로/데스크톱: 전체 가이드
        ctx.fillText('- MOVE: MOUSE / TOUCH DRAG', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- ATTACK: AUTO FIRE', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- BOMB: DOUBLE TAP / SPACE', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- SURVIVE WAVES & DESTROY BOSS', panelX + 20 * scaleFactor, lineY);
        lineY += lineHeight;
        ctx.fillText('- PICK GATES TO GAIN BUFFS', panelX + 20 * scaleFactor, lineY);
    }
    ctx.restore();

    // 스캔라인 효과
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 0; i < canvas.height; i += 4) ctx.fillRect(0, i, canvas.width, 1);

    // 메인 메뉴 버튼은 HTML 오버레이로 표시됨 (drawStartScreen 외부)
}

function drawWinScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();

    // 골든 스파크 (시네마틱 승리 연출)
    if (time % 100 < 40) {
        for (let i = 0; i < 3; i++) {
            const p = new Particle(Math.random() * canvas.width, -20, Math.random() > 0.5 ? '#f1c40f' : '#e67e22');
            p.speedY = 1 + Math.random() * 3; p.speedX = (Math.random() - 0.5) * 2;
            p.decay = 0.005;
            particles.push(p);
        }
    }

    const img = ImageLoader.get('win');
    const minDimWin = Math.min(canvas.width, canvas.height);
    const winScale = Math.min(1, minDimWin / 600);
    if (img) {
        ctx.save();
        ctx.shadowBlur = 60 * winScale; ctx.shadowColor = '#f1c40f';
        const winSize = 300 * winScale;
        ctx.drawImage(img, canvas.width / 2 - winSize / 2, canvas.height / 2 - winSize * 0.85, winSize, winSize);
        ctx.restore();
    }

    ctx.fillStyle = '#f1c40f'; ctx.font = `${Math.floor(36 * winScale)}px "Press Start 2P"`; ctx.textAlign = 'center';
    ctx.shadowBlur = 15 * winScale; ctx.shadowColor = '#f1c40f';
    ctx.fillText('ALL CLEAR!', canvas.width / 2, canvas.height / 2 + 100 * winScale);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = `${Math.max(10, Math.floor(14 * winScale))}px "Press Start 2P"`;
    ctx.fillText('THE LEGENDARY KILLER SAVED THE WORLD', canvas.width / 2, canvas.height / 2 + 160 * winScale);

    const blink = Math.sin(time / 300) > 0;
    if (blink) {
        ctx.fillStyle = '#f1c40f'; ctx.font = `${Math.max(10, Math.floor(12 * winScale))}px "Press Start 2P"`;
        ctx.fillText(isMobileTouchDevice() ? 'TAP TO RETURN' : 'CLICK TO RETURN TO TITLE', canvas.width / 2, canvas.height / 2 + 220 * winScale);
    }
}

function drawStageClearScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    const bounce = Math.sin(time / 200) * 10;
    const minDim = Math.min(canvas.width, canvas.height);
    const scale = Math.min(1, minDim / 600);

    // 골든 스파크 (시네마틱 연출)
    if (time % 100 < 40) {
        particles.push(new Particle(Math.random() * canvas.width, -10, '#f1c40f'));
    }

    const img = ImageLoader.get('win');
    if (img) {
        ctx.save();
        ctx.shadowBlur = 40 * scale; ctx.shadowColor = '#00ffff';
        const imgSize = 240 * scale;
        ctx.drawImage(img, canvas.width / 2 - imgSize / 2, canvas.height / 2 - imgSize * 0.9 + bounce * scale, imgSize, imgSize);
        ctx.restore();
    }

    ctx.fillStyle = '#00ffff'; ctx.font = `${Math.floor(32 * scale)}px "Press Start 2P"`; ctx.textAlign = 'center';
    ctx.shadowBlur = 20 * scale; ctx.shadowColor = '#00ffff';
    ctx.fillText('STAGE ' + currentStage + ' CLEAR!', canvas.width / 2, canvas.height / 2 + 120 * scale);

    ctx.shadowBlur = 0;
    const blink = Math.sin(time / 300) > 0;
    if (blink) {
        ctx.fillStyle = '#fff'; ctx.font = `${Math.max(12, Math.floor(16 * scale))}px "Press Start 2P"`;
        ctx.fillText(isMobileTouchDevice() ? 'TAP FOR NEXT LEVEL' : 'CLICK FOR NEXT LEVEL', canvas.width / 2, canvas.height / 2 + 190 * scale);
    }
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(10, 0, 0, 0.95)'; // 더 짙은 검붉은 어둠
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const time = Date.now();
    if (!gameOverStartTime) gameOverStartTime = time;
    const elapsed = time - gameOverStartTime;
    const introProgress = Math.min(1, elapsed / 900);

    // 절망적인 핏빛 스파크 (아래에서 위로)
    if (time % 100 < 40) {
        const p = new Particle(Math.random() * canvas.width, canvas.height + 10, '#c0392b');
        p.speedY = -1 - Math.random() * 2; p.speedX = (Math.random() - 0.5);
        particles.push(p);
    }

    const img = ImageLoader.get('gameover');
    if (img) {
        ctx.save();
        // 게임오버 스프라이트 시트를 순차 재생하고 프레임 블렌딩으로 자연스럽게 연결
        const frameHeight = img.height;
        const frameCount = Math.max(1, Math.floor(img.width / frameHeight));
        const frameStride = img.width / frameCount;
        const animFps = 10;
        const frameFloat = (elapsed / 1000) * animFps;
        const frameIndex = Math.floor(frameFloat) % frameCount;
        const nextFrameIndex = (frameIndex + 1) % frameCount;
        const blend = frameFloat - Math.floor(frameFloat);

        const shake = elapsed < 900 ? (1 - introProgress) * Math.sin(time / 20) * 5 : 0;
        const animScale = 0.9 + introProgress * 0.1;
        const alpha = Math.min(1, elapsed / 450);
        const minDim = Math.min(canvas.width, canvas.height);
        const screenScale = Math.min(1, minDim / 600);
        const finalScale = animScale * screenScale;
        const baseW = 520 * screenScale;
        const w = baseW * animScale;
        const h = (baseW / frameStride) * frameHeight * animScale;
        const drawX = canvas.width / 2 - w / 2 + shake * screenScale;
        const drawY = canvas.height / 2 - h / 2 - 90 * screenScale;

        ctx.shadowBlur = 40 + Math.sin(time / 200) * 20;
        ctx.shadowColor = '#c0392b';

        ctx.globalAlpha = alpha * (1 - blend);
        ctx.drawImage(img, frameIndex * frameStride, 0, frameStride, frameHeight, drawX, drawY, w, h);

        // 다음 프레임을 살짝 섞어 끊김을 줄임
        ctx.globalAlpha = alpha * blend;
        ctx.drawImage(img, nextFrameIndex * frameStride, 0, frameStride, frameHeight, drawX, drawY, w, h);
        ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const minDimGO = Math.min(canvas.width, canvas.height);
    const goScale = Math.min(1, minDimGO / 600);

    // 메인 사망 메시지
    ctx.shadowBlur = 20 * goScale; ctx.shadowColor = '#e74c3c';
    ctx.fillStyle = '#ff4757'; ctx.font = `bold ${Math.floor(36 * goScale)}px "Press Start 2P"`;
    ctx.fillText('YOU ARE DEAD', canvas.width / 2, canvas.height / 2 + 50 * goScale);

    // 최종 점수 표시
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f1c40f'; ctx.font = `${Math.max(12, Math.floor(18 * goScale))}px "Press Start 2P"`;
    ctx.fillText('FINAL SCORE: ' + score.toLocaleString(), canvas.width / 2, canvas.height / 2 + 100 * goScale);

    // 점수별 차등 멘트 (꽃돼지 연이의 좀비 아포칼립스 세계관)
    let loreMessage = "";
    let messageColor = "#bdc3c7";

    if (score < 10000) {
        loreMessage = "세상은 푸른 어둠에 잠겼습니다.\n하지만 연이의 분홍빛 투지는 아직 지지 않았습니다.";
    } else if (score < 30000) {
        loreMessage = "수많은 청토끼를 물리쳤으나, 역병의 근원은 여전히 날뜁니다.\n다시 일어나세요, 세상을 구할 유일한 꽃돼지여!";
        messageColor = "#e67e22";
    } else if (score < 70000) {
        loreMessage = "당신의 분홍빛 희망은 어둠 속에서도 찬란했습니다.\n세상은 당신의 숭고한 희생과 총성을 영원히 기억할 것입니다.";
        messageColor = "#9b59b6";
    } else {
        loreMessage = "전설적인 좀비 킬러.\n당신의 투혼은 사악한 청토끼들에게 영원한 공포로 각인될 것입니다.";
        messageColor = "#00ffff";
    }

    // 멘트 줄바꿈 처리하여 출력
    ctx.fillStyle = messageColor; ctx.font = `${Math.max(10, Math.floor(12 * goScale))}px "Press Start 2P"`;
    const lines = loreMessage.split('\n');
    const lineHeight = Math.max(18, 25 * goScale);
    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 + 150 * goScale + (i * lineHeight));
    });

    // 다시 시작 안내
    const blink = Math.sin(time / 300) > 0;
    if (blink) {
        ctx.fillStyle = '#e74c3c'; ctx.font = `${Math.max(11, Math.floor(14 * goScale))}px "Press Start 2P"`;
        ctx.fillText(isMobileTouchDevice() ? 'TAP TO RISE AGAIN' : 'CLICK TO RISE AGAIN', canvas.width / 2, canvas.height / 2 + 230 * goScale);
    }
    ctx.restore();
}

// --- 스토리 텍스트 연출 시스템 ---
function drawStoryText(ctx, timestamp) {
    const stage = STAGE_DATA[currentStage];
    if (!stage || !stage.storyText) return;

    const text = stage.storyText;
    const typingSpeed = 85; // 속도를 조금 더 느리게 조정
    const elapsed = Date.now() - storyDisplayTime;
    const fullTypingTime = text.length * typingSpeed;
    const holdAfterFullText = 1000;
    const fadeOutDuration = 2000;
    const totalDisplayTime = fullTypingTime + holdAfterFullText + fadeOutDuration;
    if (elapsed > totalDisplayTime) return;
    const charCount = Math.floor(elapsed / typingSpeed);
    const displayText = text.substring(0, charCount);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '14px "Press Start 2P"';

    let alpha = 1.0;
    if (elapsed < 1000) alpha = elapsed / 1000;
    const fadeOutStart = fullTypingTime + holdAfterFullText;
    if (elapsed > fadeOutStart) alpha = Math.max(0, 1 - (elapsed - fadeOutStart) / fadeOutDuration);

    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.fillStyle = '#ffffff';

    const maxWidth = canvas.width * 0.7;
    // 줄바꿈 기호(\n) 처리
    const paragraphs = displayText.split('\n');
    let currentY = canvas.height / 2 - (paragraphs.length * 20);
    for (const p of paragraphs) {
        currentY = wrapText(ctx, p, canvas.width / 2, currentY, maxWidth, 30);
        currentY += 10; // 문단 간 간격 추가
    }

    ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (text.length === 0) return y + lineHeight; // 빈 줄 처리
    let line = '';
    let testY = y;

    for (let n = 0; n < text.length; n++) {
        const char = text[n];
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, testY);
            line = char;
            testY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, testY);
    return testY + lineHeight; // 다음 시작 Y 좌표 반환
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, color, life: 1.0 });
}

async function init() {
    await ImageLoader.loadAllAssets();
    Player.init();
    updateMainMenuVisibility();
    updateInstallButtonVisibility();
    requestAnimationFrame(gameLoop);
}
init();