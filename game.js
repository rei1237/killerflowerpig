let GAME_WIDTH=window.innerWidth;
let GAME_HEIGHT=window.innerHeight;
let GAME_DPR=1;
/**
 * ============================================================================
 * [Game Engine Core - Final Master]
 * AI Assistant 가이드: 이 파일은 HTML5 Canvas 기반 횡스크롤 게임의 코어 로직입니다.
 * - ASSETS 객체에 이미지 경로를 추가하면 도형이 자동으로 이미지/스프라이트로 교체됩니다.
 * - Player, Enemy, Gate, Projectile 등 모든 객체는 독립적인 클래스/리터럴로 관리됩니다.
 * ============================================================================
 */

function isMobileTouchDevice() {
    const ua = navigator.userAgent || '';
    const byUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
    const byPointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return byUA || byPointer;
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
// 모바일 고화질: devicePixelRatio 적용 (모바일 감지 시 1.5로 줄여 극적인 렉 방지 효과 제공)
const DPR = isMobileTouchDevice() ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 3);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const gameContainer = document.getElementById('game-container');
const installButton = document.getElementById('install-btn');
const startButton = document.getElementById('start-btn');
const startBtnContainer = document.getElementById('start-btn-container');
const installBtnContainer = document.getElementById('install-btn-container');
const gameoverButtons = document.getElementById('gameover-buttons');
const retryButton = document.getElementById('retry-btn');
const quitButton = document.getElementById('quit-btn');

// 패스워드 및 스테이지 선택 UI
const passwordContainer = document.getElementById('password-container');
const stagePasswordInput = document.getElementById('stage-password');
const passwordDots = document.getElementById('password-dots');
const passwordSubmitBtn = document.getElementById('password-submit');
const passwordError = document.getElementById('password-error');
const stageSelectContainer = document.getElementById('stage-select-container');
const stageSelectCloseBtn = document.getElementById('stage-select-close');
const stageButtons = document.querySelectorAll('.stage-btn');

// 인게임 DOM UI
const inGameUi = document.getElementById('in-game-ui');
const domHpBar = document.getElementById('dom-hp-bar');
const domScore = document.getElementById('dom-score');
const btnBomb = document.getElementById('btn-bomb');
const virtualJoystick = document.getElementById('virtual-joystick');
const joystickKnob = document.getElementById('joystick-knob');

// 오버레이 및 타이틀 UI
const overlayStageClear = document.getElementById('overlay-stage-clear');
const stageClearEpilogueBtn = document.getElementById('stage-clear-epilogue-btn');
const stageClearTitle = document.getElementById('stage-clear-title');
const stageClearDesc = document.getElementById('stage-clear-desc');
// 에필로그 버튼 이벤트 (스테이지 클리어 오버레이)
if (stageClearEpilogueBtn) {
    stageClearEpilogueBtn.addEventListener('click', () => {
        currentState = GAME_STATE.EPILOGUE;
        storyStateEnterTime = Date.now();
        storyTypingIndex = 0;
        storyTextComplete = false;
        storyPages = [];
        storyCurrentPage = 0;
        storyTotalPages = 0;
        lastTypedCharIndex = 0;
        AudioManager.playEpilogueBGM();
        updateMainMenuVisibility();
        updateOverlayVisibility();
    });
}
const overlayWin = document.getElementById('overlay-win');
const winScoreText = document.getElementById('win-score-text');
const winRetryBtn = document.getElementById('win-retry-btn');
const winQuitBtn = document.getElementById('win-quit-btn');
const gameoverStats = document.getElementById('gameover-stats');


if (winRetryBtn) {
    winRetryBtn.addEventListener('click', () => {
        // 게임 초기화 후 메인 화면으로 이동
        resetGame();
        currentState = GAME_STATE.START;
        updateMainMenuVisibility();
    });
}

if (winQuitBtn) {
    winQuitBtn.addEventListener('click', () => {
        exitGame();
    });
}

if (btnBomb) {
    const handleBomb = (e) => {
        e.preventDefault();
        if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) {
            useBomb();
        }
    };
    btnBomb.addEventListener('touchstart', handleBomb, { passive: false });
    btnBomb.addEventListener('mousedown', handleBomb);
}

function updateInGameUIVisibility() {
    const shouldShow = (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT || currentState === GAME_STATE.STAGE_CLEAR);
    if (inGameUi) inGameUi.hidden = !shouldShow;
}

// --- 캔버스 기반 HUD 렌더링 (닌텐도 클래식 2D 스타일) ---
function drawHUD(ctx) {
    const time = Date.now();
    const pulse = 0.7 + 0.3 * Math.sin(time / 400);
    const isMobile = isMobileTouchDevice();
    const isLandscape = window.innerWidth > window.innerHeight;
    // 가로/세로 동일 스케일 (프리미엄 통일 UI)
    const scale = isMobile ? 0.65 : 0.85;

    ctx.save();
    ctx.scale(scale, scale);

    // === COMPACT UI (프리미엄 통일) ===
    const startX = 15;
    const startY = 12;
    const panelW = 265; // 방어력 패널 추가를 위해 확장 (240 -> 265)
    const panelH = 70;

    // 1. Shadow/Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(startX + 2, startY + 2, panelW, panelH);

    // 2. Frame (brass border)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#bfa76f';
    ctx.strokeRect(startX, startY, panelW, panelH);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(startX + 2, startY + 2, panelW - 4, panelH - 4);

    // 3. HP - 동적 하트 아이콘 (레벨업으로 최대 체력 증가)
    const hpBarX = startX + 10;
    const hpBarY = startY + 12;
    const totalHearts = Player.maxHp;
    const currentHp = Math.ceil(Math.max(0, Player.hp));
    // 하트 크기 동적 조절 (더 많은 하트 지원)
    const maxDisplayHearts = Math.min(totalHearts, 15);
    const heartSize = totalHearts > 10 ? 10 : (totalHearts > 6 ? 12 : 16);
    const heartGap = totalHearts > 10 ? 1 : (totalHearts > 6 ? 2 : 4);

    // 라벨
    ctx.fillStyle = '#aaa';
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText("HP", hpBarX, hpBarY + 5);

    for (let h = 0; h < maxDisplayHearts; h++) {
        const hx = hpBarX + 22 + h * (heartSize + heartGap);
        const hy = hpBarY - 2;
        const filled = h < currentHp;
        const pulse = filled && currentHp === 1 ? 0.7 + 0.3 * Math.sin(time / 150) : 1;

        ctx.save();
        if (filled) {
            // 채워진 하트: 빨간색 글로우
            ctx.shadowBlur = 8 * pulse;
            ctx.shadowColor = '#ff4757';
            ctx.font = `${Math.round(heartSize * pulse)}px serif`;
        } else {
            // 빈 하트: 어두운 색
            ctx.globalAlpha = 0.3;
            ctx.font = `${heartSize}px serif`;
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('❤️', hx, hy);
        ctx.restore();
    }
    // HP 숫자 표시 (항상 표시 - 프리미엄 스타일)
    ctx.fillStyle = currentHp <= 1 ? '#ff4757' : '#fff';
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'left';
    const hpTextX = hpBarX + 22 + maxDisplayHearts * (heartSize + heartGap) + 4;
    ctx.fillText(`${currentHp}/${totalHearts}`, hpTextX, hpBarY + 5);

    // === [COMPACT LEVEL UI - FITS IN MAIN PANEL] ===
    const statsY = startY + 46;
    const levelPanelW = 56;
    const levelPanelH = 18;
    
    // Helper: Draw advanced mini panel with 3D metallic effect
    function drawMiniPanel(x, y, w, h, borderColor, bgColor, glowColor) {
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 2, y + 2, w, h);
        
        // Outer border with glow
        if (glowColor) {
            ctx.shadowBlur = 6;
            ctx.shadowColor = glowColor;
        }
        ctx.fillStyle = borderColor;
        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur = 0;
        
        // Inner background with gradient
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, bgColor);
        grad.addColorStop(0.5, adjustColor(bgColor, 10));
        grad.addColorStop(1, adjustColor(bgColor, -10));
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        
        // Top highlight line
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 2, y + 2, w - 4, 1);
    }
    
    // Helper: Adjust color brightness
    function adjustColor(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x00FF) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    
    // Helper: Draw compact skull icon (smaller)
    function drawPixelSkull(cx, cy, color) {
        ctx.fillStyle = color;
        // Compact skull (6x8 pixels)
        const skullPixels = [
            [0,-3],[-1,-3],[1,-3],
            [-2,-2],[2,-2],
            [-2,-1],[2,-1],
            [0,0],
            [-1,1],[1,1]
        ];
        skullPixels.forEach(([px, py]) => {
            ctx.fillRect(cx + px, cy + py, 2, 2);
        });
        
        // Eye glow (smaller)
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(cx - 2, cy - 2, 1, 1);
        ctx.fillRect(cx + 2, cy - 2, 1, 1);
    }
    
    // Helper: Draw compact bullet/ammo icon
    function drawPixelBullet(cx, cy, color) {
        ctx.fillStyle = color;
        // Compact bullet (3x6)
        ctx.fillRect(cx - 1, cy - 3, 3, 6);
        // Rim
        ctx.fillRect(cx - 1, cy + 2, 3, 1);
        // Tip
        ctx.fillStyle = adjustColor(color, -30);
        ctx.fillRect(cx - 1, cy - 3, 3, 2);
    }
    
    // Helper: Draw compact lightning bolt
    function drawPixelLightning(cx, cy, color) {
        ctx.fillStyle = color;
        const bolt = [
            [0,-4],[0,-3],[-1,-2],[0,-2],[0,-1],[0,0],[1,1]
        ];
        bolt.forEach(([px, py]) => {
            ctx.fillRect(cx + px, cy + py, 2, 2);
        });
    }
    
    // Helper: Draw premium progress bar with segments
    function drawMiniBar(x, y, w, h, fillPercent, color, glowColor) {
        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x, y, w, h);
        
        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        
        // Fill with glow
        const fillW = (w - 2) * fillPercent;
        if (fillW > 0) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle = color;
            ctx.fillRect(x + 1, y + 1, fillW, h - 2);
            ctx.shadowBlur = 0;
            
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(x + 1, y + 1, fillW, (h - 2) * 0.35);
            
            // Segment lines (every 20%)
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            for (let i = 1; i < 5; i++) {
                const segX = x + (w - 2) * (i / 5);
                if (segX < x + 1 + fillW) {
                    ctx.fillRect(segX, y + 1, 1, h - 2);
                }
            }
        }
    }
    
    // Helper: Draw compact level badge
    function drawLevelBadge(x, y, level, color, isMax) {
        ctx.fillStyle = color;
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'left';
        if (isMax) {
            ctx.fillStyle = '#ff00ff'; // MAX는 더 화려한 색상
            ctx.fillText(`MAX`, x, y);
        } else {
            ctx.fillText(`${level}`, x, y);
        }
    }

    // Helper: Draw stat value text
    function drawStatValue(x, y, value, unit, color) {
        ctx.fillStyle = color;
        ctx.font = '5px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(value)}${unit}`, x, y);
    }

    // === PLAYER LEVEL PANEL (RANK) - Compact ===
    const playerGlow = LevelSystem.playerLevel > 1 ? '#00ff88' : null;
    drawMiniPanel(startX + 10, statsY - 12, levelPanelW, levelPanelH, '#4a4a2a', '#1a1a0a', playerGlow);
    drawPixelSkull(startX + 18, statsY - 3, '#e0d0a0');
    drawLevelBadge(startX + 28, statsY - 6, LevelSystem.playerLevel, '#FFD700', LevelSystem.playerLevel >= LevelSystem.maxLevel);
    // LV EXP Progress Bar (compact 30px) - 플레이어 레벨 EXP 진행도
    const expPercent = LevelSystem.playerLevel >= LevelSystem.maxLevel ? 1 : Math.min(1, LevelSystem.playerExp / LevelSystem.playerExpToNext);
    drawMiniBar(startX + 28, statsY + 2, 30, 4, expPercent, '#2ecc71', '#00ff88');

    // === ATTACK LEVEL PANEL (DAMAGE) - Compact ===
    const dmgItem = LevelSystem.items.DAMAGE;
    const dmgGlow = dmgItem.level > 1 ? '#ff4444' : null;
    drawMiniPanel(startX + 72, statsY - 12, levelPanelW, levelPanelH, '#4a1a1a', '#1a0a0a', dmgGlow);
    drawPixelBullet(startX + 80, statsY - 3, '#c0c0c0');
    drawLevelBadge(startX + 90, statsY - 6, dmgItem.level, '#FF6666', dmgItem.level >= LevelSystem.itemMaxLevel);
    // Show actual attack stat value
    drawStatValue(startX + 90, statsY + 3, Player.damage, '', '#ff9999');
    // Attack EXP Bar
    const dmgExpPercent = Math.min(1, dmgItem.exp / dmgItem.expToNext);
    drawMiniBar(startX + 90, statsY + 6, 30, 3, dmgExpPercent, '#e74c3c', '#ff6666');

    // === SPEED LEVEL PANEL (FIRE RATE) - Compact ===
    const fireItem = LevelSystem.items.FIRE_RATE;
    const speedGlow = fireItem.level > 1 ? '#4488ff' : null;
    drawMiniPanel(startX + 134, statsY - 12, levelPanelW, levelPanelH, '#1a2a4a', '#0a0a1a', speedGlow);
    drawPixelLightning(startX + 142, statsY - 3, '#66ccff');
    drawLevelBadge(startX + 152, statsY - 6, fireItem.level, '#66aaff', fireItem.level >= LevelSystem.itemMaxLevelFireRate);
    // Show actual fire rate stat value
    drawStatValue(startX + 152, statsY + 3, Player.fireRate, 'ms', '#99ccff');
    // Speed EXP Bar
    const fireExpPercent = Math.min(1, fireItem.exp / fireItem.expToNext);
    drawMiniBar(startX + 152, statsY + 6, 30, 3, fireExpPercent, '#3498db', '#66aaff');

    // === DEFENSE LEVEL PANEL (RESISTANCE) - Compact ===
    const defItem = LevelSystem.items.DEFENSE;
    const defGlow = defItem.level > 0 ? '#95a5a6' : null;
    drawMiniPanel(startX + 196, statsY - 12, levelPanelW, levelPanelH, '#2a2a2a', '#0a0a0a', defGlow);
    // Shield 아이콘 대신 방패 모양 픽셀 아트 (간단히)
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(startX + 204 - 3, statsY - 3 - 4, 6, 8); // 방패 대략적 모양
    drawLevelBadge(startX + 214, statsY - 6, defItem.level, '#bdc3c7', defItem.level >= LevelSystem.itemMaxLevel);
    // 피해 감소율 표시
    const reductionPercent = (defItem.level / LevelSystem.itemMaxLevel) * 75;
    drawStatValue(startX + 214, statsY + 3, reductionPercent, '%', '#bdc3c7');
    // Defense EXP Bar
    const defExpPercent = Math.min(1, defItem.exp / defItem.expToNext);
    drawMiniBar(startX + 214, statsY + 6, 30, 3, defExpPercent, '#7f8c8d', '#95a5a6');

    // 8. Score (right top, outside main panel)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`SCORE:${score.toString().padStart(6, '0')}`, GAME_WIDTH/scale - 15, 20);

    // 9. Stage info (center top)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`STG${currentStage}`, GAME_WIDTH/scale/2, 20);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(`${enemiesKilled}/${getCurrentStageData().goal}`, GAME_WIDTH/scale/2, 35);

    // 10. HUD Bombs (top right - premium pixel art dynamite with metallic rack)
    ctx.save();
    const hudBombStartX = GAME_WIDTH/scale - 75;
    const hudBombY = 45;

    // 프리미엄 메탈릭 홀더 백그라운드 랙 그리기
    ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 1;
    // 최대 5개 폭탄이 안착되는 랙 프레임
    ctx.fillRect(hudBombStartX - 4 * 14 - 8, hudBombY - 4, 5 * 14 + 10, 20);
    ctx.strokeRect(hudBombStartX - 4 * 14 - 8, hudBombY - 4, 5 * 14 + 10, 20);
    
    // 랙 내의 고정 징 디테일 (금속 단추)
    ctx.fillStyle = '#6a6a6a';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(hudBombStartX - i * 14 - 1, hudBombY + 12, 2, 2);
    }

    for (let i = 0; i < Math.min(Player.bombCount, 5); i++) {
        const bx = hudBombStartX - i * 14;
        const by = hudBombY;
        
        // 폭탄 장착 시의 붉은빛 글로우 효과
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff3333';

        // Dynamite stick (정교한 픽셀 도트 질감)
        ctx.fillStyle = '#660000'; // 다크 섀도우
        ctx.fillRect(bx - 4, by, 8, 12);
        
        ctx.fillStyle = '#cc1111'; // 메인 레드 바디
        ctx.fillRect(bx - 3, by + 1, 6, 10);
        
        // 황동 고정링 (밴드) 2줄 추가
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(bx - 4, by + 3, 8, 1.5);
        ctx.fillRect(bx - 4, by + 8, 8, 1.5);

        // 하이라이트 라인
        ctx.fillStyle = '#ffa3a3';
        ctx.fillRect(bx - 2, by + 1, 2, 10);
        
        // 갈색 도트 심지 (정밀 묘사)
        ctx.fillStyle = '#bfa76f';
        ctx.fillRect(bx - 1, by - 3, 2, 3);
        ctx.fillStyle = '#ffcc00'; // 심지 끝 불꽃 스파크
        ctx.fillRect(bx - 1, by - 4, 2, 1);
    }
    ctx.shadowBlur = 0; // 글로우 리셋

    // 5개 초과 시 +N 뱃지 렌더링 (골드 네온 서클)
    if (Player.bombCount > 5) {
        const badgeX = hudBombStartX + 12;
        const badgeY = hudBombY + 6;
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffd700';
        ctx.beginPath();
        ctx.arc(badgeX + 6, badgeY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${Player.bombCount - 5}`, badgeX + 6, badgeY + 1);
    }
    ctx.restore();

    // 10.5. Petal Cannon Charge UI (고급 크리스탈 네온 튜브 및 핑크빛 꽃가루 파티클 효과)
    const petalX = GAME_WIDTH/scale - 75;
    const petalY = 71;
    const petalChargePercent = Math.min(1, Player.petalCannonCharge / Player.petalCannonMaxCharge);
    
    // 꽃잎포 충전 완료 시 벚꽃잎 흩날림 동적 파티클 효과 구현
    if (!window.hudPetalParticles) window.hudPetalParticles = [];
    
    if (Player.petalCannonReady) {
        // 매 프레임 일정 확률로 핑크 파티클 스폰 (HUD 우측 영역)
        if (Math.random() < 0.15) {
            window.hudPetalParticles.push({
                x: petalX + 15 + (Math.random() - 0.5) * 40,
                y: petalY + 10 + (Math.random() - 0.5) * 15,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 1.2 - 0.5,
                size: Math.random() * 3 + 2,
                alpha: 1.0,
                decay: Math.random() * 0.02 + 0.015,
                rot: Math.random() * Math.PI,
                rotSpd: (Math.random() - 0.5) * 0.05
            });
        }
    }
    
    // 꽃가루 파티클 업데이트 및 드로잉
    if (window.hudPetalParticles.length > 0) {
        ctx.save();
        for (let pIdx = window.hudPetalParticles.length - 1; pIdx >= 0; pIdx--) {
            const p = window.hudPetalParticles[pIdx];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            p.rot += p.rotSpd;
            
            if (p.alpha <= 0) {
                window.hudPetalParticles.splice(pIdx, 1);
                continue;
            }
            
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = '#ff69b4';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#ff1493';
            
            // 회전하는 꽃잎 사각형/마름모 드로잉
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.rotate(-p.rot);
            ctx.translate(-p.x, -p.y);
        }
        ctx.restore();
    }
    
    // Petal icon (충전 시 유기적으로 회전하고 펄싱)
    ctx.save();
    ctx.translate(petalX + 15, petalY + 5);
    const petalPulse = Player.petalCannonReady ? 1.0 + Math.sin(time / 150) * 0.15 : 1.0;
    ctx.scale(petalPulse, petalPulse);
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (Player.petalCannonReady) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff1493';
    }
    ctx.fillText('🌸', 0, 0);
    ctx.restore();
    
    // 크리스탈 튜브 게이지 백그라운드 (은은한 메탈릭 테두리 관)
    const tubeW = 54;
    const tubeH = 8;
    const tubeX = petalX - 12;
    const tubeY = petalY + 14;
    
    ctx.fillStyle = 'rgba(10, 5, 8, 0.8)';
    ctx.fillRect(tubeX, tubeY, tubeW, tubeH);
    
    // 3D 벚꽃 핑크빛 네온 그라데이션 충전 게이지 바
    if (petalChargePercent > 0) {
        ctx.save();
        const fillW = (tubeW - 2) * petalChargePercent;
        
        // 네온 발광 효과
        ctx.shadowBlur = Player.petalCannonReady ? 12 : 6;
        ctx.shadowColor = Player.petalCannonReady ? '#ff1493' : '#ff69b4';
        
        const petalGradient = ctx.createLinearGradient(tubeX + 1, tubeY + 1, tubeX + fillW, tubeY + 1);
        if (Player.petalCannonReady) {
            // 충전 완료 시: 찬란히 끓어오르는 핫핑크 네온
            petalGradient.addColorStop(0, '#ff1493');
            petalGradient.addColorStop(0.5, '#ff69b4');
            petalGradient.addColorStop(1, '#ffffff');
        } else {
            // 충전 중: 핑크 에너지가 서서히 차오름
            petalGradient.addColorStop(0, '#9b2c2c');
            petalGradient.addColorStop(0.7, '#ff69b4');
            petalGradient.addColorStop(1, '#ffb6c1');
        }
        
        ctx.fillStyle = petalGradient;
        ctx.fillRect(tubeX + 1, tubeY + 1, fillW, tubeH - 2);
        
        // 게이지 물결 하이라이트 (Wave Reflection)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(tubeX + 1, tubeY + 1, fillW, 2);
        ctx.restore();
    }
    
    // 크리스탈 튜브 테두리 유리광택 광원 반사
    ctx.strokeStyle = Player.petalCannonReady ? '#ff1493' : '#555';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tubeX, tubeY, tubeW, tubeH);
    // 유리관 하이라이트 선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tubeX + 1, tubeY + 1.5);
    ctx.lineTo(tubeX + tubeW - 1, tubeY + 1.5);
    ctx.stroke();
    
    // READY (발사대기) 네온 글리치 텍스트 표시
    if (Player.petalCannonReady) {
        ctx.save();
        ctx.fillStyle = '#ff1493';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff69b4';
        ctx.font = 'bold 6px "Press Start 2P"';
        ctx.textAlign = 'center';
        
        // 플리커링 인디케이터
        const flicker = Math.sin(time / 100) > 0;
        if (flicker) {
            ctx.fillStyle = '#ffffff';
        }
        ctx.fillText('READY', tubeX + tubeW / 2, tubeY + 18);
        ctx.restore();
    }

    ctx.restore();

    // 11. Bomb Button (bottom right - original style)
    drawBombButton(ctx);
    
    // 12. Petal Cannon Button (bottom right, left of bomb button)
    drawPetalCannonButton(ctx);
}

const MOBILE_OPTIMIZED_CLASS = 'mobile-optimized';
let deferredInstallPrompt = null;
let animationId = null;

// 패스워드 및 스테이지 언락 상태
const STAGE_PASSWORD = '910902'; // 연이의 생년월일
let isStageUnlocked = false; // 패스워드 입력 성공 여부
let isGodMode = false; // 비밀번호 입력 시 활성화되는 무적 모드 (라이프 감소 없음)
let isBombUnlimited = false; // 패스워드 입력 시 폭탄 무제한 모드

// --- 1. 에셋 및 전역 상태 설정 ---

const ASSETS = {
    player: 'asset/꽃돼지 총.png',
    bullet: '',
    enemy: 'asset/청토끼.png',
    enemy2: 'asset/청토끼 2.png',
    enemy3: 'asset/청토끼 3.png',
    boss: 'asset/청토끼 보스.png',
    boss2: 'asset/청토끼 보스2.png',
    bossKing: 'asset/청토끼 킹.png',
    win: 'asset/꽃돼지 승리.png',
    gameover: 'asset/게임오버.png',
    gameClear: 'asset/게임 클리어.jpg',
    title: 'asset/꽃돼지 the killer of zombie.png',
    bgm: 'asset/freepik-silent-ops.mp3',
    epilogueBGM: 'asset/Pixels_in_Bloom.mp3',
    bg1: 'asset/bg_stage1_1776859252407.png',
    bg3: 'asset/bg_stage3_1776859290142.png',
    bg5: 'asset/bg_stage5_1776859700265.png',
    bg7: 'asset/bg_stage7_1776859783868.png',
    bg9: 'asset/bg_stage9_1776859795988.png',
    gate: ''
};

const GAME_STATE = { START: 'START', STORY: 'STORY', PLAYING: 'PLAYING', STAGE_CLEAR: 'STAGE_CLEAR', BOSS_FIGHT: 'BOSS_FIGHT', GAME_OVER: 'GAME_OVER', EPILOGUE: 'EPILOGUE', GAME_CLEAR_IMAGE: 'GAME_CLEAR_IMAGE', WIN: 'WIN', ALL_CLEAR: 'ALL_CLEAR' };
let currentState = GAME_STATE.START;

// --- 1-1. 스테이지 및 보스 설정 ---
const STAGE_DATA = {
    1: { goal: 20, enemySpeed: 2.0, spawnRate: 2800, homing: false, sky: '#050a14', city: '#0a1220', fog: '#0f172a', storyText: "■■■■ EPISODE 1: LAST DAWN ■■■■\n\n세계는 21일 전, 그 누구도 예상치 못한 방식으로 처참하게 무너져 내렸다.\n\n평화로웠던 네온 시티는 이제 핏빛 침묵만이 맴도는 거대한 무덤이다. 한때 화려한 홀로그램 광고판이 밤하늘을 수놓고, 사람들의 웃음소리와 경적 소리로 가득했던 거리는 잿빛 안개와 썩어가는 시취로 덮여 있다. 재앙의 이름은 '청토끼 바이러스'. 감염 경로는 불분명했다. 공기 중으로 퍼졌는지, 식수를 통해 오염되었는지 알 수 없으나, 감염자들은 끔찍한 고통 속에서 탐욕에 이성을 잃고 흉측한 푸른 털이 돋아나는 괴물로 변이했다. 그들의 온몸에서는 검붉은 핏물이 뚝뚝 흘러내렸고, 관절은 기괴한 각도로 꺾였으며, 턱은 사람의 살점을 뜯어내기 위해 비정상적으로 발달했다. 인간성은 완전히 거세되었고, 오직 끝없는 굶주림과 살육을 향한 갈망만이 남은 변이체들은 도시를 휩쓸며 모든 생명을 집어삼켰다.\n\n이 숨 막히는 지옥의 한가운데, 분홍빛 피부에 연꽃 머리핀을 단 용감한 전사 '연이'가 서 있다. 그녀는 꽃돼지 일족의 마지막 생존자다. 과거 연이의 일족은 자연과 조화롭게 살아가며 온화한 성품을 지닌 수인(獸人)들이었으나, 청토끼 무리의 무차별적인 습격으로 하루아침에 멸족의 위기를 맞았다. 가족과 친구들이 끔찍하게 찢겨 죽어가는 모습을 무력하게 지켜봐야 했던 연이의 내면은 산산조각 났지만, 그 틈새로 차가운 분노와 복수심이 자리 잡았다. 그녀의 굳은살 박인 손에는 죽은 동료가 남긴 낡고 무거운 12게이지 펌프 액션 산탄총이 쥐어져 있다. 총열에는 그동안 쓰러뜨린 변이체들의 숫자를 의미하는 수많은 흠집이 새겨져 있고, 개머리판은 핏자국으로 검게 변색되어 있었다.\n\n오늘은 연이가 은신처를 떠나 도시 외곽을 가로지르는 첫날이다. 먹구름이 낀 밤하늘은 짙은 남색빛을 띠고 있고, 스멀스멀 피어오르는 안개가 시야를 가린다. 부서진 아스팔트 위로 차가운 바람이 불어올 때마다, 기분 나쁜 쇳소리와 함께 놈들의 숨소리가 들려온다.\n\n'숨소리... 굶주림의 악취. 또 시작이군.'\n\n연이는 총을 손질하며, 천천히 숨을 골랐다. 그녀의 분홍빛 귀가 미세한 소리까지 감지하며 쫑긋거렸다. 전방 30미터, 버려진 스쿨버스 뒤에서 푸른 안광 두 개가 번쩍였다. 이어서 사방에서 기괴한 울음소리가 메아리치며 십여 마리의 청토끼들이 모습을 드러냈다. 놈들은 날카로운 발톱을 아스팔트에 긁으며 짐승처럼 네 발로 기어 오다가, 연이를 발견하고는 기괴하게 두 발로 일어서서 달려들기 시작했다. 끔찍한 고통 속에서 탐욕에 이성을 잃고 흉측한 푸른 털이 돋아나는 괴물로 변이했다. 그들의 온몸에서는 검붉은 핏물이 뚝뚝 흘러내렸고, 관절은 기괴한 각도로 꺾였으며, 턱은 사람의 살점을 뜯어내기 위해 비정상적으로 발달했다. 인간성은 완전히 거세되었고, 오직 끝없는 굶주림과 살육을 향한 갈망만이 남은 변이체들은 도시를 휩쓸며 모든 생명을 집어삼켰다.\n\n하지만 연이의 눈동자에는 일말의 공포도 없었다. 오직 얼음처럼 차가운 살의뿐. 그녀는 기계적인 동작으로 산탄총의 펌프를 당겼다. 철컥- 하는 둔탁하고도 경쾌한 금속음이 적막을 갈랐다.\n\n'오라. 내 탄환이 너희의 그 끔찍한 갈망에 자비로운 안식을 줄 테니.'\n\n첫 번째 놈이 도약하는 순간, 연이의 손가락이 방아쇠를 당겼다. 쾅! 하는 굉음과 함께 총구에서 뿜어져 나온 화염이 짙은 어둠을 찢었다. 수십 개의 산탄이 허공을 가르며 날아가 가장 앞장선 청토끼의 상반신을 그대로 분쇄해버렸다. 피보라가 튀고 검은 점액질이 흩뿌려지는 가운데, 연이는 지체 없이 다음 탄을 약실에 밀어 넣었다. 그녀의 길고 처절한 생존 게임, 그리고 세상을 구원하기 위한 핏빛 복수극의 막이 오르는 순간이었다." },
    2: { goal: 30, enemySpeed: 2.3, spawnRate: 2500, homing: false, enemyShoot: true, sky: '#0a0a14', city: '#161625', fog: '#1e1e2e', storyText: "■■■■ EPISODE 2: NEON GRAVEYARD ■■■■\n\n도시의 외곽을 돌파한 연이는 썩어가는 시체 냄새가 매캐한 독기처럼 피어오르는 네온 시티의 중심부로 발걸음을 옮겼다. 한때 이 거리는 화려한 클럽과 고급 레스토랑, 그리고 트렌드를 선도하는 쇼핑몰이 밀집해 있던 욕망의 용광로였다. 하지만 지금은 그 모든 것이 잿더미로 변했고, 부서진 간판과 깜빡이는 네온사인만이 유령처럼 거리를 지키고 있었다. 붉고 푸른 네온 불빛이 웅덩이에 고인 검은 피에 반사되어 기괴한 분위기를 자아냈다. 안개는 점점 더 짙어지고, 거리에 널브러진 시체 더미 위로는 파리 떼마저 자취를 감췄다. 생명이라고는 오직 연이와, 그녀의 목숨을 노리는 변이체들뿐이었다.\n\n건물 사이의 좁은 골목길을 지날 때였다. 연이의 발밑에서 바스락거리는 소리가 났다. 탄피였다. 그것도 최근에 발사된 듯 화약 냄새가 희미하게 남아있는 5.56mm 소총 탄피. 생존자가 있는 것일까? 그녀가 주위를 경계하며 몸을 숨기려는 찰나, 어둠 속에서 번쩍하는 섬광과 함께 총성이 울렸다. 타앙-! 총알이 연이의 귓가를 스치며 뒤편의 콘크리트 벽에 박혔다. 단순한 포식자가 아니다. 청토끼 바이러스는 감염자의 지능을 완전히 퇴화시키는 것으로 알려져 있었지만, 눈앞의 놈들은 달랐다. 생전에 군인이나 경찰이었던 감염자들 중 일부가 근육에 각인된 기억을 바탕으로 총기를 다루기 시작한 것이다. 총을 쥔 변이체라니, 악몽이 더욱 깊어지고 있었다.\n\n연이는 반사적으로 몸을 날려 박살 난 편의점 진열대 뒤로 굴러 들어갔다. 빗발치는 총탄이 진열대를 박살 내고 과자 부스러기와 유리 파편이 눈처럼 흩날렸다. 거친 숨을 내쉬며 고개를 숙인 연이의 눈앞에 깨진 거울 조각이 보였다. 흙먼지와 핏자국을 뒤집어쓴 자신의 얼굴. 한때 곱게 빗어 넘겼던 분홍빛 털은 엉망으로 엉켜 있었고, 연꽃 머리핀은 그을음으로 얼룩져 있었다. 평화롭던 시절, 친구들과 웃으며 솜사탕을 나눠 먹던 소녀의 모습은 온데간데없었다. 거울 속의 자신을 응시하며, 연이는 스스로에게 물었다.\n\n'왜 나만 살아남은 걸까? 이 지옥에서 언제까지 버틸 수 있을까?'\n\n하지만 나약한 생각은 사치였다. 살아남기 위해 죽인다. 죽이기 위해 살아남는다. 이 잔혹한 순환의 고리를 끊어낼 방법은 오직 전진뿐이었다.\n\n'끼에에엑-!'\n\n총소리가 멈추고, 탄창을 갈아 끼우는 듯한 절그럭거리는 소리와 함께 변이체 특유의 찢어지는 비명이 들려왔다. 놈들이 거리를 좁히며 다가오고 있었다. 연이는 산탄총의 총열에 남은 탄환 수를 가늠했다. 네 발. 다수를 상대하기엔 턱없이 부족한 화력이지만, 그녀에겐 짐승의 본능과도 같은 뛰어난 반사 신경이 있었다. 연이는 품속에서 연막탄 하나를 꺼내 안전핀을 뽑아 입구 쪽으로 던졌다. 치이익- 소리와 함께 하얀 연기가 편의점 안을 가득 채웠다. 시야가 차단되자 놈들이 당황하며 총을 난사하기 시작했다. 그 혼란의 틈을 타, 연이는 진열대 위로 도약했다.\n\n공중으로 날아오른 연이의 시야에 소총을 들고 우왕좌왕하는 세 마리의 변이체가 들어왔다. 그녀는 망설임 없이 방아쇠를 두 번 연속으로 당겼다. 쾅! 쾅! 엄청난 반동이 어깨를 강타했지만, 두 마리의 적이 그대로 고기동이가 되어 바닥에 처박혔다. 착지와 동시에 마지막 한 마리가 소총을 들어 올리려 했지만, 연이가 더 빨랐다. 그녀는 총열로 놈의 턱을 걷어올려 자세를 무너뜨린 뒤, 영거리에서 마지막 탄환을 박아 넣었다. 피비린내가 진동하는 편의점 안, 정적이 찾아왔다. 연이는 바닥에 떨어진 놈의 소총과 탄창을 주워 챙겼다.\n\n'좋아. 무기가 하나 더 늘었군. 지옥의 한가운데를 뚫고 갈 준비는 끝이다.' 그녀는 다시 짙은 어둠이 깔린 네온의 무덤 속으로 걸음을 옮겼다." },
    3: { goal: 40, enemySpeed: 2.6, spawnRate: 2200, homing: true, homingSpeed: 0.3, enemyShoot: true, sky: '#0f0f0f', city: '#1a1a1a', fog: '#262626', storyText: "■■■■ EPISODE 3: POISON MIST ■■■■\n\n호텔 지구로 접어들자, 안개는 단순한 시야 차단을 넘어 치명적인 위협으로 변모했다. 짙은 녹색 빛을 띠는 이 독성 안개는 숨을 들이마실 때마다 폐부를 날카로운 유리 조각으로 긁어내는 듯한 극심한 고통을 동반했다. 피부에 닿으면 화끈거리며 발진이 일어났고, 눈은 시려서 제대로 뜨기조차 힘들었다. 방독면조차 구하지 못한 연이에게 이 구역은 그야말로 숨 막히는 사지(死地)였다. 옷소매를 찢어 코와 입을 단단히 동여맸지만, 독기는 천을 뚫고 무자비하게 파고들었다. 한때 화려한 샹들리에와 대리석 바닥을 자랑했던 최고급 호텔들은 이제 검게 그을린 뼈대만 남아, 변이체들의 거대한 소굴로 전락해 있었다.\n\n이 독성 안개 속에서 청토끼 변이체들은 새로운 형태로 진화하고 있었다. 시야가 제한된 환경에 적응한 놈들은 시각 대신 후각과 열 감지 능력을 기형적으로 발달시켰다. 안개 너머에서 푸른 안광들이 기괴한 궤적을 그리며 좁혀오기 시작했다. 놈들은 이제 무작정 달려들지 않았다. 연이의 체온과 숨결, 심장 박동 소리까지 집요하게 추적하며 사방에서 포위망을 좁혀오고 있었다. 바닥에 깔린 잔해들을 피해 소리 없이 이동하는 놈들의 모습은 마치 어둠 속의 유령 같았다.\n\n'이 안개... 놈들의 진화를 촉진하는 매개체인가?'\n\n기침을 삼키며 쓰러진 군용 장갑차의 차가운 장갑에 몸을 기댄 연이가 생각했다. 재앙의 근원은 도대체 어디인가. 누가, 혹은 무엇이 이토록 끔찍한 바이러스를 퍼뜨려 세상을 이 지경으로 만들었단 말인가. 우연한 자연 발생이라고 보기엔 이 바이러스의 변이 속도와 파괴력은 너무나도 치밀하고 악의적이었다. 장갑차 내부에 널브러진 백골 시체들이 눈에 띄었다. 최신식 장비로 무장했던 정규군마저 이 무자비한 괴물들의 파도 앞에서는 속수무책으로 쓸려나갔다는 뼈아픈 증거였다.\n\n연이는 떨리는 손으로 전술 조끼의 파우치를 뒤졌다. 남은 산탄은 서른 발, 편의점에서 노획한 소총 탄창 두 개가 전부였다. 뒤로 물러설 곳은 없다. 안개 속에서 놈들의 기괴한 뼈마디 꺾이는 소리와 낮게 으르렁거리는 소리가 환청처럼 귓가를 맴돌았다. 놈들은 점점 더 다가오고 있었고, 독가스 때문에 연이의 체력은 분 단위로 깎여나가고 있었다. 이곳에서 방어전에 돌입했다간 탄약이 떨어지기 전에 질식으로 먼저 쓰러질 것이 뻔했다. 돌파해야 한다. 수적 열세를 뒤집고 이 함정을 빠져나갈 유일한 방법은 기선을 제압하는 압도적인 공격뿐이다.\n\n'날 찾아냈다고 기뻐하지 마라. 독 안에 든 쥐는 내가 아니라 너희니까.'\n\n연이는 장갑차의 해치를 딛고 훌쩍 뛰어올라 차량의 지붕 위에 섰다. 시야가 조금 트이자, 자신을 향해 기어오는 수십 마리의 변이체들이 만들어내는 푸른 안광의 바다가 펼쳐졌다. 그녀는 산탄총을 등에 메고 노획한 소총을 단단히 파지했다. 조준경 너머로 가장 거대하고 흉측하게 변이된, 무리를 이끄는 듯한 놈의 머리가 들어왔다. 연이는 숨을 멈추고 방아쇠를 당겼다. 타타탕! 세 발의 점사가 정확히 놈의 미간에 꽂히며 뇌수를 흩뿌렸다. 우두머리가 쓰러지자 무리가 일순간 동요했고, 그 틈을 타 연이는 장갑차 위에서 도약하며 허공에서 총탄을 쏟아부었다. 죽음의 무도가 다시 한번 펼쳐지고 있었다." },
    4: { goal: 50, enemySpeed: 2.9, spawnRate: 2000, homing: true, homingSpeed: 0.5, enemyShoot: true, sky: '#0a0d14', city: '#141a26', fog: '#1e293b', storyText: "■■■■ EPISODE 4: SHADOWS IN THE RUINS ■■■■\n\n목이 타들어가는 듯한 독성 안개 지대를 간신히 벗어난 연이는, 하늘조차 보이지 않을 정도로 거대한 콘크리트 잔해들이 얽혀 있는 구시가지의 폐허 속으로 발을 들였다. 밤하늘은 칠흑처럼 짙은 남색으로 물들었고, 도시의 그림자는 모든 빛을 탐욕스럽게 빨아들이고 있었다. 이곳은 지진이라도 일어난 것처럼 붕괴된 고층 빌딩들이 서로 아슬아슬하게 기대어 거대한 협곡을 이루고 있었다. 무너진 잔해 사이로 스며드는 차가운 바람은 마치 죽은 자들의 흐느남처럼 기괴한 소리를 냈다.\n\n밤이 깊어질수록 청토끼 변이체들의 움직임은 소름 끼치도록 빠르고 교활해졌다. 초기 감염자들의 맹목적인 돌진과는 차원이 달랐다. 놈들은 이제 무너진 벽의 틈새나 부서진 차량 밑그림자 속에 완벽하게 동화되어 먹잇감을 기다렸다. 연이가 폐허의 중앙로에 진입하자, 등 뒤의 콘크리트 조각이 떨어져 내리는 소리가 들렸다. 반사적으로 뒤를 돌아본 순간, 위쪽 잔해에서 세 마리의 변이체가 동시에 뛰어내렸다. 그녀는 땅을 구르며 쌍권총을 뽑아 들고 허공을 향해 미친 듯이 난사했다. 놈들의 전술은 명백히 '사냥'이었다. 미끼를 던져 시선을 분산시키고, 사각지대에서 떼를 지어 덮쳐오는 늑대 무리의 방식과 흡사했다. 변이체들이 짐승의 본능을 넘어 지능적인 집단 전투를 수행하기 시작했다다는 사실은 연이의 등골을 오싹하게 만들었다.\n\n치열한 교전 끝에 놈들을 물리친 연이는 거친 숨을 몰아쉬며 근처의 반파된 경찰서 내부로 몸을 피했다. 철창이 휘어지고 피비린내가 진동하는 유치장 안쪽, 경찰서장의 집무실로 추정되는 곳에서 그녀는 쓸만한 탄약과 구급상자, 그리고 핏자국이 선명한 일기장 하나를 발견했다. 플래시라이트를 켜고 먼지 쌓인 페이지를 넘기던 연이의 시선이 한 구절에 멈췄다.\n\n'[10월 14일]...폭동이 아니다. 이건 재앙이다. 감염자와 접촉한 대원들이 3시간도 채 되지 않아 똑같은 괴물로 변했다. 통증, 발열, 그리고 이성을 잃는 환각 증세... 예방 백신도, 치료제도 없다. 방어선은 무너졌다. 본부의 지원은 오지 않는다. \n\n우리는 완전히 버림받았다...'\n\n절망과 공포가 고스란히 배어있는 마지막 문장을 끝으로 일기장은 피로 덮여 있었다. 연이는 일기장을 조용히 덮고 가죽 코트 안주머니에 집어넣었다. 구조대는 오지 않는다. 국가는 멸망했다. 남은 것은 오직 스스로의 목숨을 건 처절한 생존과, 이 사태를 초래한 원흉을 향한 피비린내 하는 복수뿐이다. 창밖을 내다보니 저 멀리 폐허의 지평선 너머로 핏빛 저녁 노을이 지고 있었다. 세상의 끝을 알리는 듯한 비극적이고도 처연한 아름다움. 하지만 감상에 젖을 시간은 없었다. 어둠이 완전히 깔리면, 호밍 능력이 극대화된 변이체들의 본격적인 사냥이 시작될 것이다.\n\n'살려주세요! 거기 누구 없어요?!'\n\n그때, 적막을 찢고 날카로운 비명 소리가 들려왔다. 폐허 깊숙한 곳에서 울려 퍼지는 앳된 인간의 목소리. 아직 살아남은 생존자가 있는 것일까? 아니면 영악해진 변이체들이 인간의 목소리를 흉내 내어 파놓은 악랄한 함정일까? 연이는 쌍권총의 슬라이드를 찰칵 소리 나게 당기며 탄환을 장전했다. 어느 쪽이든 상관없었다. 그녀는 지금 다른 생명을 구할 여유 따윈 없었지만, 앞길을 가로막는 모든 것을 파괴할 준비가 되어 있었다. 밤의 그림자가 경찰서의 타일을 길게 물들였다.\n\n'시간이 없다. 지옥의 아가리 속으로 들어가주마.' 연이는 어둠 속으로 몸을 던졌다." },
    5: { goal: 60, enemySpeed: 3.2, spawnRate: 1800, homing: true, homingSpeed: 0.7, enemyShoot: true, sky: '#14051a', city: '#1f0a28', fog: '#2d1a3a', storyText: "■■■■ EPISODE 5: THE FALLEN PARADISE ■■■■\n\n네온 불빛조차 완전히 사멸해 버린 도시의 심장부. 한때 사람들의 환호성과 찬란한 조명으로 밤을 지새우던 거대한 상업 지구는 이제 상상조차 하기 싫은 거대한 도살장이 되어 있었다. 깨진 통유리창 너머로 보이는 명품 매장에는 마네킹 대신 사지가 절단된 시체들이 널브러져 있었고, 뼈대만 남은 채 불타오르는 고급 승용차들 사이로는 썩은 살점과 핏물이 섞인 진흙탕이 강물처럼 흐르고 있었다. 이곳이 불과 한 달 전까지만 해도 연이가 친구들과 주말마다 쇼핑을 즐기며 솜사탕을 나눠 먹던 천국이었다는 사실이 끔찍한 이질감으로 다가왔다.\n\n연이는 광장 한가운데 위치한 거대한 대리석 분수대 위로 무거운 몸을 이끌고 올라갔다. 조각상에서 뿜어져 나와야 할 맑은 물 대신, 하수구에서 역류한 검붉은 핏물만이 분수대를 가득 채우고 있었다. 며칠간 제대로 된 수분을 섭취하지 못한 그녀는 극도의 탈수 증세에 시달리고 있었다. 시야가 핑 도는 현기증 속에서도, 그녀는 수통을 꺼내 필터를 달고 오염된 흙탕물을 정수해 억지로 목구멍으로 넘겼다. 진흙의 텁텁함과 피의 비릿함이 혀끝을 맴돌았지만, 생존을 위해서는 이 구역질 나는 액체라도 마셔야만 했다.\n\n'도대체 무엇이... 우리의 천국을 이렇게 짓밟았는가.'\n\n연이의 시선은 핏빛 안개 너머, 상업 지구 한가운데 우뚝 솟아 있는 거대한 구조물을 향했다. 모든 재앙의 첫 발원지이자, 이 도시를 통제하던 권력의 상징인 '중앙 방송국' 타워였다. 저 높은 곳에 가면, 이 미쳐버린 세상의 진실을, 피도 눈물도 없이 자신의 가족을 도륙한 원흉의 정체를 알아낼 수 있을지도 모른다. 하지만 그곳으로 가는 길은 그야말로 변이체들의 바다였다. 한 걸음 내디딜 때마다 수십 마리의 적이 쏟아져 나오는 사지 중의 사지.\n\n그때, 적막을 깨고 허리춤에 차고 있던 무전기에서 기계적인 파열음이 튀어나왔다.\n\n치지직- 삑- '여...기... 구조... 누구... 살아있나... 들리...면 응답...'\n\n환청이 아니었다. 죽음의 도시에서 들려온, 너무나도 명료한 인간의 목소리. 연이는 수통을 팽개치고 다급하게 무전기를 움켜쥐어 주파수를 맞췄다. '여기 생존자 있다! 내 말 들리나? 꽃돼지 일족의 생존자 연이다! 당신의 위치를 말해라!'\n\n숨 막히는 몇 초의 침묵. 오직 전파의 잡음만이 무전기를 채웠다. 상대방은 대답하지 않았다. 전력이 끊긴 것일까, 아니면 송신 직후 변이체들에게 당한 것일까. 불길한 상상들이 머릿속을 맴돌았지만, 연이의 가슴속에는 이미 작지만 강렬한 희망의 불씨가 타오르고 있었다. 이 지옥 어딘가에 자신 말고도 숨 쉬며 싸우고 있는 동료가 있다. 그 사실 하나만으로도 부러질 것 같던 두 다리에 다시금 짐승 같은 힘이 솟구쳤다.\n\n'그래, 살아만 있어라. 내가 반드시 찾아낼 테니까.'\n\n연이는 산탄총을 굳게 쥐고 분수대에서 뛰어내렸다. 방송국 타워 꼭대기에서 뿜어져 나오는 붉은 항공 장애등이 마치 악마의 눈동자처럼 그녀를 내려다보고 있었다. 놈들의 끈질긴 추적과 사방에서 날아오는 적들의 총탄 속을 뚫고, 연이는 광기의 소용돌이 중심부를 향해 전진을 시작했다." },
    6: { goal: 65, enemySpeed: 3.2, spawnRate: 1700, homing: true, homingSpeed: 0.8, enemyShoot: true, sky: '#1a0505', city: '#2a0a0a', fog: '#3a1a1a', storyText: "■■■■ EPISODE 6: RIVER OF DESPAIR ■■■■\n\n도심을 가로지르는 거대한 한강은 이제 생명의 젖줄이 아닌, 죽음과 절망을 토해내는 '절망의 강'으로 변해 있었다. 한때 시민들의 휴식처였던 둔치는 알아볼 수 없을 정도로 훼손되었고, 맑았던 강물은 화학 폐기물과 변이체들의 썩은 체액이 뒤섞여 끈적하고 검은 점액질로 변질되었다. 이 오염된 강물은 살갗에 한 방울만 튀어도 살을 파고드는 듯한 타는 고통을 안겨주었고, 수면 위로는 형체를 알 수 없는 물고기들의 사체가 끝없이 떠밀려오고 있었다. 핏빛 하늘이 강물에 반사되어, 마치 강 전체가 펄펄 끓어오르는 용암처럼 보였다.\n\n연이는 오염된 강물을 피해 강변의 콘크리트 제방을 따라 조심스럽게 발걸음을 옮겼다. 며칠 째 온몸에 뒤집어쓴 피와 오물, 화약 찌꺼기를 씻어내고 싶었지만, 이 강물에 손을 담그는 것은 자살 행위나 다름없었다. 대신 그녀는 새벽의 차가운 공기 속에 맺힌 이슬과 습기를 입술로 핥으며 극심한 갈증을 달랬다.\n\n'단순한 바이러스의 유출이 아니야... 이 지독한 오염과 놈들의 조직적인 움직임.'\n\n강변의 참상을 바라보며 연이의 머릿속에 날카로운 의구심이 꽂혔다. 바이러스가 자연적으로 발생했다면 도시의 생태계가 이토록 철저하고 완벽하게 파괴될 수는 없었다. 상류의 대규모 공업 단지에서 고의로 방류한 치명적인 생물학적 폐수이거나, 특정한 목적을 가지고 설계된 군사 목적의 생물학 테러가 분명했다.\n\n그녀의 생각이 꼬리를 물 때쯤, 강 건너편의 짙은 피안개 속에서 거대한 산맥 같은 그림자가 꿈틀거렸다. 쿵-! 쿵-! 땅을 울리는 육중한 진동과 함께 안개가 걷히며 드러난 존재는 연이의 상상을 초월했다. 수십 마리의 청토끼들이 융합되어 만들어진 듯한, 빌딩 3층 높이의 거대한 살덩어리. 놈의 몸에는 무수한 팔과 다리가 튀어나와 있었고, 악어처럼 벌어진 입에서는 맹독성의 산성액이 뚝뚝 떨어지고 있었다. 일반적인 변이체들을 통솔하는, 이 구역의 지배자이자 '보스'급 변이체였다.\n\n본능적인 한기와 압도적인 공포가 척추를 타고 흘렀다. 당장이라도 저 괴물이 강을 건너올 것 같아 연이는 콘크리트 방벽 뒤에 몸을 숨기고 숨을 죽였다. 다행히 놈은 아직 연이의 존재를 눈치채지 못한 채, 느릿한 걸음으로 안개 속으로 사라졌다. 하지만 놈과 마주칠 피할 수 없는 전투의 날이 머지않았음을 연이는 직감했다.\n\n중앙 방송국으로 향하기 위해서는 강을 건너야만 했다. 연이의 눈앞에 반쯤 무너져 내려 위태롭게 철골만 앙상하게 남은 대교가 보였다. 발을 헛디디면 그대로 죽음의 강으로 추락할 아찔한 지름길. 하지만 우회할 시간은 없었다. 놈들의 출현 빈도는 한계에 달했고, 이동 속도는 그녀의 달리기 속도를 위협할 정도로 빨라졌다.\n\n'조심스럽게, 하지만 망설임 없이.'\n\n연이는 허리춤의 로프를 점검하고 부서진 철골 위로 첫 발을 내디뎠다. 강풍이 불 때마다 철교가 구슬프게 비명을 질렀고, 다리 위에는 이미 연이의 체취를 맡고 몰려든 변이체들이 흉측한 이빨을 드러내며 그녀를 기다리고 있었다. 연이는 산탄총의 장전 손잡이를 당겼다. 살기 위해 죽이는, 피로 얼룩진 춤이 강물 위에서 다시 시작되려 하고 있었다." },
    7: { goal: 75, enemySpeed: 3.4, spawnRate: 1500, homing: true, homingSpeed: 0.9, enemyShoot: true, sky: '#02040a', city: '#0a0e1a', fog: '#101a2a', storyText: "■■■■ EPISODE 7: ABYSS ENTRANCE ■■■■\n\n절망의 강을 넘어 마침내 도달한 곳, 네온 시티의 한가운데 우뚝 솟은 50층짜리 거대한 마천루 '중앙 방송국'. 이곳은 권력과 진실이 독점되던 곳이자, 재앙의 근원으로 지목받는 심연의 입구였다. 타워의 외관은 참혹했다. 하늘을 찌르던 위용은 온데간데없고, 모든 유리창은 폭격이라도 맞은 듯 산산조각 나 있었다. 건물 외벽은 변이체들이 토해낸 끈적한 검은 슬라임과 정체불명의 촉수들로 흉측하게 뒤덮여, 마치 건물 전체가 살아 숨 쉬는 거대한 유기체처럼 보였다. 1층 메인 로비에 들어서자마자 코를 찌르는 농밀한 피 냄새와 부패한 악취가 연이의 후각을 마비시켰다.\n\n로비의 대리석 바닥은 피로 붉게 코팅되어 있었고, 그 위에는 중무장한 전술 타격대와 특수 경비원들의 시체가 산을 이루고 있었다. 텅 빈 탄창들, 박살 난 방패, 그리고 변이체와 동귀어진하며 수류탄의 안전핀을 움켜쥔 채 굳어버린 손. 그들은 인류의 마지막 저지선을 지키기 위해 최후의 총알 한 발까지 소진하며 장렬하게 산화했다. 연이는 쓰러진 이름 모를 전사들의 눈을 감겨주며, 그들이 남긴 탄약과 수류탄을 전술 조끼에 욱여넣었다. 엘리베이터의 케이블은 이미 다 끊어져 지하로 추락한 지 오래였다. 남은 길은 오직 하나, 50층 꼭대기까지 이어지는 끝없는 비상계단뿐이었다.\n\n'50층을 걸어서 올라가라니... 지옥의 에스컬레이터가 따로 없군.'\n\n자조적인 실소를 터뜨리며 연이는 방화문을 열고 계단실로 진입했다. 2층에 도달하자마자, 밖에서 겪었던 전투는 어린아이 장난에 불과했다는 사실을 깨달았다. 이 건물 내부는 변이체들의 거대한 둥지, 즉 인큐베이터였다. 층을 올라갈수록 계단은 놈들이 분비한 유기물로 질척거렸고, 천장과 벽면에는 알 수 없는 고치들이 주렁주렁 매달려 박동하고 있었다. 왜 그토록 많은 괴물들이 이곳으로 모여들었는가? 무언가가 그들을 이 심연의 중심으로 강력하게 끌어당기고 있음이 틀림없었다.\n\n전투는 처절하고도 끔찍하게 전개되었다. 좁고 가파른 계단에서 위에서 쏟아져 내리는 적들을 상대로 한 수직 전투. 연이는 산탄총을 쏘고, 탄약이 떨어지면 소총을 연사하고, 그마저도 장전할 틈이 없으면 개머리판으로 놈들의 두개골을 함몰시켰다. 좁은 공간에서 적들이 난사하는 총탄은 치명적이었다. 15층을 통과할 무렵, 벽을 타고 내려오던 변이체의 날카로운 발톱이 연이의 왼쪽 어깨를 깊게 찢고 지나갔다.\n\n'크윽...!'\n\n비명이 터져 나오려는 것을 악물고, 연이는 권총을 뽑아 놈의 미간에 영거리 사격을 가했다. 뜨거운 피가 유니폼을 적시며 흘러내렸다. 상처는 깊었지만, 뼈를 다치진 않았다. 구급용 지혈대를 꺼내 상처 부위를 사정없이 묶고, 진통제 두 알을 입에 털어 넣고 우적우적 씹어 삼켰다. 아드레날린과 고통이 뒤섞여 심장이 터질 듯이 요동쳤다.\n\n'아직은 괜찮아... 내 두 다리가 움직이는 한, 이깟 상처 따위...'\n\n연이는 피 묻은 전투화로 다음 계단을 힘차게 밟았다. 그녀의 분홍빛 눈동자는 짐승의 살기보다 더욱 형형하게 빛나고 있었다. '기다려라. 지옥의 꼭대기에 숨어있는 쥐새끼. 내가 그 목통을 뜯으러 갈 테니까.' 위층을 향한 연이의 처절한 등반은 계속되었다." },
    8: { goal: 80, enemySpeed: 3.6, spawnRate: 1400, homing: true, homingSpeed: 1.0, enemyShoot: true, sky: '#0a0908', city: '#141210', fog: '#1a1816', storyText: "■■■■ EPISODE 8: HALLUCINATION ■■■■\n\n어느덧 25층. 거대한 타워의 중간 지점에 도달했을 무렵, 주변의 공기가 기괴하게 뒤틀리기 시작했다. 물리적인 압박감이 아니라, 뇌수를 직접 쥐어짜는 듯한 기분 나쁜 파동이었다. 안개는 이제 시야를 가리는 것을 넘어 신경계로 침투하고 있었다. 갑자기 연이의 귓가에 익숙하고도 다정한 목소리들이 속삭이기 시작했다.\n\n'연이야... 우리 예쁜 연이. 이제 그 무거운 총은 내려놓고 이리 오렴.'\n'언니! 나 여기서 기다리고 있어. 우리 같이 연꽃 마을로 돌아가자!'\n\n과거 청토끼들의 습격으로 잔혹하게 찢겨 죽은 어머니와 동생의 생생한 목소리. 눈앞의 핏빛 계단은 순간적으로 햇살이 내리쬐는 평화로운 고향의 들판으로 변했고, 그 한가운데서 피투성이가 된 가족들이 환하게 웃으며 그녀에게 손을 짓고 있었다. 환각이다. 능력이 극대화되며 진화한 변이체들이 이제는 물리적 타격을 넘어 사냥감의 트라우마를 자극하는 정신적 공격, 즉 신경계 교란까지 일으키고 있는 것이다.\n\n'거짓말 마... 너희들은 이미 내 눈앞에서...'\n\n연이는 무릎을 꿇고 머리를 감싸 쥐었다. 환각 속의 따뜻함에 몸을 맡기고 싶은 유혹이 꿀처럼 달콤하게 밀려왔다. 이대로 눈을 감으면 고통도, 지옥 같은 현실도 끝날 것 같았다. 하지만 그녀는 이빨이 깨져라 혀를 힘껏 깨물었다. 입안 가득 비릿한 쇠맛과 날카로운 고통이 퍼지자, 고향의 환영이 유리창처럼 산산조각 나며 다시 부패한 계단실이 모습을 드러냈다. 환각에 홀려 무방비 상태가 된 연이를 향해, 천장에 매달려 있던 변이체들이 탐욕스러운 침을 흘리며 낙하하고 있었다.\n\n'내 기억을 더럽히지 마, 이 역겨운 괴물 새끼들아!'\n\n연이는 몸을 뒤로 젖히며 쌍권총을 교차해 위쪽을 향해 미친 듯이 난사했다. 쏟아지는 탄환에 놈들의 몸통이 벌집이 되어 쏟아져 내렸다. 정신을 다잡은 연이는 다시 계단을 오르기 시작했다. 30층, 35층. 위로 올라갈수록 적들의 움직임은 짐승을 넘어 거미나 파충류처럼 변모했다. 벽을 타고 미끄러지듯 이동하고, 어둠 속에 완벽하게 위장하여 등 뒤를 노렸다.\n\n38층. 두꺼운 강철 보안문이 반쯤 뜯겨져 있는 곳. 그 안쪽은 일반적인 사무실이 아닌 거대한 생체 실험실이었다. 백색의 타일 바닥 위로 파괴된 기계 장치들이 널브러져 있었고, 방 한가운데 늘어선 거대한 원통형 유리관 속에는 온몸에 파이프가 꽂힌 채 형체를 알 수 없게 개조된 청토끼와 타 종족들의 표본들이 부유하고 있었다.\n\n'이곳에서... 이 끔찍한 괴물들을 연구하고 만들어냈던 건가?'\n\n연이는 조심스럽게 실험실 내부를 수색했다. 컴퓨터 화면은 전력이 끊겨 까맣게 죽어있었지만, 메인 콘솔에는 외부 서버와 연결된 두꺼운 데이터 케이블이 아직 따뜻하게 온기를 유지하고 있었다. 누군가 최근까지, 혹은 방금 전까지 이곳에서 시스템을 조작했다는 명백한 증거였다. 책상 위로 흩어진 기밀문서 파일 더미 중 가장 위에 놓인 붉은색 폴더를 집어 들었다. 제목은 [프로젝트 블루 래빗 - 1급 기밀]. 연이는 떨리는 손으로 문서를 펼쳤다.\n\n'[연구 일지 402호]... 바이러스의 인공적인 유전자 조작 및 병기화 성공. 목적: 국방부 산하 차세대 생물 병기 개발. \n\n부작용: 통제 불가능한 변이과 감염체의 무리 지능 획득. 폐기 프로토콜 가동 실패... 연구소 밖으로 샘플 누출 확인.'\n\n활자들이 망막을 파고들며 뇌리에 박혔다. 이 모든 멸망은 자연의 분노도, 외계의 침공도 아니었다. 그저 끝없는 인간의 탐욕과 권력욕이 빚어낸, 철저하게 인위적인 '사고'였다. 자신의 가족을 찢어 발긴 괴물들이 국방부의 실험실에서 잉태된 병기였다는 진실 앞에, 연이의 손끝이 파르르 떨렸다. 공포나 슬픔 때문이 아니었다. 활화산처럼 끓어오르는 순도 100%의 살의. 연이는 파일을 찢어 바닥에 팽개치고 샷건을 집어 들었다.\n\n'실수라고? 통제 불능이라고? 그렇다면 내 총알도 통제 불능일 거다.' 분노로 타오르는 연이의 시선은 50층 꼭대기를 향해 고정되었다." },
    9: { goal: 85, enemySpeed: 3.8, spawnRate: 1300, homing: true, homingSpeed: 1.1, enemyShoot: true, sky: '#02040a', city: '#000000', fog: '#0f172a', storyText: "■■■■ EPISODE 9: THRONE OF ROT ■■■■\n\n45층을 돌파하자, 타워 내부의 대気が 물리적인 무게를 띤 것처럼 짓눌러왔다. 심해로 잠수하는 듯한 끔찍한 압력. 숨을 들이마실 때마다 폐가 으스러질 것 같은 흉통이 밀려왔다. 깨진 통유리창 너머로 보이는 바깥세상의 하늘은 칠흑 같은 암흑 속에서 오직 불길한 핏빛 자국들만 엉겨 붙어 있었고, 태양은 검은 디스크처럼 빛을 잃어버렸다. 세상의 종말이 시각화된다면 바로 이런 모습일 것이다.\n\n보스가 지근거리에 있다는 짐승의 직감이 연이의 온몸의 솜털을 곤두서게 했다. 전술 조끼를 뒤져보니 남은 것은 소총 탄창 하나, 권총 탄창 하나, 그리고 산탄총의 마지막 슬러그탄 15발이 전부였다. 압도적인 수적, 질적 열세. 하지만 그녀는 차분하고 정교한 동작으로 총기를 점검하고 약실에 탄환을 밀어 넣었다. 철컥- 하는 차가운 금속음이 지옥의 적막을 갈랐다.\n\n마침내 도달한 47층. 그곳은 한때 네온 시티 전체에 전파를 송출하던 거대한 메인 스튜디오 홀이었다. 하지만 지금은 악마의 내장 속으로 들어온 듯했다. 넓은 홀의 벽과 바닥은 맥박이 뛰듯 고동치는 붉은 살점과 덩굴들로 징그럽게 뒤덮여 있었고, 바닥에는 희생자들의 뼈가 카펫처럼 깔려 있었다.\n\n그리고 홀의 정중앙, 그곳에 '왕'이 있었다.\n\n지금껏 연이가 상대해온 변이체들과는 궤를 달리하는, 일반 청토끼의 5배가 넘는 거대한 괴수. 놈의 몸뚱이는 갑각류처럼 단단한 외골격으로 덮여 있었고, 흉측하게 부풀어 오른 얼굴에는 인간의 눈동자를 닮은 수십 개의 안구가 이리저리 굴러가며 사방을 노려보고 있었다. 귀까지 기괴하게 찢어진 아가리 사이로는 사람 팔뚝만 한 누런 송곳니들이 빽빽하게 돋아나 있었다. 모든 청토끼 변이체들을 조종하는 군체의 중심, 그 끔찍한 하이브 마인드의 우두머리였다.\n\n'마침내 여기까지 기어 올라왔군, 꽃돼지 실험체.'\n\n왕좌처럼 솟아오른 살덩어리 옆, 짙은 그림자 속에서 한 남자가 천천히 걸어 나왔다. 흰색 연구 가운은 피와 오물로 검게 물들어 있었고, 그의 겉모습은 아직 인간의 형태를 유지하고 있었지만, 번뜩이는 두 눈동자는 이미 이성을 잃고 짐승처럼 변이된 상태였다. 광기에 사로잡힌 그의 웃음소리가 스튜디오를 기괴하게 울렸다.\n\n연이는 총구를 남자에게 견누며 낮게 으르렁거렸다. '네놈이냐. 이 지옥을 만든 원흉이.'\n\n'나? 나는 창조주다. 프로젝트 블루 래빗의 수석 연구원. 열등한 너희들의 세상을 허물고, 완벽한 진화의 시대를 연 위대한 선구자 말이다!' 남자는 양팔을 벌리며 거대한 청토끼의 왕을 쓰다듬었다. \n\n'왜 이렇게 만들었냐고 묻고 싶겠지? 보아라, 이 아름다운 생명력을! 연약하고 병드는 인간의 육체를 버리고, \n\n죽음을 극복한 완벽한 포식자로 거듭나는 과정이다. 수억 명의 희생은 그저 진화를 위한 거름일 뿐이야!'\n\n연이의 손가락이 방아쇠 위에서 미세하게 떨렸다. 극도의 공포? 아니, 당장이라도 저 역겨운 주둥이를 찢어버리고 싶은 맹렬한 분노였다.\n\n'그래, 넌 살아남았지. 그 연약한 꽃돼지 종족의 면역 체계가 내 바이러스와 결합해 놀라운 저항력을 보여줬어. \n\n네 몸뚱이는 내 최고의 역작을 완성시킬 마지막 퍼즐 조각이다. 네 유전자 코드를 뽑아내면, 지능까지 완벽하게 통제되는 신인류를 양산할 수 있다!'\n\n거대한 청토끼의 왕이 포효하며 수십 개의 눈알을 일제히 연이에게 고정했다. 엄청난 살기와 위압감이 스튜디오를 덮쳤다. 하지만 연이는 흔들리지 않았다. 그녀는 산탄총의 총구를 들어 남자의 미간을 정확히 겨냥했다.\n\n'신인류 좋아하시네. 내 눈엔 그저 대가리에 총알이 박히면 죽는 징그러운 토끼 고기일 뿐이다.'\n\n그녀의 차가운 선고와 함께, 왕이 바닥을 박차고 도약했다. 타앙-! 마침내 지옥의 꼭대기에서, 인류의 생존과 세상의 운명을 건 최후의 결전이 시작되었다." },
    10: { goal: 100, enemySpeed: 4.0, spawnRate: 1200, homing: true, homingSpeed: 1.2, enemyShoot: true, sky: '#000000', city: '#000000', fog: '#450a0a', storyText: "■■■■ STAGE 10: THE LAST CROWN ■■■■\n\n마침내 도달한 50층, 방송국 최상층 스카이라운지는 더 이상 도시를 조망하는 화려한 공간이 아니었다. 그곳은 거대한 살점과 푸른 털이 뒤엉켜 맥동하는 '청토끼의 심장부'였다.\n\n중앙에는 프로젝트의 주동자였던 미친 과학자가 괴물들의 왕과 하나로 융합된 채 연이를 기다리고 있었다. 놈의 등 뒤로는 수만 마리의 청토끼들을 조종하는 신경삭들이 타워 전체로 뻗어 나가고 있었다.\n\n연이의 손에 남은 것은 반쯤 부서진 산탄총과 단 한 탄창의 권총뿐. 어깨의 상처에서는 끊임없이 피가 흘러나와 분홍빛 털을 검붉게 물들였다. 하지만 그녀의 눈동자에는 공포 대신, 멸족당한 일족의 슬픔과 세상을 지옥으로 만든 자를 향한 차가운 살의만이 서려 있었다.\n\n'네놈이 만든 진화의 끝이 고작 이 구역질 나는 고기 덩어리냐? 내 일족의 영혼을 담아, 그 왕관을 부숴주마." }
};

// 보스 등장 대사 (간단한 텍스트로 표시)
const BOSS_QUOTES = {
    1: "⚠️ 알파 청토끼 등장! 지면이 고동친다...",
    2: "⚠️ 엘리트 청토끼 등장! 전투 머신이 다가온다...",
    3: "⚠️ 헌터 청토끼 등장! 냄새를 맡았다...",
    4: "⚠️ 프레데터 알파 등장! 저격이다!",
    5: "⚠️ 탱크 청토끼 등장! 파괴의 병기가 온다...",
    6: "⚠️ 어보미네이션 등장! 강에서 거대한 그림자가...",
    7: "⚠️ 어쌔신 퀸 등장! 뒤에서 날카로운 기척이...",
    8: "⚠️ 사이코틱 킹 등장! 정신이 흔들린다...",
    9: "⚠️ 브루투스 킹 등장! 최강의 왕이 눈을 떴다!",
    10: "⚠️ 얼티메이트 원 등장! 재앙의 근원이 여기 있다..."
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
let winScreenAnimationTime = 0;
let gameClearImageStartTime = 0;
let floatingTexts = []; // "BONUS!" 효과 등을 위한 플로팅 텍스트
const SPAWN_INTERVAL = 2000;
const GATE_SPAWN_INTERVAL = 6000;
const EASY_MODE_CONFIG = {
    // 적 관련 - 모바일 가로 모드 최적화 및 이지 모드 난이도 대폭 하향
    enemySpeedMultiplier: 0.5,           // 적 이동 속도 50% 느리게
    spawnRateMultiplier: 1.3,            // 등장 간격 30% 늘려서 적 스폰을 늦춤 (스폰량 조절로 렉 완화)
    goalMultiplier: 0.7,                 // 목표 처치 수 30% 하향 조절 (빠른 스테이지 클리어)
    homingSpeedMultiplier: 0.4,          // 유도(홈잉) 속도 60% 느리게
    enemyHpMultiplierA: 0.7,             // 적 체력 30% 감소 (더 잘 잡히게)
    enemyHpMultiplierB: 0.7,             // 보스전 등에서 적 체력 30% 감소
    enemyShootIntervalMultiplier: 1.5,  // 적 탄환 발사 간격 50% 늘려서 회피하기 쉽게 함
    maxActiveEnemies: 10,                // 최대 활성 적 수를 줄여서 렉 방지 및 난이도 하락

    // 플레이어 관련 - 이지 모드 버프
    playerHpMultiplier: 1.0,             // 원래 HP
    playerDamageMultiplier: 1.3,          // 플레이어 공격력 30% 버프
    playerInvincibleMultiplier: 1.5,     // 플레이어 무적 시간 50% 증가
    playerSpeedMultiplier: 1.2,            // 플레이어 이동 속도 20% 증가
    fireRateMultiplier: 1.2,             // 플레이어 발사 속도 20% 증가

    // 보스 관련 - 속도 및 공격력 하향
    bossMoveScaleMultiplier: 0.5,        // 보스 이동 속도 50% 느리게
    bossAttackIntervalMultiplier: 1.5,   // 보스 공격 간격 50% 늘려서 생존력 증가
    bossSummonEnemySpeedMultiplier: 0.5, // 소환된 쫄몹 속도 50% 느리게
    bossSummonEnemyHpMultiplier: 0.6,   // 소환된 쫄몹 체력 40% 감소
    bossProjectileSpeedMultiplier: 0.5,   // 보스 발사체 속도 50% 느리게

    // 게임 템포
    gameSpeedMultiplier: 1.0             // 게임 속도
};

function applyMobileOptimizations() {
    const isMobile = isMobileTouchDevice();
    gameContainer.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
    canvas.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
    if (installButton) installButton.classList.toggle(MOBILE_OPTIMIZED_CLASS, isMobile);
}

function isMobileLandscapePlayMode() {
    // 모바일 감지 시 가로 이지 모드 활성화 (더 쉬운 난이도 및 렉 최소화 제공)
    return isMobileTouchDevice();
}

function isMobileLandscapeOrientation() {
    // 진짜 가로 모드 (width > height) - 풀스크린용
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

    // 메인 화면이나 가로 모드일 때 전체화면 요청
    root.requestFullscreen().catch(() => { });
}

// 모바일 메인 화면 즉시 전체화면
function requestMobileMainFullscreen() {
    if (!isMobileTouchDevice()) return;
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;

    // 즉시 전체화면 요청
    root.requestFullscreen().catch(() => { });
}

// 모바일 가로 모드 감지 및 자동 전체화면
function handleMobileOrientation() {
    if (!isMobileTouchDevice()) return;

    const isLandscape = window.orientation === 90 || window.orientation === -90 ||
        (window.innerWidth > window.innerHeight);

    if (isLandscape) {
        // 가로 모드일 때 전체화면
        enterMobileFullscreen();
    }
}

// 화면 방향 변경 감지
if (isMobileTouchDevice()) {
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleMobileOrientation();
            checkMobileEasyModeStatus();
        }, 100);
    });

    // 리사이즈도 감지 (방향 변경 감지 보조)
    window.addEventListener('resize', () => {
        handleMobileOrientation();
        checkMobileEasyModeStatus();
    });
}

// 모바일 이지 모드 상태 체크 및 로그
function checkMobileEasyModeStatus() {
    const isMobile = isMobileTouchDevice();
    const isLandscape = window.innerWidth > window.innerHeight;
    const easyModeActive = isMobileEasyModeActive();

    console.log(`[Mobile Check] Device: ${isMobile ? 'Mobile' : 'Desktop'}, Landscape: ${isLandscape}, EasyMode: ${easyModeActive}`);
    console.log(`[Screen] Width: ${window.innerWidth}, Height: ${window.innerHeight}`);

    return easyModeActive;
}

function updateInstallButtonVisibility() { // MOBILE LANDSCAPE
    // START 상태에서만 버튼 표시, 게임 중에는 무조건 숨김
    if (currentState !== GAME_STATE.START) {
        if (installButton) installButton.hidden = true;
        if (installBtnContainer) installBtnContainer.hidden = true;
        return;
    }

    // 이미 설치된 경우 버튼 숨김
    if (isPWAInstalled()) {
        if (installButton) installButton.hidden = true;
        return;
    }

    // PWA 설치 가능한 경우 표시 (프롬프트 있거나 iOS/Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const canShowInstall = deferredInstallPrompt || isIOS || isSafari || true; // 대부분의 모바일 브라우저에서 표시

    if (installButton) installButton.hidden = !canShowInstall;
    // installBtnContainer는 updateMainMenuVisibility에서 관리
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
    const iosGuide = document.getElementById('ios-guide');
    const androidGuide = document.getElementById('android-guide');

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

        // iOS/Android 구분
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (iosGuide) iosGuide.hidden = !isIOS;
        if (androidGuide) androidGuide.hidden = isIOS;
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

// 실제 PWA 설치 시도 - 자동 설치
async function installPWA() {
    console.log('[Install] Starting PWA installation...');

    // 이미 설치된 경우 알림만 표시
    if (isPWAInstalled()) {
        console.log('[Install] Already installed');
        addFloatingText('✅ Already Installed!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '#2ecc71');
        return;
    }

    // 설치 프롬프트가 있는 경우 (Chrome/Android) - 바로 설치
    if (deferredInstallPrompt) {
        console.log('[Install] Prompt available, showing...');
        try {
            await deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            console.log('[Install] User choice:', outcome);

            if (outcome === 'accepted') {
                console.log('PWA installed successfully');
                deferredInstallPrompt = null;
                addFloatingText('✅ Installing...', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '#2ecc71');

                // 버튼 숨기기
                if (installButton) installButton.hidden = true;
                if (installBtnContainer) installBtnContainer.hidden = true;
            } else {
                addFloatingText('❌ Install Cancelled', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '#e74c3c');
            }
        } catch (error) {
            console.error('[Install] Failed:', error);
            addFloatingText('❌ Install Failed', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '#e74c3c');
        }
    }
    // iOS Safari나 설치 프롬프트가 없는 경우 - 설치 가이드 모달 표시
    else {
        console.log('[Install] No prompt available - showing install guide');
        showInstallGuide();
    }
}

function updateMainMenuVisibility() {
    // 개별 버튼 컨테이너 가시성 업데이트
    const shouldShow = currentState === GAME_STATE.START;
    if (startBtnContainer) startBtnContainer.hidden = !shouldShow;
    if (installBtnContainer) installBtnContainer.hidden = !shouldShow;
    // 패스워드 입력 UI 표시 (스테이지 언락되지 않았을 때만)
    if (passwordContainer) {
        passwordContainer.hidden = !shouldShow || isStageUnlocked;
    }
    // 스테이지 선택 UI는 별도로 관리
    if (stageSelectContainer && shouldShow && !isStageUnlocked) {
        stageSelectContainer.hidden = true;
    }

    // 메인 화면에서 BGM 시작 (초기화되지 않았으면 먼저 초기화)
    if (shouldShow) {
        if (!AudioManager.initialized) {
            AudioManager.init();
        }
        AudioManager.startBGM();
    }

    updateInGameUIVisibility();
    updateOverlayVisibility();
}

function updateOverlayVisibility() {
    if (overlayStageClear) {
        overlayStageClear.hidden = currentState !== GAME_STATE.STAGE_CLEAR;
        if (stageClearEpilogueBtn && stageClearTitle && stageClearDesc) {
            if (currentState === GAME_STATE.STAGE_CLEAR && currentStage >= 10) {
                stageClearEpilogueBtn.style.display = '';
                stageClearTitle.textContent = `STAGE 10 CLEAR!`;
                stageClearDesc.textContent = '좀비 무리를 물리쳤습니다.';
            } else {
                stageClearEpilogueBtn.style.display = 'none';
                stageClearTitle.textContent = `STAGE ${currentStage} CLEAR!`;
                stageClearDesc.textContent = '좀비 무리를 물리쳤습니다.';
            }
        }
    }
    if (overlayWin) {
        overlayWin.hidden = currentState !== GAME_STATE.ALL_CLEAR;
        if (currentState === GAME_STATE.ALL_CLEAR && winScoreText) {
            winScoreText.innerText = score.toLocaleString();
        }
    }
}

// 게임 오버 버튼 가시성 업데이트
function updateGameOverButtonVisibility() {
    const shouldShow = currentState === GAME_STATE.GAME_OVER;
    if (gameoverButtons) gameoverButtons.hidden = !shouldShow;

    // 게임오버 스탯 갱신
    if (shouldShow && gameoverStats) {
        let loreMessage = "";
        let messageColor = "#bdc3c7";
        if (score < 10000) {
            loreMessage = "세상은 푸른 어둠에 잠겼습니다.<br>하지만 연이의 분홍빛 투지는 아직 지지 않았습니다.";
        } else if (score < 30000) {
            loreMessage = "수많은 청토끼를 물리쳤으나, 역병의 근원은 여전히 날뜁니다.<br>다시 일어나세요, 세상을 구할 유일한 꽃돼지여!";
            messageColor = "#e67e22";
        } else if (score < 70000) {
            loreMessage = "당신의 분홍빛 희망은 어둠 속에서도 찬란했습니다.<br>세상은 당신의 숭고한 희생과 총성을 영원히 기억할 것입니다.";
            messageColor = "#9b59b6";
        } else {
            loreMessage = "전설적인 좀비 킬러.<br>당신의 투혼은 사악한 청토끼들에게 영원한 공포로 각인될 것입니다.";
            messageColor = "#00ffff";
        }

        gameoverStats.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 10px; color: #f1c40f;">FINAL SCORE: ${score.toLocaleString()}</div>
            <div style="font-size: 10px; line-height: 1.5; color: ${messageColor};">${loreMessage}</div>
        `;
    }
}

// 패스워드 dots UI 업데이트
function updatePasswordDots(length) {
    if (!passwordDots) return;
    const dots = passwordDots.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index < length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
    // 포커스 시 활성화 표시
    if (document.activeElement === stagePasswordInput) {
        passwordDots.classList.add('active');
    } else {
        passwordDots.classList.remove('active');
    }
}

// 패스워드 입력 초기화
function resetPasswordInput() {
    if (stagePasswordInput) {
        stagePasswordInput.value = '';
    }
    updatePasswordDots(0);
}

// 패스워드 확인 및 스테이지 언락
function checkStagePassword() {
    const input = stagePasswordInput ? stagePasswordInput.value.trim() : '';
    if (input === STAGE_PASSWORD) {
        // 패스워드 일치
        isStageUnlocked = true;
        isGodMode = true; // 비밀번호 입력 시 무적 모드 강제 활성화
        isBombUnlimited = true; // 폭탄 무제한 모드 활성화
        if (passwordError) passwordError.hidden = true;
        if (passwordContainer) passwordContainer.hidden = true;
        // 스테이지 선택 UI 표시
        showStageSelectUI();
        // 성공 피드백
        AudioManager.playSFX('powerup');
        // 패스워드 입력 초기화
        resetPasswordInput();
    } else {
        // 패스워드 불일치
        if (passwordError) passwordError.hidden = false;
        resetPasswordInput();
        if (stagePasswordInput) stagePasswordInput.focus();
        // 실패 피드백
        AudioManager.playSFX('hit');
    }
}

// 스테이지 선택 UI 표시
function showStageSelectUI() {
    if (stageSelectContainer) {
        stageSelectContainer.hidden = false;
        // 스테이지 9-10은 특별 표시
        stageButtons.forEach(btn => {
            const stageNum = parseInt(btn.dataset.stage);
            btn.classList.remove('special');
            if (stageNum >= 9) {
                btn.classList.add('special');
            }
        });
    }
}

// 스테이지 선택 UI 숨김
function hideStageSelectUI() {
    if (stageSelectContainer) {
        stageSelectContainer.hidden = true;
    }
}

// 특정 스테이지로 바로 시작
function startGameAtStage(stageNum) {
    console.log(`[Stage Select] Starting stage ${stageNum}`);

    if (stageNum < 1 || stageNum > 10) {
        console.warn(`[Stage Select] Invalid stage number: ${stageNum}`);
        return;
    }

    // 현재 상태 확인
    if (currentState !== GAME_STATE.START && currentState !== GAME_STATE.STAGE_CLEAR) {
        console.warn(`[Stage Select] Cannot start from state: ${currentState}`);
        return;
    }

    currentStage = stageNum;
    hideStageSelectUI();

    // 전체화면 진입
    enterMobileFullscreen();

    // 오디오 초기화 및 BGM 시작
    AudioManager.init();
    AudioManager.startBGM();

    // 스토리 상태로 진입 - 모든 관련 변수 초기화
    storyPages = [];
    storyCurrentPage = 0;
    storyTotalPages = 0;
    storyTypingIndex = 0;
    storyTextComplete = false;
    lastTypedCharIndex = 0;
    storyClickPending = false;

    currentState = GAME_STATE.STORY;
    storyStateEnterTime = Date.now();
    storyDisplayTime = Date.now();

    // UI 업데이트
    updateMainMenuVisibility();

    console.log(`[Stage Select] Stage ${stageNum} started successfully`);
}

// 게임 시작 - 스토리 먼저 표시
function startGame() {
    if (currentState !== GAME_STATE.START) return;
    enterMobileFullscreen();
    AudioManager.init();
    AudioManager.startBGM();

    // 스토리 상태로 전환
    currentState = GAME_STATE.STORY;
    storyStateEnterTime = Date.now(); // 스토리 상태 진입 시간 기록
    // storyDisplayTime은 drawStoryScreen에서 페이지 분할 시 설정됨
    storyTextComplete = false;
    storyClickPending = false;

    // 페이지네이션 초기화 (drawStoryScreen에서 첫 프레임에 분할 및 시간 설정)
    storyPages = [];
    storyCurrentPage = 0;
    storyTotalPages = 0;
    lastTypedCharIndex = 0; // 타자기 인덱스 초기화

    updateMainMenuVisibility();
}

// 실제 게임 플레이 시작
function startGameplay() {
    currentState = GAME_STATE.PLAYING;
    storyTypingIndex = 0;
    // storyDisplayTime은 다음 스토리에서 다시 설정됨
    updateMainMenuVisibility();

    // 게임 시작 시 모바일 이지 모드 상태 확인
    if (isMobileTouchDevice()) {
        const easyMode = checkMobileEasyModeStatus();
        console.log(`[Game Start] Mobile Easy Mode: ${easyMode ? 'ACTIVE' : 'INACTIVE'}`);
        AudioManager.playSFX('buttonclick');
    }
}

if (installButton) {
    installButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        AudioManager.playSFX('buttonclick');
        await installPWA();
    });
}

// 설치 가이드 닫기 버튼
// 스토리 화면 클릭/탭으로 계속
function handleStoryClick(e) {
    if (currentState === GAME_STATE.STORY) {
        e.preventDefault();
        e.stopPropagation();

        // 스토리 상태 진입 후 300ms 이내 클릭은 무시 (디바운스)
        const timeSinceEnter = Date.now() - storyStateEnterTime;
        if (timeSinceEnter < 300) {
            console.log(`[Story] Click ignored, too soon after enter: ${timeSinceEnter}ms`);
            return;
        }

        if (storyTextComplete) {
            // 텍스트가 모두 표시되었으면 다음 페이지로
            console.log('[Story] Page complete, next page');
            nextStoryPage();
        } else {
            // 아직 타이핑 중이면 즉시 현재 페이지의 모든 텍스트 표시
            console.log('[Story] Fast forward page text');
            storyDisplayTime = Date.now() - (999999); // 즉시 완료
        }
    } else if (currentState === GAME_STATE.EPILOGUE) {
        e.preventDefault();
        e.stopPropagation();

        // 에필로그 상태 진입 후 300ms 이내 클릭은 무시 (디바운스)
        const timeSinceEnter = Date.now() - storyStateEnterTime;
        if (timeSinceEnter < 300) {
            console.log(`[Epilogue] Click ignored, too soon after enter: ${timeSinceEnter}ms`);
            return;
        }

        if (storyTextComplete) {
            if (storyCurrentPage < storyTotalPages - 1) {
                // 다음 페이지로
                console.log('[Epilogue] Next page');
                storyCurrentPage++;
                storyDisplayTime = Date.now();
                storyStateEnterTime = Date.now();
                storyTextComplete = false;
                lastTypedCharIndex = 0;
            } else {
                // 마지막 페이지 - 게임 클리어 이미지 화면으로
                console.log('[Epilogue] Complete, transitioning to GAME_CLEAR_IMAGE state');
                currentState = GAME_STATE.GAME_CLEAR_IMAGE;
                gameClearImageStartTime = Date.now();
                AudioManager.stopEpilogueBGM();
            }
        } else {
            // 아직 타이핑 중이면 즉시 현재 페이지의 모든 텍스트 표시
            console.log('[Epilogue] Fast forward page text');
            storyDisplayTime = Date.now() - (999999); // 즉시 완료
        }
    } else if (currentState === GAME_STATE.STAGE_CLEAR) {
        e.preventDefault();
        e.stopPropagation();
        if (currentStage < 10) advanceStage();
    }
}

// 키보드 이벤트 - 스토리 화면에서 TAB/SPACE/ENTER로 페이지 넘기기, ESC로 스킵
document.addEventListener('keydown', (e) => {
    if (currentState === GAME_STATE.STORY) {
        if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (storyTextComplete) {
                nextStoryPage();
            } else {
                // 타이핑 중이면 즉시 완료
                storyDisplayTime = Date.now() - (999999);
            }
        } else if (e.key === 'Escape') {
            // ESC 키로 스토리 스킵
            e.preventDefault();
            skipStory();
        }
    } else if (currentState === GAME_STATE.EPILOGUE) {
        if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (storyTextComplete) {
                if (storyCurrentPage < storyTotalPages - 1) {
                    // 다음 페이지로
                    storyCurrentPage++;
                    storyDisplayTime = Date.now();
                    storyStateEnterTime = Date.now();
                    storyTextComplete = false;
                    lastTypedCharIndex = 0;
                } else {
                    // 마지막 페이지 - 게임 클리어 이미지 화면으로
                    currentState = GAME_STATE.GAME_CLEAR_IMAGE;
                    gameClearImageStartTime = Date.now();
                    AudioManager.stopEpilogueBGM();
                }
            } else {
                // 타이핑 중이면 즉시 완료
                storyDisplayTime = Date.now() - (999999);
            }
        }
    } else if (currentState === GAME_STATE.GAME_CLEAR_IMAGE) {
        // 게임 클리어 이미지 상태에서 엔터/스페이스/탭으로 WIN 전환
        if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            goToWinState();
        }
    }
});
// 게임 클리어 이미지 상태에서 WIN 상태로 전환
function goToWinState() {
    if (currentState === GAME_STATE.GAME_CLEAR_IMAGE) {
        currentState = GAME_STATE.WIN;
        winScreenAnimationTime = 0;
    }
}

// 게임 클리어 이미지 상태에서 클릭/터치로 WIN 상태로 전환
canvas.addEventListener('click', () => {
    if (currentState === GAME_STATE.GAME_CLEAR_IMAGE) {
        goToWinState();
    }
});
canvas.addEventListener('touchstart', (e) => {
    if (currentState === GAME_STATE.GAME_CLEAR_IMAGE) {
        e.preventDefault();
        goToWinState();
    }
}, { passive: false });

// 스토리 스킵 함수
function skipStory() {
    console.log('[Story] Skip to gameplay');
    // 다음 스토리를 위해 시간 초기화
    storyDisplayTime = 0;
    startGameplay();
}

// 스토리 화면용 이벤트 리스너
canvas.addEventListener('click', handleStoryClick);
canvas.addEventListener('touchstart', handleStoryClick, { passive: false });

// 게임 시작 버튼 이벤트
if (startButton) {
    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioManager.playSFX('buttonclick');
        startGame();
    });
}

// 게임 오버 버튼 이벤트
if (retryButton) {
    retryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioManager.playSFX('buttonclick');
        console.log('[GameOver] Retry clicked');
        resetGame();
        // 게임 오버 버튼 숨김
        if (gameoverButtons) gameoverButtons.hidden = true;
    });
}

if (quitButton) {
    quitButton.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioManager.playSFX('buttonclick');
        console.log('[GameOver] Quit clicked - Exiting game');
        window.close();
    });
}

// 게임 종료 함수
function exitGame() {
    // 게임 상태 정지
    currentState = GAME_STATE.GAME_OVER;

    // 게임 루프 정지
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 게임 오버 버튼 숨김
    if (gameoverButtons) gameoverButtons.hidden = true;

    // 모든 게임 객체 정리
    projectiles = [];
    enemies = [];
    particles = [];
    gates = [];
    floatingTexts = [];

    // BGM 및 모든 사운드 정지
    AudioManager.stopBGM();

    // 방법 1: 창 닫기 시도 (팝업으로 열린 경우에만 작동)
    try {
        window.close();
    } catch (err) {
        console.log('[Exit] window.close() failed:', err);
    }

    // 방법 2: 게임 종료 화면 표시 (이미 있으면 중복 생성 방지)
    if (document.getElementById('game-exit-overlay')) return;

    const exitOverlay = document.createElement('div');
    exitOverlay.id = 'game-exit-overlay';

    // 스타일 설정
    exitOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: 'Press Start 2P', cursive;
        color: #fff;
    `;

    exitOverlay.innerHTML = `
        <div style="font-size: 28px; margin-bottom: 30px; color: #ff4757; text-shadow: 0 0 20px #ff4757;">게임 종료</div>
        <div style="font-size: 12px; color: #888; margin-bottom: 20px;">플레이해 주셔서 감사합니다!</div>
        <div style="font-size: 10px; color: #666;">GAME EXITED</div>
        <button onclick="location.reload()" style="
            margin-top: 40px;
            padding: 15px 30px;
            font-family: 'Press Start 2P', cursive;
            font-size: 10px;
            background: linear-gradient(180deg, #2ecc71 0%, #27ae60 100%);
            border: 4px solid #1e8449;
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
        ">다시 시작</button>
    `;

    document.body.appendChild(exitOverlay);
    console.log('[Exit] Game has been terminated successfully');
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility();
    // PWA 설치 가능할 때 INSTALL 버튼 표시
    if (installButton) installButton.hidden = false;
    // 설치 완료 알림
    addFloatingText('📲 Ready to Install!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, '#2ecc71');
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    // 설치 완료 축하 메시지
    addFloatingText('✅ Game Installed!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, '#2ecc71');
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
        // AudioContext가 suspended 상태이면 resume() 시도 (브라우저 자동 재생 정책)
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => console.log("[Audio] Context resumed"));
        }
        if (this.bgm) {
            this.bgm.play().catch(e => console.log("[Audio] BGM play blocked:", e));
        }
    },
    playSFX: function (type) {
        if (!this.ctx) return;
        // AudioContext가 suspended 상태이면 resume() 시도
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
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
        } else if (type === 'buttonclick') {
            // 버튼 클릭 - 짧고 날카로운 금속음
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(); osc.stop(now + 0.05);
        } else if (type === 'buttonhover') {
            // 버튼 호버 - 매우 짧은 살짝 스치는 소리
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
            osc.start(); osc.stop(now + 0.03);
        } else if (type === 'miss') {
            // 청토끼 놓침 - 낮은 불협화음 (좀비물 느낌)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(); osc.stop(now + 0.3);
        }
    },
    epilogueBGM: null,
    playEpilogueBGM: function () {
        // 현재 BGM 정지
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        // 에필로그 BGM 재생
        if (!this.epilogueBGM) {
            this.epilogueBGM = new Audio(ASSETS.epilogueBGM);
            this.epilogueBGM.loop = true;
            this.epilogueBGM.volume = 0.6;
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => console.log("[Audio] Context resumed for epilogue"));
        }
        this.epilogueBGM.play().catch(e => console.log("[Audio] Epilogue BGM play blocked:", e));
    },
    stopEpilogueBGM: function () {
        if (this.epilogueBGM) {
            this.epilogueBGM.pause();
            this.epilogueBGM.currentTime = 0;
        }
    }
};

const ImageLoader = {
    images: {},
    loadImage: function (key, src) {
        if (!src) return Promise.resolve(null);
        return new Promise((resolve) => {
            let resolved = false;
            // 2.5초 동안 로드가 안 되면 강제로 resolve하여 데드락 예방
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.warn(`[ImageLoader] Timeout loading asset: ${key} (${src})`);
                    resolve(null);
                }
            }, 2500);

            const img = new Image();
            img.onload = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    this.images[key] = img;
                    resolve(img);
                }
            };
            img.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    console.error(`[ImageLoader] Failed to load asset: ${key} (${src})`);
                    resolve(null);
                }
            };
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
    minFireRate: 80,
    lastFireTime: 0,
    damage: 10,
    targetY: 0,
    recoilX: 0, // 물리적 반동 변위 오프셋 추가 (프리미엄 2D 감동 손맛)
    init: function () {
        // 가로모드에서 크기 75% 축소 (더 많은 적을 위한 공간 확보)
        if (isMobileLandscapePlayMode()) {
            this.width = 48;
            this.height = 48;
        } else {
            this.width = 64;
            this.height = 64;
        }
        
        this.y = GAME_HEIGHT / 2 - this.height / 2;
        this.targetY = this.y;
        this.recoilX = 0; // 반동 리셋
        
        // 스탯 계산
        const baseDamage = 10;
        const baseFireRate = 200;
        
        // 아이템 레벨 보너스
        const itemDamageBonus = (LevelSystem.items.DAMAGE.level - 1) * LevelSystem.stats.itemDamagePerLevel;
        const itemFireRateBonus = (LevelSystem.items.FIRE_RATE.level - 1) * LevelSystem.stats.itemFireRatePerLevel;
        
        const levelDamageBonus = (LevelSystem.playerLevel - 1) * 3; // 레벨당 공격력 +3 (상향)
        this.damage = (isMobileEasyModeActive() 
            ? Math.round((baseDamage + itemDamageBonus) * EASY_MODE_CONFIG.playerDamageMultiplier) 
            : baseDamage + itemDamageBonus) + levelDamageBonus;
            
        this.fireRate = Math.max(baseFireRate - itemFireRateBonus, this.minFireRate);
        
        // ── 체력: 기본 5 하트 + 캐릭터 레벨 2레벨당 1씩 증가 (상향) ──
        const levelHpBonus = Math.floor((LevelSystem.playerLevel - 1) / 2);
        this.maxHp = 5 + levelHpBonus;
        this.hp = this.maxHp;
        
        this.shield = 0;
        this.bombCount = 3;
        this.defense = 0; // 방어력 추가
        this.aniFrame = 0;
        this.state = 'ALIVE';
        this.lastFrameTime = 0;
        this.supportTimer = 0; // 지원군 지속 시간
        this.skillNotifications = []; // 활성 스킬 알림
        
        // 꽃잎 포 (필살기) 시스템
        this.petalCannonCharge = 0; // 현재 충전량 (발사 횟수)
        this.petalCannonMaxCharge = 70; // 최대 충전 필요 발사 횟수 (70발로 상향)
        this.petalCannonReady = false; // 발사 가능 여부
    },
    takeDamage: function (amount) {
        if (this.state === 'DEAD' || this.shield > 0 || isGodMode) return;

        // 방어력 적용: 최고 레벨 시 1/4 (75% 감소)
        const defItem = LevelSystem.items.DEFENSE;
        const maxDefLevel = LevelSystem.itemMaxLevel;
        const reduction = (defItem.level / maxDefLevel) * 0.75;
        const actualDamage = amount * (1 - reduction);

        this.hp -= actualDamage;
        this.shield = getPlayerInvincibleDuration();
        AudioManager.playSFX('hit');

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'DEAD';
            this.aniFrame = 0;
            this.lastFrameTime = Date.now();
            this.recoilX = 0; // 사망 시 물리 반동 리셋
            createExplosion(this.x, this.y, '#c0392b');
            endGame();
        }
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
        if (this.y + this.height > GAME_HEIGHT) this.y = GAME_HEIGHT - this.height;

        // =========================================================
        // [프리미엄 2D 스프라이트 정밀 반동 물리 및 연사 연동형 애니메이터]
        // =========================================================
        
        // 1. 반동 복원 스프링-감쇠 물리 모델 (Spring-Damper Recoil Decay)
        // 총을 쏘면 recoilX가 마이너스로 튕겼다가, 프레임마다 탄력적으로 0에 복원됨
        this.recoilX *= 0.82;
        if (Math.abs(this.recoilX) < 0.1) this.recoilX = 0;

        // 모바일 및 이지 모드용 발사 주기 보정 적용
        const fireRateMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.fireRateMultiplier : 1.0;
        const fire = Math.max(this.fireRate * fireRateMultiplier, 10);
        const timeSinceLastFire = time - this.lastFireTime;

        // 꽃잎포 특수 사격 모션 타이머 감소 및 애니메이션 프레임 설정
        if (this.petalFiringTimer > 0) {
            this.petalFiringTimer -= 16;
            if (this.petalFiringTimer < 0) this.petalFiringTimer = 0;
            const pProgress = 1 - (this.petalFiringTimer / 300);
            this.aniFrame = Math.min(7, Math.floor(pProgress * 8));
            this.isShootingAnimation = true;
        } else if (timeSinceLastFire < fire) {
            this.isShootingAnimation = true;
            const progress = timeSinceLastFire / fire;
            
            // 8개의 프레임을 진척도에 따라 자연스럽게 연결하여 재생
            this.aniFrame = Math.floor(progress * 8);
            if (this.aniFrame > 7) this.aniFrame = 7;
        } else {
            this.isShootingAnimation = false;
            
            // 평소 걷기/대기 하이브리드 연출:
            // 위아래 이동 중(dy 존재)일 때는 이동 속도에 맞춰 발을 자연스럽게 교차 (0, 1, 2, 3 순환)
            // 가만히 대기 중일 때는 0번(기본 대기)과 1번(정조준)이 숨쉬듯 800ms 주기로 은은하게 펄싱
            if (Math.abs(dy) > 0.8) {
                const walkFrameDuration = 200; 
                this.aniFrame = Math.floor(time / walkFrameDuration) % 4;
            } else {
                const breathCycle = 1000;
                this.aniFrame = Math.floor((time % breathCycle) / (breathCycle / 2)) === 0 ? 0 : 1;
            }
        }

        // 2. 발사 로직
        if (time - this.lastFireTime >= fire) {
            this.lastFireTime = time;
            
            // [물리 반동 격발!] 플레이어를 뒤(왼쪽)로 강하게 튕겨냄 (공격력 레벨에 따라 타격감 반동 강도 증가)
            const weaponLevel = LevelSystem.items.DAMAGE.level;
            const cappedWeaponLevel = Math.min(weaponLevel, 10); // 10레벨 이후 크기 증가 없음
            
            // 기본 반동 -6px, 무기 레벨당 -0.4px씩 반동 증가로 묵직한 대포 샷건 연출!
            this.recoilX = -(5.5 + cappedWeaponLevel * 0.45);
            
            const sizeScale = 1 + (cappedWeaponLevel - 1) * 0.10; // 레벨 1 = 100%, 레벨 10 = 190%
            const bulletWidth = Math.max(16, Math.round(20 * sizeScale));
            const bulletHeight = Math.max(8, Math.round(10 * sizeScale));
            // 속도도 무기 레벨당 10%씩 증가
            const speedScale = 1 + (weaponLevel - 1) * 0.1;
            const bulletSpeed = 10 * speedScale;
            
            // 주 총알 격발 - Projectile 생성자에서 공격력 기반으로 크기 자동 계산
            console.log(`[SHOOT] Player.damage: ${this.damage}, bulletSpeed: ${bulletSpeed}, weaponLevel: ${weaponLevel}`);
            const projectile = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65, bulletSpeed, 0, this.damage);
            projectiles.push(projectile);
            
            // [화려한 탄피/스파크 격발 이펙트] 총구에서 뒤쪽(왼쪽)으로 가볍게 날리는 분홍 스파크 뿜음
            const fireX = this.x + this.width - 5;
            const fireY = this.y + this.height * 0.62;
            const sparkCount = isMobileEasyModeActive() ? 2 : 4;
            for (let s = 0; s < sparkCount; s++) {
                const p = new Particle(fireX, fireY, '#ffb6c1');
                p.speedX = -Math.random() * 4 - 2; // 격렬하게 뒤로 튕김
                p.speedY = (Math.random() - 0.5) * 5; // 사방 산란
                p.size = Math.random() * 3 + 2;
                p.decay = 0.03;
                particles.push(p);
            }
            
            // 꽃잎 포 충전 (총 격발 횟수 기준)
            if (!this.petalCannonReady) {
                this.petalCannonCharge++;
                if (this.petalCannonCharge >= this.petalCannonMaxCharge) {
                    this.petalCannonReady = true;
                    addFloatingText("🌸 꽃잎 포 충전 완료! (F키)", this.x, this.y - 60, '#ff69b4');
                    AudioManager.playSFX('powerup');
                }
            }

            // 지원군 사격 (위, 아래 추가 지원)
            if (this.supportTimer > 0) {
                const projTop = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65 - 80, bulletSpeed, 0, this.damage);
                const projBottom = new Projectile(this.x + this.width - 5, this.y + this.height * 0.65 + 80, bulletSpeed, 0, this.damage);
                projectiles.push(projTop);
                projectiles.push(projBottom);
            }

            AudioManager.playSFX('shoot');
        }
    },
    draw: function (ctx) {
        // 승리 모션 처리
        if (currentState === GAME_STATE.STAGE_CLEAR || currentState === GAME_STATE.WIN) {
            const winImg = ImageLoader.get('win');
            if (winImg) {
                const time = Date.now();
                const bounce = Math.sin(time / 200) * 15;
                const winSize = this.width * 2.0; // 크기 확대

                ctx.save();
                // 네온 사인 효과 (이중 그림자)
                ctx.shadowBlur = 30 + Math.sin(time / 150) * 10;
                ctx.shadowColor = currentState === GAME_STATE.WIN ? '#00ffff' : '#f1c40f';

                // 캐릭터 그리기 (가로 모드에서 상단 짤림 방지)
                const winX = this.x - winSize / 2 + this.width / 2;
                const winY = Math.max(0, this.y - winSize / 2 + this.height / 2 + bounce);
                ctx.drawImage(winImg, winX, winY, winSize, winSize);

                // 한 번 더 그려서 광채 강화
                ctx.globalAlpha = 0.5 + Math.sin(time / 150) * 0.3;
                ctx.drawImage(winImg, winX, winY, winSize, winSize);

                ctx.restore();
                return;
            }
        }

        const img = ImageLoader.get('player');
        if (img) {
            const cols = 4;
            const rows = 2;
            const frameW = img.width / cols;
            const frameH = img.height / rows;
            let rowIdx = 0;
            let colIdx = 0;

            // 사망 시 정교한 비주얼 피드백 적용
            if (this.state === 'DEAD') {
                // 사망 시: 5번 프레임(반동 밀림)에서 서서히 6번 프레임(눈 감고 한숨)으로 연출
                const timeSinceDeath = Date.now() - this.lastFrameTime;
                const deathFrame = timeSinceDeath < 400 ? 5 : 6;
                rowIdx = Math.floor(deathFrame / cols);
                colIdx = deathFrame % cols;
            } else {
                // 정교한 전역 프레임 매핑을 위해 rowIdx, colIdx 분할 계산
                rowIdx = Math.floor(this.aniFrame / cols);
                colIdx = this.aniFrame % cols;
            }

            const sx = colIdx * frameW + 22;
            const sy = rowIdx * frameH;
            const cropWidth = frameW - 30;

            // 모바일 고화질: ctx에 imageSmoothingQuality 명시 적용
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // 불투명한 피크셀 정렬 + 물리 반동(recoilX)의 실시간 변위 적용
            let drawX = Math.round(this.x + this.recoilX);
            let drawY = Math.round(this.y);
            const drawW = Math.round(this.width);
            const drawH = Math.round(this.height);

            // 꽃잎포 격발 시 강력한 시각 효과 (화려한 핑크 오라와 진동)
            if (this.petalFiringTimer > 0) {
                // 기존 총쏘는 애니메이션(8프레임)을 활용한 초화려한 궁극기 팬텀(잔상) 이펙트 연출
                const phantomCount = 3;
                const time = Date.now();
                for (let i = phantomCount; i > 0; i--) {
                    ctx.save();
                    const scale = 1.0 + (i * 0.25) + Math.sin(time / 40) * 0.1;
                    ctx.globalAlpha = 0.5 / i;
                    ctx.shadowBlur = 50;
                    // 팬텀 색상 교차 발광 (핫핑크 & 시안)
                    ctx.shadowColor = i % 2 === 0 ? '#ff1493' : '#00ffff';
                    
                    const pDrawW = drawW * scale;
                    const pDrawH = drawH * scale;
                    const pDrawX = drawX - (pDrawW - drawW) / 2 + (Math.random() - 0.5) * 20;
                    const pDrawY = drawY - (pDrawH - drawH) / 2 + (Math.random() - 0.5) * 20;
                    
                    // 기존 스프라이트 컷(sx, sy)을 활용해 거대화된 잔상을 그려 화려함 극대화
                    ctx.drawImage(img, sx, sy, cropWidth, frameH, pDrawX, pDrawY, pDrawW, pDrawH);
                    ctx.restore();
                }

                ctx.shadowBlur = 50 + Math.random() * 30;
                ctx.shadowColor = '#ff1493'; // 코어 딥 핑크 글로우
                drawX += (Math.random() - 0.5) * 18; // 더욱 과격한 코어 화면 진동 연출
                drawY += (Math.random() - 0.5) * 18;
            } else if (this.isShootingAnimation && this.aniFrame === 4) {
                // 일반 사격 시 총구 화염 글로우 효과 적용
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#ffb6c1';
            }

            if (this.shield > 0) {
                // 쉴드 중: 보라 글로우 + 하이라이트
                ctx.shadowBlur = 24;
                ctx.shadowColor = '#a855f7';
                ctx.drawImage(img, sx, sy, cropWidth, frameH, drawX, drawY, drawW, drawH);
                // 반투명 불빛 이펙트
                ctx.globalAlpha = 0.25 + 0.15 * Math.sin(Date.now() / 200);
                ctx.shadowBlur = 40;
                ctx.drawImage(img, sx, sy, cropWidth, frameH, drawX, drawY, drawW, drawH);
                ctx.globalAlpha = 1;
            } else {
                ctx.drawImage(img, sx, sy, cropWidth, frameH, drawX, drawY, drawW, drawH);
            }

            // 지원군 렌더링 (플레이어 뒤쪽에 축소 배치 - 화면 가림 방지)
            if (this.supportTimer > 0) {
                const supportAlpha = 0.35 + 0.08 * Math.sin(Date.now() / 180);
                ctx.globalAlpha = supportAlpha;
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#f97316';
                const supportW = Math.round(drawW * 0.55);
                const supportH = Math.round(drawH * 0.55);
                // 상단 지원군 (왼쪽 뒤 위 - 반동 recoilX 동시 반영!)
                ctx.drawImage(img, sx, sy, cropWidth, frameH,
                    Math.round(drawX - supportW - 5), Math.round(drawY - 20),
                    supportW, supportH);
                // 하단 지원군 (왼쪽 뒤 아래 - 반동 recoilX 동시 반영!)
                ctx.drawImage(img, sx, sy, cropWidth, frameH,
                    Math.round(drawX - supportW - 5), Math.round(drawY + drawH - supportH + 20),
                    supportW, supportH);
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }
    }
};

// ============================================================================
// [Level System - 레벨 및 경험치 시스템]
// 플레이어 레벨(EXP 기반)과 각 아이템별 레벨/경험치 관리
// ============================================================================
const LevelSystem = {
    // 플레이어 기본 레벨 (EXP 기반으로 레벨업)
    playerLevel: 1,
    playerExp: 0, // 현재 누적 EXP (점수와 별개)
    playerExpToNext: 100, // 첫 레벨업 필요 EXP
    
    // 아이템별 레벨과 경험치
    items: {
        DAMAGE: { level: 1, exp: 0, expToNext: 50, name: '공격력', icon: '⚔️' },
        FIRE_RATE: { level: 1, exp: 0, expToNext: 50, name: '공격속도', icon: '🔥' },
        DEFENSE: { level: 0, exp: 0, expToNext: 50, name: '방어력', icon: '🛡️' },
        SHIELD: { level: 1, exp: 0, expToNext: 50, name: '무적', icon: '✨' },
        SUPPORT: { level: 1, exp: 0, expToNext: 50, name: '지원군', icon: '👥' }
    },
    
    // 레벨당 스탯 증가량
    maxLevel: 20, // 플레이어 최대 레벨 (20으로 상향)
    itemMaxLevel: 15, // 아이템 최대 레벨 (공격력 포함 15)
    itemMaxLevelFireRate: 12, // 공격속도 최대 레벨 (12로 제한)
    stats: {
        playerHpPerLevel: 2,        // 플레이어 레벨당 체력 +2
        playerDefensePerLevel: 0.5, // 플레이어 레벨당 방어력 +0.5
        itemDamagePerLevel: 7.5,    // 공격력 아이템 레벨당 +7.5
        itemFireRatePerLevel: 11,   // 공격속도 아이템 레벨당 -11ms (최소 80ms)
        itemShieldPerLevel: 1500,   // 무적 아이템 레벨당 +1.5초
        itemSupportPerLevel: 2000,  // 지원군 아이템 레벨당 +2초
        itemDefensePerLevel: 1      // 방어력 아이템 레벨당 +1 (내부용)
    },
    
    init: function() {
        this.playerLevel = 1;
        this.playerExp = 0;
        this.playerExpToNext = this.getPlayerExpToNext(1);
        
        // 아이템 초기화
        for (let key in this.items) {
            this.items[key].level = (key === 'DEFENSE') ? 0 : 1;
            this.items[key].exp = 0;
            this.items[key].expToNext = 50; // 아이템: 50 EXP = 1레벨
        }
    },
    
    // 플레이어 레벨업에 필요한 EXP 계산
    getPlayerExpToNext: function(level) {
        // 레벨 1→2: 100, 2→3: 150, 3→4: 200... (점진적 증가)
        return 50 + level * 50;
    },
    
    // 아이템 레벨업에 필요한 EXP
    getItemExpToNext: function(level) {
        return 50; // 고정 50 EXP
    },
    
    // 플레이어 EXP 획득 (코인, 보상 등)
    addPlayerExp: function(amount) {
        if (this.playerLevel >= this.maxLevel) return;
        
        this.playerExp += amount;
        
        // 레벨업 체크 (연속 레벨업 가능)
        while (this.playerExp >= this.playerExpToNext && this.playerLevel < this.maxLevel) {
            this.playerExp -= this.playerExpToNext;
            this.levelUpPlayer();
        }
        
        // 최대 레벨 시 EXP 초과분 버림
        if (this.playerLevel >= this.maxLevel) {
            this.playerExp = 0;
        }
    },
    
    // 점수 업데이트 (점수는 이제 레벨업과 무관 - EXP 기반으로 변경)
    updateScore: function(currentScore) {
        // 점수는 이제 레벨업에 영향 없음 - EXP 기반 시스템으로 변경
        // 이 함수는 하위 호환성을 위해 유지
    },
    
    // 플레이어 레벨업 (EXP 기반 - 최대 레벨 20)
    levelUpPlayer: function() {
        // 최대 레벨 체크
        if (this.playerLevel >= this.maxLevel) {
            return;
        }
        
        this.playerLevel++;
        
        // 다음 레벨까지 필요한 EXP 업데이트
        if (this.playerLevel < this.maxLevel) {
            this.playerExpToNext = this.getPlayerExpToNext(this.playerLevel);
        }
        
        // 레벨업 효과 - 체력 상한 2레벨당 1씩 증가 (상향)
        const oldMaxHp = Player.maxHp;
        const levelHpBonus = Math.floor((this.playerLevel - 1) / 2);
        const newMaxHp = 5 + levelHpBonus;
        Player.maxHp = newMaxHp;
        Player.hp = newMaxHp; // 레벨업 시 체력 가득 회복하여 안정적으로 반영
        if (newMaxHp > oldMaxHp) {
            addFloatingText(`❤️ MAX HP UP! ${oldMaxHp} → ${newMaxHp}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, '#e74c3c');
        }

        // 캐릭터 레벨업으로 인한 공격력(damage) 및 스탯 재계산 (기존 아이템 효과, 폭탄 수, 쉴드, 필살기 게이지 등은 완벽히 유지 보존!)
        const baseDamage = 10;
        const itemDamageBonus = (this.items.DAMAGE.level - 1) * this.stats.itemDamagePerLevel;
        const levelDamageBonus = (this.playerLevel - 1) * 3; // 레벨당 공격력 +3
        Player.damage = (isMobileEasyModeActive() 
            ? Math.round((baseDamage + itemDamageBonus) * EASY_MODE_CONFIG.playerDamageMultiplier) 
            : baseDamage + itemDamageBonus) + levelDamageBonus;

        const baseFireRate = 200;
        const itemFireRateBonus = (this.items.FIRE_RATE.level - 1) * this.stats.itemFireRatePerLevel;
        Player.fireRate = Math.max(baseFireRate - itemFireRateBonus, Player.minFireRate);

        addFloatingText(`★ LEVEL UP! Lv.${this.playerLevel} ★`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '#f1c40f');
        addFloatingText(`공격력 & 필살기 강화!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '#2ecc71');
        AudioManager.playSFX('powerup');
    },
    
    // 아이템 경험치 획득 (게이트 통과 시)
    addItemExp: function(itemType, amount) {
        if (!this.items[itemType]) return false;
        
        const item = this.items[itemType];
        // 최대 레벨 체크 -> 공격력/속도 아이템인 경우 플레이어 경험치로 전환
        const maxLv = (itemType === 'FIRE_RATE') ? this.itemMaxLevelFireRate : this.itemMaxLevel;
        if (item.level >= maxLv) {
            if (itemType === 'DAMAGE' || itemType === 'FIRE_RATE') {
                this.addPlayerExp(amount);
                return "MAX_EXP";
            }
            return false;
        }
        
        item.exp += amount;
        
        let leveledUp = false;
        while (item.exp >= item.expToNext && item.level < this.itemMaxLevel) {
            item.exp -= item.expToNext;
            item.level++;
            item.expToNext = this.getItemExpToNext(item.level);
            this.applyItemLevelUp(itemType, item.level);
            leveledUp = true;
            // 최대 레벨 도달 시 EXP 초과분은 버림 (단, 공격력/속도는 위에서 처리됨)
            if (item.level >= this.itemMaxLevel) {
                item.exp = 0;
                break;
            }
        }
        
        return leveledUp;
    },
    
    // 아이템 레벨업 효과 적용 (Player.init()과 동일한 계산 방식 사용)
    applyItemLevelUp: function(itemType, newLevel) {
        const item = this.items[itemType];
        
        // 아이템 레벨 보너스만 적용 - 무기 레벨만 공격력에 영향 (캐릭터 레벨은 별개)
        const itemDamageBonus = (LevelSystem.items.DAMAGE.level - 1) * LevelSystem.stats.itemDamagePerLevel;
        const itemFireRateBonus = (LevelSystem.items.FIRE_RATE.level - 1) * LevelSystem.stats.itemFireRatePerLevel;
        
        switch(itemType) {
            case 'DAMAGE':
                // 공격력 재계산 - 무기 레벨만 영향
                const baseDamage = 10;
                const newDamage = isMobileEasyModeActive() 
                    ? Math.round((baseDamage + itemDamageBonus) * EASY_MODE_CONFIG.playerDamageMultiplier)
                    : baseDamage + itemDamageBonus;
                Player.damage = newDamage;
                addFloatingText(`${item.icon} ${item.name} Lv.${newLevel}!`, Player.x, Player.y - 30, '#e74c3c');
                addFloatingText(`공격력: ${newDamage.toFixed(1)} (+${this.stats.itemDamagePerLevel})`, Player.x, Player.y - 50, '#ff6b6b');
                break;
                
            case 'FIRE_RATE':
                // 공격속도 재계산 (발사 간격 감소)
                const baseFireRate = 200;
                const newFireRate = Math.max(baseFireRate - itemFireRateBonus, Player.minFireRate);
                Player.fireRate = newFireRate;
                addFloatingText(`${item.icon} ${item.name} Lv.${newLevel}!`, Player.x, Player.y - 30, '#3498db');
                addFloatingText(`발사간격: ${newFireRate}ms (-${this.stats.itemFireRatePerLevel}ms)`, Player.x, Player.y - 50, '#74b9ff');
                break;
                
            case 'DEFENSE':
                // 방어력 레벨업
                addFloatingText(`${item.icon} ${item.name} Lv.${newLevel}!`, Player.x, Player.y - 30, '#95a5a6');
                const reductionPercent = (newLevel / this.itemMaxLevel) * 75;
                addFloatingText(`피해 감소: ${reductionPercent.toFixed(1)}%`, Player.x, Player.y - 50, '#bdc3c7');
                break;

            case 'SHIELD':
                // 무적 시간 증가
                addFloatingText(`${item.icon} ${item.name} Lv.${newLevel}!`, Player.x, Player.y - 30, '#9b59b6');
                addFloatingText(`방어시간 +${(this.stats.itemShieldPerLevel/1000).toFixed(1)}s`, Player.x, Player.y - 50, '#bb8fce');
                break;
                
            case 'SUPPORT':
                // 지원군 시간 증가
                addFloatingText(`${item.icon} ${item.name} Lv.${newLevel}!`, Player.x, Player.y - 30, '#e67e22');
                addFloatingText(`지원시간 +${(this.stats.itemSupportPerLevel/1000).toFixed(1)}s`, Player.x, Player.y - 50, '#f5b041');
                break;
        }
        
        AudioManager.playSFX('powerup');
    },
    
    // 현재 아이템 효과값 계산
    getItemEffect: function(itemType) {
        const item = this.items[itemType];
        if (!item) return 0;
        
        switch(itemType) {
            case 'DAMAGE':
                return item.level * this.stats.itemDamagePerLevel;
            case 'FIRE_RATE':
                return item.level * this.stats.itemFireRatePerLevel;
            case 'SHIELD':
                return item.level * this.stats.itemShieldPerLevel;
            case 'SUPPORT':
                return item.level * this.stats.itemSupportPerLevel;
            default:
                return 0;
        }
    },
    
    // 아이템 사용 시 레벨 기반 효과 적용
    applyShield: function() {
        const baseShield = 15000; // 15초
        const bonus = this.getItemEffect('SHIELD');
        Player.shield = baseShield + bonus;
        addSkillNotification("SHIELD ACTIVE", baseShield + bonus);
    },
    
    applySupport: function() {
        const baseSupport = 20000; // 20초
        const bonus = this.getItemEffect('SUPPORT');
        Player.supportTimer = baseSupport + bonus;
        addSkillNotification("SUPPORT CALLED", baseSupport + bonus);
    }
};

class Projectile {
    constructor(x, y, vx, vy, damage) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.damage = damage;
        // 공격력에 따른 총알 크기 설정 (기준 공격력 10, 기본 크기 20x10)
        // 더 눈에 띄는 크기 증가: 공격력 10당 50% 증가
        const sizeScale = 1 + Math.max(0, damage - 10) / 10 * 0.15; // 공격력 20이면 1.5배, 30이면 2.0배
        this.width = 20 * sizeScale;
        this.height = 10 * sizeScale;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x > GAME_WIDTH || this.x < -100 || this.y < -100 || this.y > GAME_HEIGHT + 100) this.active = false;
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
        } else if (this.isPetalCannon) {
            // 🌸 화려한 꽃잎 포 (필살기) - 다층 꽃 효과
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const time = Date.now() / 80;
            const isMain = this.isMainPetal;
            const isSpiral = this.isSpiral;
            
            ctx.save();
            
            // 글로우 효과 (메인 꽃잎은 더 강하게)
            ctx.shadowBlur = isMain ? 40 : 25;
            ctx.shadowColor = isMain ? '#ff00ff' : '#ff69b4';
            
            // === 바깥쪽 꽃잎 레이어 (큰 꽃잎) ===
            const outerPetals = isMain ? 12 : 8;
            for (let i = 0; i < outerPetals; i++) {
                const rotationOffset = time * (isSpiral ? 3 : 2);
                const angle = (i * (360 / outerPetals) + rotationOffset) * Math.PI / 180;
                const petalDistance = isMain ? 28 : 22;
                const px = centerX + Math.cos(angle) * petalDistance;
                const py = centerY + Math.sin(angle) * petalDistance;
                
                // 그라데이션 꽃잎 (바깥)
                const petalGrad = ctx.createRadialGradient(px, py, 0, px, py, isMain ? 25 : 20);
                if (isMain) {
                    petalGrad.addColorStop(0, '#ff00ff'); // 마젠타
                    petalGrad.addColorStop(0.4, '#ff1493'); // 딥핑크
                    petalGrad.addColorStop(1, 'rgba(255, 20, 147, 0.2)');
                } else if (isSpiral) {
                    petalGrad.addColorStop(0, '#ff69b4'); // 핫핑크
                    petalGrad.addColorStop(0.5, '#ffb6c1'); // 라이트핑크
                    petalGrad.addColorStop(1, 'rgba(255, 182, 193, 0.3)');
                } else {
                    petalGrad.addColorStop(0, '#ff1493'); // 딥핑크
                    petalGrad.addColorStop(0.5, '#ff69b4'); // 핫핑크
                    petalGrad.addColorStop(1, 'rgba(255, 105, 180, 0.3)');
                }
                
                ctx.fillStyle = petalGrad;
                ctx.beginPath();
                // 하트 모양 꽃잎
                const petalLen = isMain ? 28 : 22;
                const petalWid = isMain ? 16 : 12;
                ctx.ellipse(px, py, petalLen, petalWid, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // === 중간 꽃잎 레이어 ===
            const midPetals = 6;
            for (let i = 0; i < midPetals; i++) {
                const rotationOffset = -time * 1.5;
                const angle = (i * (360 / midPetals) + rotationOffset) * Math.PI / 180;
                const petalDistance = isMain ? 18 : 14;
                const px = centerX + Math.cos(angle) * petalDistance;
                const py = centerY + Math.sin(angle) * petalDistance;
                
                const petalGrad = ctx.createRadialGradient(px, py, 0, px, py, 15);
                petalGrad.addColorStop(0, '#ffb6c1'); // 라이트핑크
                petalGrad.addColorStop(0.5, '#ffc0cb'); // 핑크
                petalGrad.addColorStop(1, 'rgba(255, 192, 203, 0.2)');
                
                ctx.fillStyle = petalGrad;
                ctx.beginPath();
                ctx.ellipse(px, py, 14, 8, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // === 안쪽 꽃잎 레이어 (작은 꽃잎) ===
            const innerPetals = 5;
            for (let i = 0; i < innerPetals; i++) {
                const rotationOffset = time;
                const angle = (i * (360 / innerPetals) + rotationOffset) * Math.PI / 180;
                const px = centerX + Math.cos(angle) * 10;
                const py = centerY + Math.sin(angle) * 10;
                
                ctx.fillStyle = '#ff69b4';
                ctx.beginPath();
                ctx.ellipse(px, py, 10, 6, angle, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // === 중심 코어 (황금 꽃술) ===
            ctx.shadowBlur = isMain ? 50 : 30;
            ctx.shadowColor = '#ffd700';
            
            // 코어 외곽
            const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, isMain ? 18 : 12);
            coreGrad.addColorStop(0, '#fff');
            coreGrad.addColorStop(0.2, '#fffacd'); // 레몬쉬폰
            coreGrad.addColorStop(0.5, '#ffd700'); // 골드
            coreGrad.addColorStop(1, '#ff8c00'); // 다크오렌지
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, isMain ? 16 : 10, 0, Math.PI * 2);
            ctx.fill();
            
            // 코어 내부 빛
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, isMain ? 8 : 5, 0, Math.PI * 2);
            ctx.fill();
            
            // === 장식용 링들 ===
            ctx.shadowBlur = 20;
            ctx.shadowColor = isMain ? '#ff00ff' : '#ff1493';
            
            // 회전하는 링 1
            ctx.strokeStyle = `rgba(255, 20, 147, ${0.4 + Math.sin(time) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (isMain ? 40 : 30) + Math.sin(time * 2) * 3, 0, Math.PI * 2);
            ctx.stroke();
            
            // 회전하는 링 2
            ctx.strokeStyle = `rgba(255, 105, 180, ${0.3 + Math.cos(time * 1.5) * 0.15})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, (isMain ? 50 : 38) + Math.cos(time * 1.5) * 4, 0, Math.PI * 2);
            ctx.stroke();
            
            // 파티클 효과 (작은 꽃잎 조각)
            for (let i = 0; i < 4; i++) {
                const pAngle = (time * 2 + i * 90) * Math.PI / 180;
                const pDist = (isMain ? 35 : 28) + Math.sin(time * 3 + i) * 5;
                const px = centerX + Math.cos(pAngle) * pDist;
                const py = centerY + Math.sin(pAngle) * pDist;
                
                ctx.fillStyle = `rgba(255, 182, 193, ${0.6 + Math.sin(time * 4 + i) * 0.4})`;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
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
        // 스테이지 6 이후 적 크기 증가 (30% 키움: 75→98)
        const isStage6Plus = currentStage >= 6;
        // 가로모드에서 크기 75% 축소 (더 많은 적을 위한 공간 확보)
        const sizeScale = isMobileLandscapePlayMode() ? 0.75 : 1.0;
        this.width = Math.round((isStage6Plus ? 98 : 64) * sizeScale);
        this.height = Math.round((isStage6Plus ? 98 : 64) * sizeScale);

        const isHardMode = !isMobileLandscapePlayMode();
        const hpMultiplierA = isMobileEasyModeActive() ? EASY_MODE_CONFIG.enemyHpMultiplierA : (isHardMode ? 1.5 : 1);

        // ── 체력: 지수 커브 스케일링 (총 쏘는 속도 감소에 비례해 적절히 하향) ──
        // 너무 약해지지 않도록 체력 상향 조정
        const baseHp = 50;
        const stageBonus = Math.round(Math.pow(currentStage - 1, 2.1) * 20);
        this.hp = Math.round((baseHp + stageBonus) * hpMultiplierA);
        this.maxHp = this.hp;

        const gameSpeed = getMobileGameSpeedMultiplier();
        // 속도: STG1:2.15, STG5:3.05, STG10:4.5
        const baseSpeed = 2.0 + currentStage * 0.25;
        this.speed = isMobileEasyModeActive()
            ? baseSpeed * EASY_MODE_CONFIG.enemySpeedMultiplier * gameSpeed
            : (isHardMode ? baseSpeed * 1.2 : baseSpeed);
        this.active = true;
        this.state = 'WALK';
        this.aniFrame = 0; this.lastFrameTime = 0; this.frameRate = 120;
        this.totalFrames = 6;

        // ── 공격 간격: 스테이지별 (완화됨) ──
        const enemyShootIntervalMultiplier = isMobileEasyModeActive()
            ? EASY_MODE_CONFIG.enemyShootIntervalMultiplier
            : (isHardMode ? 0.75 : 1);
        // STG1:4000ms, STG5:2800ms, STG8:2000ms, STG10:1600ms
        const baseInterval = Math.max(1600, 4000 - currentStage * 200);
        const randomInterval = Math.max(600, 2000 - currentStage * 100);
        this.lastShootTime = 0;
        this.shootInterval = (baseInterval + Math.random() * randomInterval) * enemyShootIntervalMultiplier;

        // ── 스테이지별 공격 패턴 등급 ──
        // 0:단발, 1:산탄(STG10 최종장만)
        this.attackGrade = currentStage >= 10 ? 1 : 0;
        this.burstCount = 0; // 연사 남은 횟수
        this.burstTimer = 0; // 연사 타이머
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
                if (this.state !== 'DEAD' && !isGodMode) {
                    Player.takeDamage(1); // takeDamage 사용
                } else if (this.state !== 'DEAD' && isGodMode) {
                    AudioManager.playSFX('powerup');
                }
            }

            // ── 연사 패턴 처리 ─────────────────────────────
            if (this.burstCount > 0 && timestamp - this.burstTimer > 180) {
                this.burstTimer = timestamp;
                this.burstCount--;
                this._fireSingleBullet(timestamp);
            }

            // ── 공격 트리거 ────────────────────────────────
            if (stage.enemyShoot && timestamp - this.lastShootTime > this.shootInterval && this.x < GAME_WIDTH - 100) {
                this.state = 'ATTACK'; this.aniFrame = 0; this.lastFrameTime = timestamp; this.lastShootTime = timestamp;

                const enemyProjSpeedMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.gameSpeedMultiplier : 1.0;
                const targetX = Player.x + Player.width / 2;
                const targetY = Player.y + Player.height / 2;
                const dx = targetX - this.x;
                const dy = targetY - (this.y + this.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const spd = (7 + currentStage * 0.3) * enemyProjSpeedMultiplier;

                if (this.attackGrade >= 3) {
                    // 포위 사격: 조준 + 위아래 2발 추가 (3방향)
                    const angles = [0, -0.35, 0.35];
                    angles.forEach(aOff => {
                        const baseAngle = Math.atan2(dy, dx);
                        const b = new Projectile(this.x, this.y + this.height / 2,
                            Math.cos(baseAngle + aOff) * spd,
                            Math.sin(baseAngle + aOff) * spd, 0);
                        b.isEnemyBullet = true; b.width = 16; b.height = 16;
                        b.lifeDamage = 1;
                        projectiles.push(b);
                    });
                } else if (this.attackGrade >= 2) {
                    // 3연사: 첫 발 즉시 + 나머지 burstCount로 처리
                    this._fireSingleBullet(timestamp);
                    this.burstCount = 2;
                    this.burstTimer = timestamp;
                } else if (this.attackGrade >= 1) {
                    // 산탄: 조준 + 위아래 각 15도 2발
                    const baseAngle = Math.atan2(dy, dx);
                    [-0.26, 0, 0.26].forEach(aOff => {
                        const b = new Projectile(this.x, this.y + this.height / 2,
                            Math.cos(baseAngle + aOff) * spd,
                            Math.sin(baseAngle + aOff) * spd, 0);
                        b.isEnemyBullet = true; b.width = 14; b.height = 14;
                        projectiles.push(b);
                    });
                } else {
                    // 단발 조준 사격
                    const bullet = new Projectile(this.x, this.y + this.height / 2,
                        (dx / dist) * spd, (dy / dist) * spd, 0);
                    bullet.isEnemyBullet = true; bullet.width = 16; bullet.height = 16;
                    projectiles.push(bullet);
                }
            }

            const isEnemy2or3 = currentStage >= 4;
            const hitboxMargin = isEnemy2or3 ? 15 : 0; // 청토끼 2,3는 15px 여백으로 피격 범위 축소
            
            // hitbox margin이 적용된 임시 hitbox 객체 생성
            const hitbox = {
                x: this.x + hitboxMargin,
                y: this.y + hitboxMargin,
                width: this.width - hitboxMargin * 2,
                height: this.height - hitboxMargin * 2
            };
            
            if (checkCollision(hitbox, Player) && Player.shield <= 0) {
                this.state = 'ATTACK'; this.aniFrame = 0; this.lastFrameTime = timestamp;
                Player.takeDamage(1); // takeDamage 사용
            }
        }
        if (timestamp - this.lastFrameTime > this.frameRate) {
            this.aniFrame++; this.lastFrameTime = timestamp;
            // 적 타입별/상태별 프레임 수 최적화 (죽는 모션이 부정확하다는 피드백 반영)
            let maxFrames = this.totalFrames;
            if (this.state === 'DEAD') {
                if (currentStage >= 8) {
                    maxFrames = 4; // 청토끼 3: 4프레임
                } else if (currentStage >= 4) {
                    maxFrames = 4; // 청토끼 2: 4프레임 (5번째 프레임에 잘못된 이미지 제거)
                }
            }
            if (this.aniFrame >= maxFrames) {
                if (this.state === 'DEAD') this.active = false;
                else if (this.state === 'ATTACK') this.state = 'WALK';
                this.aniFrame = 0;
            }
        }
    }
    // 단발 조준 사격 헬퍼 (연사 패턴에서 재사용)
    _fireSingleBullet(timestamp) {
        const targetX = Player.x + Player.width / 2;
        const targetY = Player.y + Player.height / 2;
        const dx = targetX - this.x;
        const dy = targetY - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spd = (7 + currentStage * 0.3) * (isMobileEasyModeActive() ? EASY_MODE_CONFIG.gameSpeedMultiplier : 1.0);
        const bullet = new Projectile(this.x, this.y + this.height / 2,
            (dx / dist) * spd, (dy / dist) * spd, 0);
        bullet.isEnemyBullet = true; bullet.width = 14; bullet.height = 14;
        projectiles.push(bullet);
    }
    draw(ctx) {

        // 스테이지별로 다른 적 이미지 사용
        let enemyAssetKey = 'enemy';
        let cols = 7; // 7열 그리드
        let rows = 3;  // 3행 그리드

        if (currentStage >= 8) {
            enemyAssetKey = 'enemy3';
        } else if (currentStage >= 4) {
            enemyAssetKey = 'enemy2';
        }

        // 청토끼 2, 3: 정확한 피격 판정을 위한 hitbox margin
        const isEnemy2or3 = enemyAssetKey === 'enemy2' || enemyAssetKey === 'enemy3';
        const hitboxMargin = isEnemy2or3 ? 15 : 0;

        const img = ImageLoader.get(enemyAssetKey);
        if (img) {
            const frameW = img.width / cols;
            const frameH = img.height / rows;

            // 애니메이션 행 매핑 (3x7 그리드 기준):
            // Row 0 (y=0):    WALK - 걷기/대기 모션 (6프레임: 1~6열)
            // Row 1 (y=213):  ATTACK - 공격 모션 (6프레임: 1~6열)
            // Row 2 (y=426):  DEAD - 죽음 모션 (청토끼2: 4프레임, 청토끼3: 4프레임)
            let rowIdx = this.state === 'ATTACK' ? 1 : (this.state === 'DEAD' ? 2 : 0);
            
            // 상태별 정확한 프레임 수 계산
            let stateFrameCount = this.totalFrames; // 기본 6프레임 (WALK, ATTACK)
            if (this.state === 'DEAD') {
                if (enemyAssetKey === 'enemy3') {
                    stateFrameCount = 4; // 청토끼 3 죽음: 4프레임 (1~4열)
                } else if (enemyAssetKey === 'enemy2') {
                    stateFrameCount = 4; // 청토끼 2 죽음: 4프레임 (1~4열만 사용, 5열 제거)
                }
            }
            const frameIdx = this.aniFrame % stateFrameCount;
            
            // SX 오프셋 조정 (왼쪽 이미지 침범 방지):
            // 청토끼 3: -15px (왼쪽 텍스트 레이블 회피)
            // 청토끼 2: 죽음 시 마지막 프레임에서 오른쪽 더미 제거를 위해 추가 조정
            let offsetX = 0;
            if (enemyAssetKey === 'enemy3') {
                offsetX = -15;
            } else if (enemyAssetKey === 'enemy2') {
                offsetX = -20; // 청토끼 2: 죽음 애니메이션 고정 오프셋
            }
            const sx = (frameIdx + 1) * frameW + offsetX;
            const sy = rowIdx * frameH;

            // 이미지 보정: 픽셀 아트 가독성을 위해 소수점 좌표 제거 및 여백 최적화
            const margin = frameW * 0.05; // 5% 기본 여백 (모든 적 통일)
            
            ctx.save();

            // 선명한 해상도를 위해 이미지 스무딩 비활성화
            ctx.imageSmoothingEnabled = false;

            ctx.translate(Math.round(this.x + this.width / 2), Math.round(this.y + this.height / 2));
            ctx.scale(-1, 1);

            // 원본 비율 유지하며 그리기
            const aspect = (frameH - margin * 2) / (frameW - margin * 2);
            const drawW = this.width;
            const drawH = drawW * aspect;

            ctx.drawImage(
                img,
                Math.floor(sx + margin),
                Math.floor(sy + margin),
                Math.floor(frameW - margin * 2),
                Math.floor(frameH - margin * 2),
                Math.round(-drawW / 2),
                Math.round(-drawH / 2),
                Math.round(drawW),
                Math.round(drawH)
            );

            ctx.imageSmoothingEnabled = true;
            ctx.restore();
        }
        // 적 체력 바 (상단에 표시)
        if (this.state !== 'DEAD') {
            const barW = 50; const barH = 4;
            const bx = this.x + (this.width - barW) / 2;
            const by = this.y - 15;
            const clampedHp = Math.max(0, Math.min(this.hp, this.maxHp));
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
        const halfHeight = GAME_HEIGHT / 2;
        // 공격력/사격속도 비중 대폭 상향 (프롬프트 반영)
        const types = [
            { type: 'FIRE_RATE', value: 30, text: 'SPEED UP', color: '#3498db', icon: 'gun' },
            { type: 'FIRE_RATE', value: 30, text: 'SPEED UP', color: '#3498db', icon: 'gun' },
            { type: 'DAMAGE', value: 10, text: 'POWER UP', color: '#2ecc71', icon: 'sword' },
            { type: 'DAMAGE', value: 10, text: 'POWER UP', color: '#2ecc71', icon: 'sword' },
            { type: 'DEFENSE', value: 1, text: 'DEFENSE UP', color: '#95a5a6', icon: 'defense' },
            { type: 'HEAL', value: 2, text: 'REPAIR', color: '#e74c3c', icon: 'heart' },
            { type: 'SHIELD', value: 15000, text: 'SHIELD', color: '#9b59b6', icon: 'shield' },
            { type: 'ULTIMATE', value: 1, text: 'BOMB', color: '#f1c40f', icon: 'bomb' },
            { type: 'COIN', value: 1000, text: '+1000', color: '#ffd700', icon: 'coin' }
        ];

        // 스테이지 5부터 지원군 스킬 게이트 등장
        if (currentStage >= 5) {
            types.push({ type: 'SUPPORT', value: 20000, text: 'SUPPORT', color: '#e67e22', icon: 'support' });
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
        let expMultiplier = (LevelSystem.items.DAMAGE && LevelSystem.items.DAMAGE.level >= LevelSystem.itemMaxLevel) ? 10 : 1;

        if (gatePart.type === 'FIRE_RATE') {
            // 공격속도 아이템: 경험치 15씩 획득 (50 EXP = 1레벨)
            const expGained = 15 * expMultiplier;
            const status = LevelSystem.addItemExp('FIRE_RATE', expGained);
            const leveledUp = status === true;
            const isMax = status === "MAX_EXP";
            const newLevel = LevelSystem.items.FIRE_RATE.level;
            const item = LevelSystem.items.FIRE_RATE;

            // 스탯 직접 업데이트
            const baseFireRate = 200;
            const itemFireRateBonus = (newLevel - 1) * LevelSystem.stats.itemFireRatePerLevel;
            Player.fireRate = Math.max(baseFireRate - itemFireRateBonus, Player.minFireRate);

            // 레벨업 시 또는 최고 레벨 EXP 획득 시 표시
            if (leveledUp) {
                addFloatingText(`🔥 SPD Lv.${newLevel} UP!`, this.x, gatePart.y + gatePart.height / 2 - 10, "#3498db");
            } else if (isMax) {
                addFloatingText(`🔥 MAX LV EXP +${expGained}`, this.x, gatePart.y + gatePart.height / 2 - 10, "#3498db");
            }
            AudioManager.playSFX('powerup');
        } else if (gatePart.type === 'DAMAGE') {
            // 공격력 아이템: EXP 15씩 획득 (50 EXP = 1레벨)
            const expGained = 15 * expMultiplier;
            const status = LevelSystem.addItemExp('DAMAGE', expGained);
            const leveledUp = status === true;
            const isMax = status === "MAX_EXP";
            const newLevel = LevelSystem.items.DAMAGE.level;
            const item = LevelSystem.items.DAMAGE;

            // 스탯 직접 업데이트
            const baseDamage = 10;
            const itemDamageBonus = (newLevel - 1) * LevelSystem.stats.itemDamagePerLevel;
            Player.damage = Math.round(baseDamage + itemDamageBonus);

            if (leveledUp) {
                addFloatingText(`⚔️ ATK Lv.${newLevel} UP!`, this.x, gatePart.y + gatePart.height / 2 - 10, "#2ecc71");
            } else if (isMax) {
                addFloatingText(`⚔️ MAX LV EXP +${expGained}`, this.x, gatePart.y + gatePart.height / 2 - 10, "#2ecc71");
            }
            AudioManager.playSFX('powerup');
        } else if (gatePart.type === 'DEFENSE') {
            // 방어력 아이템
            const expGained = 15 * expMultiplier;
            const status = LevelSystem.addItemExp('DEFENSE', expGained);
            const leveledUp = status === true;
            const newLevel = LevelSystem.items.DEFENSE.level;
            if (leveledUp) {
                addFloatingText(`🛡️ DEF Lv.${newLevel} UP!`, this.x, gatePart.y + gatePart.height / 2 - 10, "#95a5a6");
            }
            AudioManager.playSFX('powerup');
        } else if (gatePart.type === 'HEAL') {
            // 회복: 즉시 체력 회복
            const healAmount = 2;
            Player.hp = Math.min(Player.hp + healAmount, Player.maxHp);
            addFloatingText(`❤️ +${healAmount}`, this.x, gatePart.y + gatePart.height / 2, '#e74c3c');
            AudioManager.playSFX('powerup');
        } else if (gatePart.type === 'SHIELD') {
            // 무적 아이템: 경험치 15씩 획득 (50 EXP = 1레벨)
            const expGained = 15 * expMultiplier;
            const leveledUp = LevelSystem.addItemExp('SHIELD', expGained);
            if (leveledUp) {
                addFloatingText(`🛡️ SHIELD Lv.${LevelSystem.items.SHIELD.level} UP!`, this.x, gatePart.y + gatePart.height / 2, "#9b59b6");
            }
            LevelSystem.applyShield();
            AudioManager.playSFX('shield');
        } else if (gatePart.type === 'ULTIMATE') {
            // 폭탄: 즉시 효과
            if (Player.bombCount >= 5) { isBonus = true; bonusScore = 2000; }
            else { Player.bombCount++; AudioManager.playSFX('bomb'); }
        } else if (gatePart.type === 'COIN') {
            // 코인 아이템: 플레이어 EXP 즉시 획득 (50 EXP)
            const expGained = 50 * expMultiplier;
            const prevLevel = LevelSystem.playerLevel;
            LevelSystem.addPlayerExp(expGained);
            const newLevel = LevelSystem.playerLevel;

            if (newLevel > prevLevel) {
                addFloatingText(`★ LV UP! Lv.${newLevel} ★`, this.x, gatePart.y + gatePart.height / 2 - 20, '#f1c40f');
            } else {
                addFloatingText(`⭐ EXP +${expGained} (${LevelSystem.playerExp}/${LevelSystem.playerExpToNext})`, this.x, gatePart.y + gatePart.height / 2, '#ffd700');
            }
            AudioManager.playSFX('powerup');
        } else if (gatePart.type === 'SUPPORT') {
            // 지원군 아이템: 경험치 15씩 획득 (50 EXP = 1레벨)
            const expGained = 15 * expMultiplier;
            const leveledUp = LevelSystem.addItemExp('SUPPORT', expGained);
            if (leveledUp) {
                addFloatingText(`👥 SUPPORT Lv.${LevelSystem.items.SUPPORT.level} UP!`, this.x, gatePart.y + gatePart.height / 2, "#e67e22");
            }
            LevelSystem.applySupport();
            AudioManager.playSFX('powerup');
        }

        if (isBonus) {
            score += bonusScore;
            // 보너스도 EXP로 변환 (10 EXP)
            const bonusExp = 10 * expMultiplier;
            LevelSystem.addPlayerExp(bonusExp);
            addFloatingText(`BONUS! +${bonusScore} (+${bonusExp} EXP)`, this.x, gatePart.y + gatePart.height / 2, "#f1c40f");
            AudioManager.playSFX('powerup');
        }

        createExplosion(this.x + this.width / 2, gatePart.y + gatePart.height / 2, gatePart.color);
    }
    draw(ctx) {
        this.drawGateStructure(ctx, this.topGate);
        this.drawGateStructure(ctx, this.bottomGate);
    }
    drawGateStructure(ctx, gate) {
        const x = this.x; const y = gate.y; const w = this.width; const h = gate.height;
        const time = Date.now();
        const stage = currentStage;

        ctx.save();

        // 스테이지별 테마 결정
        if (stage <= 3) {
            this.drawScrapGate(ctx, x, y, w, h, gate.color, time);
        } else if (stage <= 6) {
            this.drawMilitaryGate(ctx, x, y, w, h, gate.color, time);
        } else {
            this.drawSubwayGate(ctx, x, y, w, h, gate.color, time);
        }

        // 아이콘 및 텍스트 (공통 레이어)
        ctx.translate(x + w / 2, y + h / 2);
        this.drawPixelIcon(ctx, gate.icon, -15, -45, 30);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText(gate.text, 0, 28);
        ctx.restore();
    }

    // 테마 1: 생존형 고철 게이트 (Stage 1-3) - 고급화
    drawScrapGate(ctx, x, y, w, h, color, time) {
        // 배경 (부식된 철판 질감)
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(x, y, w, h);

        // 픽셀 노이즈/녹 (Rust)
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#3e2723' : '#6d4c41';
            ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 4, 4);
        }

        // 나무 판자 (결이 살아있는 도트 아트)
        for (let i = 15; i < h - 25; i += 35) {
            ctx.fillStyle = '#3e2723'; // 어두운 나무
            ctx.fillRect(x - 8, y + i, w + 16, 18);

            // 나뭇결 (Highlights)
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(x - 4, y + i + 4, w + 8, 2);
            ctx.fillRect(x + 10, y + i + 10, 20, 2);

            // 박힌 못 (Metallic Pins)
            ctx.fillStyle = '#9e9e9e';
            ctx.fillRect(x - 4, y + i + 6, 3, 3);
            ctx.fillRect(x + w + 1, y + i + 6, 3, 3);
        }

        // 가시철사 (정교한 픽셀 와이어)
        ctx.strokeStyle = '#757575';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < h; i += 8) {
            const ox = Math.sin(i * 0.4 + time / 500) * 4;
            ctx.lineTo(x + ox, y + i);
            if (i % 16 === 0) { // 가시 (Barbs)
                ctx.moveTo(x + ox - 4, y + i); ctx.lineTo(x + ox + 4, y + i);
            }
        }
        ctx.stroke();

        // 흘러내린 피 (Weathered Blood)
        ctx.fillStyle = '#800000';
        ctx.fillRect(x + w - 12, y + 40, 4, 30);
        ctx.fillRect(x + w - 16, y + 65, 8, 4);

        // 조명 (플리커링 램프)
        const flicker = Math.random() > 0.98 ? 0.2 : 1.0;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8 * flicker;
        ctx.shadowBlur = 10 * flicker;
        ctx.shadowColor = color;
        ctx.fillRect(x + w / 2 - 15, y + 2, 30, 4);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    // 테마 2: 군사용 철제 게이트 (Stage 4-6) - 고급화
    drawMilitaryGate(ctx, x, y, w, h, color, time) {
        // 배경 (강화 강철)
        ctx.fillStyle = '#263238';
        ctx.fillRect(x, y, w, h);

        // 경고 스트라이프 (Yellow/Black Strips)
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(x, y, w, 8);
        ctx.fillRect(x, y + h - 8, w, 8);
        ctx.fillStyle = '#000';
        for (let i = 0; i < w; i += 16) {
            ctx.beginPath();
            ctx.moveTo(x + i, y); ctx.lineTo(x + i + 8, y); ctx.lineTo(x + i, y + 8); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + i, y + h - 8); ctx.lineTo(x + i + 8, y + h - 8); ctx.lineTo(x + i, y + h); ctx.fill();
        }

        // 중앙 패널 (철제 질감 하이라이트)
        ctx.fillStyle = '#37474f';
        ctx.fillRect(x + 6, y + 15, w - 12, h - 30);

        // 긁힌 자국 (Scratches)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 40); ctx.lineTo(x + 50, y + 60);
        ctx.moveTo(x + 10, y + h - 40); ctx.lineTo(x + 30, y + h - 20);
        ctx.stroke();

        // "KEEP OUT" 스텐실 (정교한 픽셀 폰트 스타일)
        ctx.fillStyle = '#c0392b';
        ctx.font = 'bold 10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('KEEP', x + w / 2, y + h - 45);
        ctx.fillText('OUT', x + w / 2, y + h - 28);

        // 군용 조명 (적색 경고등)
        const lightOn = time % 1000 < 500;
        ctx.fillStyle = lightOn ? '#ff0000' : '#4a0000';
        ctx.fillRect(x + 4, y + 10, 6, 6);
        ctx.fillRect(x + w - 10, y + 10, 6, 6);
    }

    // 테마 3: 지하철 셔터 게이트 (Stage 7+) - 고급화
    drawSubwayGate(ctx, x, y, w, h, color, time) {
        // 배경
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(x, y, w, h);

        // 셔터 날 (Slats - 그림자 포함)
        for (let i = 0; i < h; i += 8) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x + 2, y + i, w - 4, 4);
            ctx.fillStyle = '#222';
            ctx.fillRect(x + 2, y + i + 4, w - 4, 4);
        }

        // 그라피티 (Graffiti Art)
        ctx.fillStyle = 'rgba(155, 89, 182, 0.4)';
        ctx.font = 'bold 14px Script';
        ctx.fillText('Z-ZONE', x + 25, y + h - 30);

        // 핏자국 손바닥 (Handprints - 픽셀 디테일)
        ctx.fillStyle = 'rgba(128, 0, 0, 0.6)';
        const hx = x + 12; const hy = y + h / 2;
        ctx.fillRect(hx, hy, 12, 14); // 손바닥
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(hx + i * 2.5, hy - 10 + (i === 2 ? -2 : 0), 2, 10);
        }

        // 지하철 네온 사인 (Flickering SUBWAY)
        const flicker = Math.random() > 0.96 ? 0.3 : 1.0;
        ctx.fillStyle = '#00d2ff';
        ctx.globalAlpha = flicker;
        ctx.shadowBlur = 15 * flicker;
        ctx.shadowColor = '#00d2ff';
        ctx.font = 'bold 9px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('SUBWAY', x + w / 2, y + 18);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // 사이드 레일 및 오일 스테인
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, 6, h);
        ctx.fillRect(x + w - 6, y, 6, h);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 6, y + h - 15, 15, 10);
    }

    drawPixelIcon(ctx, type, x, y, size) {
        // 닌텐도 스타일의 더 명확하고 플랫한 아이콘 (시인성 강화)
        ctx.save();
        ctx.translate(x, y);

        // 아이콘 외곽선 및 기본 색상 설정
        ctx.fillStyle = '#000';

        if (type === 'gun') {
            // 공격력 강화 (총)
            ctx.fillRect(0, 15, 30, 12); ctx.fillRect(5, 27, 8, 10);
            ctx.fillStyle = '#fff'; ctx.fillRect(2, 17, 26, 8);
        } else if (type === 'sword') {
            // 공격 속도 (검)
            ctx.fillRect(12, 0, 8, 35); ctx.fillRect(0, 25, 32, 6);
            ctx.fillStyle = '#fff'; ctx.fillRect(14, 2, 4, 23);
        } else if (type === 'heart') {
            // 체력 회복 (하트)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(4, 0, 8, 8); ctx.fillRect(20, 0, 8, 8);
            ctx.fillRect(0, 8, 32, 12); ctx.fillRect(4, 20, 24, 8); ctx.fillRect(12, 28, 8, 6);
            ctx.fillStyle = '#fff'; ctx.fillRect(6, 4, 4, 4);
        } else if (type === 'shield') {
            // 쉴드업 (방패 - 명확한 V자형)
            ctx.fillStyle = '#3498db'; // 진한 파랑
            ctx.fillRect(0, 0, 32, 20);
            ctx.beginPath();
            ctx.moveTo(0, 20); ctx.lineTo(16, 35); ctx.lineTo(32, 20); ctx.fill();
            // 내부 십자 패턴 (방패 강조)
            ctx.fillStyle = '#fff';
            ctx.fillRect(14, 5, 4, 15);
            ctx.fillRect(8, 10, 16, 4);
        } else if (type === 'defense') {
            // 방어력업 (은색 금속 방패 - 각진 형태)
            ctx.fillStyle = '#bdc3c7'; // 실버/스틸 컬러
            ctx.fillRect(2, 0, 28, 24);
            ctx.beginPath();
            ctx.moveTo(2, 24); ctx.lineTo(16, 36); ctx.lineTo(30, 24); ctx.fill();
            // 내부 테두리 (금속 느낌)
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 3;
            ctx.strokeRect(6, 4, 20, 16);
            // 중앙 강화 징 (Stud)
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(14, 12, 4, 4);
        } else if (type === 'support') {
            // 서포트 (3인 지원대 - 삼각형 위상 구조로 명확히 구분)
            ctx.fillStyle = '#e67e22'; // 주황색 (지원/분대 컬러)

            // 중앙 대형 원형 (지휘 본체)
            ctx.beginPath();
            ctx.arc(16, 14, 10, 0, Math.PI * 2);
            ctx.fill();

            // 좌우 상위 보조 원 (2명의 지원군을 상징)
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(8, 8, 5, 0, Math.PI * 2);   // 좌측 상단
            ctx.arc(24, 8, 5, 0, Math.PI * 2);  // 우측 상단
            ctx.fill();

            // 하단 중앙 원 (3번째 지원군)
            ctx.beginPath();
            ctx.arc(16, 26, 5, 0, Math.PI * 2);
            ctx.fill();

            // 연결선 (팀워크/연합 표시)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(8, 8); ctx.lineTo(16, 14);   // 좌상단 -> 중앙
            ctx.moveTo(24, 8); ctx.lineTo(16, 14);  // 우상단 -> 중앙
            ctx.moveTo(16, 14); ctx.lineTo(16, 26); // 중앙 -> 하단
            ctx.stroke();

            // 중앙에 "3" 숫자 표시
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('3', 16, 18);
        } else if (type === 'bomb') {
            // 폭탄
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(16, 20, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(14, 0, 4, 10);
            ctx.fillStyle = '#fff'; ctx.fillRect(10, 15, 6, 6);
        } else if (type === 'coin') {
            // 코인 (금화)
            ctx.fillStyle = '#ffd700'; // 골드 색상
            ctx.beginPath();
            ctx.arc(16, 18, 14, 0, Math.PI * 2); // 외곽 원
            ctx.fill();
            ctx.strokeStyle = '#ffa500'; // 주황색 테두리
            ctx.lineWidth = 2;
            ctx.stroke();
            // 코인 내부 하이라이트
            ctx.fillStyle = '#ffeb3b'; // 밝은 노랑
            ctx.beginPath();
            ctx.arc(16, 18, 10, 0, Math.PI * 2);
            ctx.fill();
            // $ 기호
            ctx.fillStyle = '#b8860b'; // 어두운 골드
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('$', 16, 24);
        }
        ctx.restore();
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
            const scale = GAME_HEIGHT / bgImg.height;
            const w = bgImg.width * scale;
            const h = GAME_HEIGHT;

            // 전체 가로 이동 거리 (0 ~ 2w 범위로 루프)
            const totalOffset = Math.abs(this.roadLineOffset * 0.3) % (w * 2);

            // 화면 왼쪽 끝에서부터 오른쪽 끝까지 이미지를 채움
            let startX = -totalOffset;
            while (startX < GAME_WIDTH) {
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
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        // 요청사항: 하단 도로선 제거 및 배경 확장
        // 배경 이미지가 화면 전체를 채우도록 처리되었으므로 별도의 도로선은 그리지 않습니다.

        // 분위기 조성을 위한 하단 그라데이션 (배경과 자연스럽게 섞임)
        const roadGrad = ctx.createLinearGradient(0, GAME_HEIGHT * 0.7, 0, GAME_HEIGHT);
        roadGrad.addColorStop(0, 'rgba(0,0,0,0)');
        roadGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(0, GAME_HEIGHT * 0.7, GAME_WIDTH, GAME_HEIGHT * 0.3);

        const stage = getCurrentStageData(); // EASY MODE
        const fogColor = isAbyss ? '#450a0a' : stage.fog;
        this.drawFogLayer(ctx, fogColor);
    },
    drawFogLayer: function (ctx, color) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, GAME_HEIGHT * 0.5, 0, GAME_HEIGHT * 0.9);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, color + '44');
        ctx.fillStyle = grad;
        ctx.fillRect(0, GAME_HEIGHT * 0.5, GAME_WIDTH, GAME_HEIGHT * 0.4);
        ctx.restore();
    }
};

function advanceStage() {
    if (currentStage < 10) {
        currentStage++; enemiesKilled = 0; boss = null;
        // 다음 스테이지 스토리 표시
        currentState = GAME_STATE.STORY;
        storyStateEnterTime = Date.now();
        storyTypingIndex = 0;
        storyTextComplete = false;

        storyPages = [];
        storyCurrentPage = 0;
        storyTotalPages = 0;
        lastTypedCharIndex = 0;

        enemies = [];
        projectiles = [];
        gates = [];

        // 스테이지 진행 시에도 아이템 레벨 기준으로 스탯 유지 (초기화하지 않음)
        const baseDamage = 10;
        const itemDamageBonus = (LevelSystem.items.DAMAGE.level - 1) * LevelSystem.stats.itemDamagePerLevel;
        Player.damage = isMobileEasyModeActive()
            ? Math.round((baseDamage + itemDamageBonus) * EASY_MODE_CONFIG.playerDamageMultiplier)
            : baseDamage + itemDamageBonus;

        const baseFireRate = 200;
        const itemFireRateBonus = (LevelSystem.items.FIRE_RATE.level - 1) * LevelSystem.stats.itemFireRatePerLevel;
        Player.fireRate = Math.max(baseFireRate - itemFireRateBonus, Player.minFireRate);

        // 플레이어 상태 완전 초기화 (중요: state를 DEAD에서 ALIVE로 변경)
        // 체력 상한 재계산 (레벨업으로 증가한 체력 반영)
        const levelHpBonus = Math.floor((LevelSystem.playerLevel - 1) / 4);
        Player.maxHp = 5 + levelHpBonus;
        Player.hp = Player.maxHp;
        Player.state = 'ALIVE';
        Player.aniFrame = 0;
        Player.shield = 0;
        particles.push(...Array(30).fill(0).map(() => new Particle(GAME_WIDTH / 2, GAME_HEIGHT / 2, '#f1c40f')));

        // 오버레이 강제 숨김
        if (overlayStageClear) overlayStageClear.hidden = true;
    }
}

function startBossFight() {
    // 바로 보스전 시작
    currentState = GAME_STATE.BOSS_FIGHT;
    boss = new Boss(currentStage);
    
    // 보스 대사 표시 (있는 경우)
    const stageKey = Number(currentStage);
    const bossQuote = BOSS_QUOTES[stageKey];
    console.log(`[BOSS] Stage key: ${stageKey}, Quote: ${bossQuote ? 'FOUND' : 'NOT FOUND'}`);
    if (bossQuote) {
        // 화면 중앙에 보스 등장 알림 (더 길게 표시, 4초)
        addFloatingText(bossQuote, GAME_WIDTH / 2, GAME_HEIGHT / 3, '#ff0000');
        addFloatingText("💀 BOSS FIGHT START! 💀", GAME_WIDTH / 2, GAME_HEIGHT / 3 + 40, '#ff4444');
        
        // 보스 등장 텍스트 콘솔 출력 (디버깅용)
        console.log(`[BOSS APPEAR] Stage ${currentStage}: ${bossQuote}`);
        
        // 화면 플래시 효과
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle, rgba(255,0,0,0.4) 0%, transparent 60%);
            pointer-events: none; z-index: 9998;
            transition: opacity 0.8s; opacity: 1;
        `;
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = '0', 150);
        setTimeout(() => flash.remove(), 1000);
        
        // 보스 등장 사운드
        AudioManager.playSFX('powerup');
    } else {
        console.warn(`[BOSS APPEAR] No quote found for stage ${currentStage}`);
    }
}

function addSkillNotification(text, duration) {
    // 중복 알림 제거
    Player.skillNotifications = Player.skillNotifications.filter(n => n.text !== text);
    Player.skillNotifications.push({ text: text, timeLeft: duration });
}

function checkCollision(r1, r2) {
    if (!r1 || !r2) return false;
    return r1.x < r2.x + r2.width && r1.x + r2.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
}

// 기존 보스 (청토끼 보스.png) 스프라이트 매핑
const BOSS_SPRITE_MAP = {
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

// 청토끼 2 (enemy2.png) - 3x7 그리드, 개별 프레임 좌표 조정 가능
// 그리드: 7열 x 3행, 각 셀 140px
// 텍스트 열: Column 0 제외, Columns 1-6 사용
const ENEMY2_SPRITE_MAP = {
    WALK: {
        y: 0, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    },
    ATTACK: {
        y: 213, h: 213,
        hitFrame: 3, // 4번째 프레임(0-indexed)에서 공격 판정
        // 프레임 순서: [0]준비 → [1]뒤로 → [2]모으기 → [3]★공격★ → [4]뒤로 → [5]복귀
        frames: [
            { x: 300, w: 232 }, // [0] 준비 자세
            { x: 532, w: 232 }, // [1] 뒤로 빼기
            { x: 744, w: 232 }, // [2] 힘 모으기
            { x: 1100, w: 232 }, // [3] ★ 공격 순간 (hitFrame)
            { x: 1212, w: 232 }, // [4] 뒤로 물러나기
            { x: 1464, w: 232 }  // [5] 원위치 복귀
        ]
    },
    DEAD: {
        y: 426, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    }
};

// 청토끼 보스2 (boss2.png) - 청토끼 킹과 동일한 3x7 그리드 형식
const BOSS2_SPRITE_MAP = {
    WALK: {
        y: 0, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    },
    ATTACK: {
        y: 213, h: 213,
        hitFrame: 3, // 4번째 프레임(0-indexed)에서 공격 판정
        frames: [
            { x: 300, w: 232 }, // [0] 준비 자세
            { x: 532, w: 232 }, // [1] 뒤로 빼기
            { x: 764, w: 232 }, // [2] 힘 모으기
            { x: 1010, w: 232 }, // [3] ★ 공격 순간 (hitFrame)
            { x: 1232, w: 232 }, // [4] 뒤로 물러나기
            { x: 1464, w: 232 }  // [5] 원위치 복귀
        ]
    },
    DEAD: {
        y: 426, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    }
};

const BOSS_KING_SPRITE_MAP = {
    WALK: {
        y: 0, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    },
    ATTACK: {
        y: 213, h: 213,
        hitFrame: 4, // 5번째 프레임(0-indexed)에서 공격 판정
        // 프레임 순서: [0]준비 → [1]뒤로 → [2]모으기 → [3]낮추기 → [4]★공격★ → [5]복귀
        frames: [
            { x: 300, w: 232 }, // [0] 준비 자세
            { x: 552, w: 232 }, // [1] 뒤로 빼기
            { x: 764, w: 232 }, // [2] 힘 모으기
            { x: 1010, w: 232 }, // [3] 낮추기/정조준
            { x: 1252, w: 232 }, // [4] ★ 공격 순간 (hitFrame)
            { x: 1484, w: 232 }  // [5] 원위치 복귀
        ]
    },
    DEAD: {
        y: 426, h: 213,
        frames: [
            { x: 280, w: 232 }, { x: 512, w: 232 }, { x: 744, w: 232 },
            { x: 976, w: 232 }, { x: 1208, w: 232 }, { x: 1440, w: 232 }
        ]
    }
};

class Boss {
    constructor(level = 1) {
        this.x = GAME_WIDTH - 250; this.y = GAME_HEIGHT / 2 - 100;
        this.width = 200; this.height = 200; this.level = level;

        // 스테이지별 보스 타입 확인 (인스턴스 속성으로 저장)
        this.isBoss2 = currentStage >= 6 && currentStage < 9;
        this.isBossKing = currentStage >= 9; // 스테이지 9-10: 보스킹

        // 기본 체력 계산 (보스는 적보다 강하게 - 상향)
        const isHardMode = !isMobileLandscapePlayMode();
        let baseHp = 1800 * level + (level === 10 ? 8000 : 0);
        if (level >= 5) {
            baseHp = Math.floor(baseHp * 1.5); // 스테이지 5 이상부터 1.5배 상향
        }
        baseHp *= 3; // 보스 체력 3배 더 높게 상향 (요청사항 반영)
        const hardModeHpMultiplier = isHardMode ? 1.5 : 1; // 하드모드: 보스 체력 50% 증가

        // 보스킹: 20% 더 많은 체력, 보스2: 10% 더 많은 체력, 하드모드: 추가 50%
        if (this.isBossKing) {
            this.hp = Math.floor(baseHp * 1.2 * hardModeHpMultiplier);
        } else if (this.isBoss2) {
            this.hp = Math.floor(baseHp * 1.1 * hardModeHpMultiplier);
        } else {
            this.hp = Math.floor(baseHp * hardModeHpMultiplier);
        }
        this.maxHp = this.hp;

        const bossMoveMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossMoveScaleMultiplier : 1; // EASY MODE
        const gameSpeed = getMobileGameSpeedMultiplier();

        // 이동 속도: 보스킹 20% 증가, 보스2 10% 증가
        const baseSpeed = 3 + (level * 0.5);
        this.baseSpeed = baseSpeed; // 분노 모드용 기본 속도 저장
        if (this.isBossKing) {
            this.speedY = baseSpeed * 1.2 * bossMoveMultiplier * gameSpeed;
        } else if (this.isBoss2) {
            this.speedY = baseSpeed * 1.1 * bossMoveMultiplier * gameSpeed;
        } else {
            this.speedY = baseSpeed * bossMoveMultiplier * gameSpeed;
        }

        // 보스킹 분노 모드 (체력 50% 이하)
        this.rageMode = false;
        this.rageModeTriggered = false;

        this.active = true; this.state = 'WALK'; // EASY MODE
        this.aniFrame = 0; this.lastFrameTime = 0; this.lastAttackTime = 0;
        this.deathHandled = false;
    }
    update(timestamp) {
        if (!this.active) return;

        // 보스 타입별 스프라이트 매핑 선택 (인스턴스 속성 사용)
        let spriteMap = BOSS_SPRITE_MAP;
        if (this.isBossKing) spriteMap = BOSS_KING_SPRITE_MAP;
        else if (this.isBoss2) spriteMap = BOSS2_SPRITE_MAP;

        const deadFrameCount = spriteMap.DEAD.frames.length;
        const attackFrameCount = spriteMap.ATTACK.frames.length;
        const walkFrameCount = spriteMap.WALK.frames.length;

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

                        // 3초 후 자동으로 스테이지 진행 (사용자가 클릭하지 않아도 스토리가 나오도록)
                        setTimeout(() => {
                            if (currentState === GAME_STATE.STAGE_CLEAR) {
                                advanceStage();
                            }
                        }, 3000);
                    }
                }
            }
            return;
        }
        // 보스킹 분노 모드 체크 (체력 50% 이하)
        if (this.isBossKing && !this.rageModeTriggered && this.hp <= this.maxHp * 0.5) {
            this.rageMode = true;
            this.rageModeTriggered = true;
            // 분노 모드: 이동 속도 50% 증가
            const bossMoveMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossMoveScaleMultiplier : 1;
            const gameSpeed = getMobileGameSpeedMultiplier();
            this.speedY = this.baseSpeed * 1.8 * bossMoveMultiplier * gameSpeed; // 1.2 -> 1.8 (50% 증가)
            // 분노 모드 진입 알림
            addFloatingText('★ RAGE MODE ★', this.x + this.width / 2, this.y - 30, '#ff0000');
        }

        this.y += this.speedY; if (this.y < 50 || this.y + this.height > GAME_HEIGHT - 50) this.speedY *= -1;
        // 모바일에서는 보스 공격 속도 감소 (적정 수준)
        const bossAttackIntervalMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossAttackIntervalMultiplier : 1; // EASY MODE

        // 공격 간격: 보스는 더 공격적으로 (단축)
        // 보스킹 40% 더 빠름, 보스2 25% 더 빠름
        // 분노 모드: 공격 간격 추가 35% 감소
        // 하드모드: 공격 간격 추가 25% 감소
        const isHardMode = !isMobileLandscapePlayMode();
        const baseInterval = this.hp < 3000 ? 800 : 1400;
        let interval;
        if (this.isBossKing) {
            interval = baseInterval * 0.6; // 보스킹: 40% 더 빠른 공격
        } else if (this.isBoss2) {
            interval = baseInterval * 0.75; // 보스2: 25% 더 빠른 공격
        } else {
            interval = baseInterval;
        }
        // 하드모드: 공격 속도 25% 증가
        if (isHardMode) {
            interval *= 0.75;
        }
        // 분노 모드: 공격 속도 추가 35% 증가
        if (this.rageMode) {
            interval *= 0.65;
        }

        if (timestamp - this.lastAttackTime > interval * bossAttackIntervalMultiplier) {
            const p = Math.random();
            // 소환 가능 여부 - 스테이지 4부터 가능
            const canSummonMinions = currentStage >= 4;

            // 하드모드: 소환 확률 증가 (30% -> 40%)
            const isHardMode = !isMobileLandscapePlayMode();
            const summonThreshold = isHardMode ? 0.4 : 0.3;
            if (p < summonThreshold && canSummonMinions) {
                // 부하 소환 패턴
                // 보스킹: 3마리, 보스2: 2마리, 일반: 2마리, 하드모드: +1마리 추가
                let summonCount = this.isBossKing ? 3 : (this.isBoss2 ? 2 : 2);
                if (isHardMode) summonCount += 1; // 하드모드: 1마리 추가 소환
                for (let i = 0; i < summonCount; i++) {
                    const e = new Enemy(this.x, this.y + this.height / 2 + (i - Math.floor(summonCount / 2)) * 50);
                    const summonEnemySpeedMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossSummonEnemySpeedMultiplier : 1;
                    const summonEnemyHpMultiplier = isMobileEasyModeActive() ? EASY_MODE_CONFIG.bossSummonEnemyHpMultiplier : 1;
                    // 소환된 적: 빠르지만 체력은 낮게 (원래 500->150, 350->100, 200->80)
                    e.speed = (this.isBossKing ? 9 : (this.isBoss2 ? 7 : 5)) * summonEnemySpeedMultiplier;
                    e.hp = Math.round((this.isBossKing ? 150 : (this.isBoss2 ? 100 : 80)) * summonEnemyHpMultiplier);
                    e.maxHp = e.hp;
                    enemies.push(e);
                }
            } else if (p < 0.55) {
                // 보스 에너지 볼
                let bossProjSpeed = isMobileEasyModeActive() ?
                    (this.isBossKing ? 12 : (this.isBoss2 ? 9 : 6)) * EASY_MODE_CONFIG.bossProjectileSpeedMultiplier :
                    (this.isBossKing ? 12 : (this.isBoss2 ? 9 : 6));
                // 분노 모드: 탄환 속도 30% 증가
                if (this.rageMode) bossProjSpeed *= 1.3;
                const bossProjDamage = isMobileEasyModeActive() ?
                    (this.isBossKing ? 4 : (this.isBoss2 ? 3 : 2)) :
                    (this.isBossKing ? 5 : (this.isBoss2 ? 4 : 3));
                // 보스킹: 더 큰 에너지 볼 (75px)
                const projSize = this.isBossKing ? 75 : (this.isBoss2 ? 60 : 45);
                const b = new Projectile(this.x, this.y + this.height / 2, -bossProjSpeed, 0, 0);
                b.isBossEnergyBall = true;
                b.lifeDamage = bossProjDamage;
                b.width = projSize;
                b.height = projSize;
                projectiles.push(b);
            } else if (p < 0.8) {
                // 보스 산탄
                let bossScatterSpeed = isMobileEasyModeActive() ?
                    (this.isBossKing ? 14 : (this.isBoss2 ? 11 : 8)) * EASY_MODE_CONFIG.bossProjectileSpeedMultiplier :
                    (this.isBossKing ? 14 : (this.isBoss2 ? 11 : 8));
                // 분노 모드: 산탄 속도 25% 증가
                if (this.rageMode) bossScatterSpeed *= 1.25;
                // 보스킹: 7방향, 보스2: 5방향, 일반: 3방향
                let scatterCount = this.isBossKing ? 7 : (this.isBoss2 ? 5 : 3);
                // 분노 모드: 산탄 방향 2개 추가
                if (this.rageMode) scatterCount += 2;
                const angleStep = this.isBossKing ? 0.6 : (this.isBoss2 ? 0.8 : 1.5);
                const startAngle = -(scatterCount - 1) * angleStep / 2;
                for (let i = 0; i < scatterCount; i++) {
                    const angle = startAngle + i * angleStep;
                    const b = new Projectile(this.x, this.y + this.height / 2, -bossScatterSpeed, angle, 0);
                    b.isEnemyBullet = true;
                    b.lifeDamage = this.isBossKing ? 3 : (this.isBoss2 ? 2 : 1); // 보스킹 산탄 데미지 증가
                    projectiles.push(b);
                }
            } else if (this.isBossKing) {
                // 보스킹 전용: 5연속 에너지 볼 (더 빠른 간격)
                // 분노 모드: 7연속 발사로 증가
                const rapidCount = this.rageMode ? 7 : 5;
                const rapidInterval = this.rageMode ? 100 : 150; // 분노 모드: 더 빠른 간격
                for (let i = 0; i < rapidCount; i++) {
                    setTimeout(() => {
                        if (this.active && this.state !== 'DEAD') {
                            const speed = this.rageMode ? -16 : -13; // 분노 모드: 더 빠른 탄환
                            const b = new Projectile(this.x, this.y + this.height / 2, speed, 0, 0);
                            b.isBossEnergyBall = true;
                            b.lifeDamage = this.rageMode ? 5 : 4; // 분노 모드: 더 높은 데미지
                            b.width = 60; b.height = 60;
                            projectiles.push(b);
                        }
                    }, i * rapidInterval);
                }
            } else if (this.isBoss2) {
                // 보스2 전용: 연속 에너지 볼 (3연발)
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (this.active && this.state !== 'DEAD') {
                            const b = new Projectile(this.x, this.y + this.height / 2, -10, 0, 0);
                            b.isBossEnergyBall = true;
                            b.lifeDamage = 3;
                            b.width = 50; b.height = 50;
                            projectiles.push(b);
                        }
                    }, i * 200);
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
        // 이미지 선택 (인스턴스 속성 사용)
        let imgKey = 'boss';
        if (this.isBossKing) imgKey = 'bossKing';
        else if (this.isBoss2) imgKey = 'boss2';

        const img = ImageLoader.get(imgKey);
        if (img) {
            // 보스 타입별 스프라이트 매핑 선택 (인스턴스 속성 사용)
            let spriteMap = BOSS_SPRITE_MAP;
            let scale = 1.25;
            if (this.isBossKing) {
                spriteMap = BOSS_KING_SPRITE_MAP;
                scale = 1.5;
            } else if (this.isBoss2) {
                spriteMap = BOSS2_SPRITE_MAP;
                scale = 1.35;
            }

            // 스프라이트 애니메이션 좌표 계산
            const animSet = spriteMap[this.state] || spriteMap.WALK;
            const frame = animSet.frames[this.aniFrame % animSet.frames.length];
            let frameW = frame.w;
            let frameH = animSet.h;
            let sx = frame.x;
            let sy = animSet.y;

            // === 크기 고정: 모든 프레임에서 동일한 보스 크기 ===
            // 기준 크기(프레임별 w/h 무시, 항상 동일한 drawW/drawH)
            const fixedDrawW = 250 * scale; // 원하는 고정 너비(px)
            const fixedDrawH = 145 * scale; // 원하는 고정 높이(px)
            const anchorY = this.y + this.height;
            const drawCenterX = this.x + this.width / 2;

            ctx.save();
            ctx.translate(drawCenterX, anchorY - fixedDrawH / 2);
            ctx.scale(-1, 1);

            // 보스2/보스킹 특수 효과
            if (this.isBoss2 || this.isBossKing) {
                // 사망 시 투명도 효과
                if (this.state === 'DEAD') {
                    ctx.globalAlpha = Math.max(0.3, 1 - this.aniFrame * 0.1);
                }
                // 공격 시 붉은색 글로우 효과
                if (this.state === 'ATTACK') {
                    ctx.shadowBlur = this.isBossKing ? 30 : 20;
                    ctx.shadowColor = '#ff0000';
                }
                // 분노 모드: 지속적인 붉은 글로우
                if (this.rageMode) {
                    ctx.shadowBlur = 20 + Math.sin(Date.now() / 100) * 10;
                    ctx.shadowColor = '#ff0000';
                }
            }

            ctx.drawImage(
                img,
                sx, sy, frameW, frameH,
                -fixedDrawW / 2, -fixedDrawH / 2, fixedDrawW, fixedDrawH
            );
            ctx.restore();
        }
        // 보스 체력 바 (정교한 픽셀 프레임)
        const bx = GAME_WIDTH / 2 - 200; const by = 70; const bw = 400; const bh = 20;
        const bossHpClamped = Math.max(0, Math.min(this.hp, this.maxHp));
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
        ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh);
        // 분노 모드: 체력바 색상 변경 (핏빛 레드)
        if (this.rageMode) {
            ctx.fillStyle = '#ff0000';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0000';
        } else {
            ctx.fillStyle = '#ff4757';
            ctx.shadowBlur = 0;
        }
        ctx.fillRect(bx, by, (bossHpClamped / this.maxHp) * bw, bh);
        ctx.shadowBlur = 0; // 리셋
        ctx.strokeStyle = this.rageMode ? '#ff0000' : '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Press Start 2P"'; ctx.textAlign = 'center';
        // 스테이지별 보스 이름
        let bossName;
        if (currentStage >= 9) {
            bossName = 'BOSS: BLUE RABBIT KING';
        } else if (currentStage >= 6) {
            bossName = 'BOSS: BLUE RABBIT EVOLVED';
        } else {
            bossName = 'BOSS: BLUE RABBIT';
        }
        // ctx.fillText(bossName, GAME_WIDTH / 2, by + 15);
    }
}

function spawnEnemyWave() {
    if (isMobileEasyModeActive() && enemies.filter(e => e.active && e.state !== 'DEAD').length >= EASY_MODE_CONFIG.maxActiveEnemies) return; // EASY MODE
    const stage = getCurrentStageData(); // EASY MODE
    // 가로 모드에서 적들이 더 오른쪽에서 생성되고 더 느리게 이동
    const isLandscape = window.innerWidth > window.innerHeight;
    const spawnOffset = isLandscape ? 150 : 50; // 가로 모드: 더 오른쪽에서 생성
    const e = new Enemy(GAME_WIDTH + spawnOffset, Math.random() * (GAME_HEIGHT - 100) + 50);
    // 가로 모드에서 적 속도 50% 감소
    const landscapeSpeedMultiplier = isLandscape ? 0.5 : 1;
    e.speed = stage.enemySpeed * landscapeSpeedMultiplier;
    enemies.push(e);
}

function createExplosion(x, y, color = '#e74c3c') {
    // 모바일(가로/이지모드)일 때 파티클 개수를 줄여 CPU/GPU 연산 부하를 획기적으로 최적화
    const count = isMobileEasyModeActive() ? 6 : 15;
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}
function usePetalCannon() {
    if (!Player.petalCannonReady) {
        // 아직 충전 안됨
        const remaining = Player.petalCannonMaxCharge - Player.petalCannonCharge;
        addFloatingText(`🌸 충전중... (${remaining}발 남음)`, Player.x, Player.y - 40, '#ff69b4');
        return;
    }
    
    // 꽃잎 포 발사!
    Player.petalCannonReady = false;
    Player.petalCannonCharge = 0;
    
    // 꽃잎포 전용 강력한 발사 모션 및 반동 적용 (뒤로 크게 밀려남)
    Player.recoilX = -15; 
    Player.petalFiringTimer = 300; // 300ms 동안 특수 렌더링 상태 유지
    AudioManager.playSFX('shoot'); // 꽃잎포 고유 효과음이나 발사음 재생
    
    const isLandscape = isMobileEasyModeActive(); // 가로(이지) 모드 여부
    
    // 가로 모드에서는 파워를 일반 환경과 동일하게 조정 (데미지 0.5배, 투사체 수 감소로 렉 방지)
    const playerLevel = LevelSystem.playerLevel;
    const basePetalDamage = isLandscape ? 60 : 240; // 렉 개선을 위해 투사체를 줄인 대신 화력 대폭 상향
    const levelMultiplier = 1 + (playerLevel - 1) * 0.5; // 레벨당 보너스 상향 (0.25 -> 0.5)
    const petalDamage = Math.round(basePetalDamage * levelMultiplier);
    
    // 가로 모드: 렉을 유발하지 않도록 꽃잎포 투사체 개수를 대폭 하향 (렉 방지 극대화)
    const petalCount = isLandscape
        ? 3 + Math.min(playerLevel, 2)          // 가로 모드: 최대 5발 (렉 차단)
        : 4 + Math.min(playerLevel, 2);         // 일반 모드: 렉 개선을 위해 최대 6발로 대폭 하향
    const spreadAngle = Math.PI / 4;
    
    // 중앙 메인 꽃잎
    const mainPetal = new Projectile(Player.x + Player.width, Player.y + Player.height / 2, 20, 0, petalDamage * 2);
    mainPetal.isPetalCannon = true;
    mainPetal.isMainPetal = true;
    mainPetal.width = isLandscape ? 45 : 60;
    mainPetal.height = isLandscape ? 45 : 60;
    mainPetal.active = true;
    projectiles.push(mainPetal);
    
    // 주변 꽃잎들
    for (let i = 0; i < petalCount; i++) {
        const angleOffset = (i / (petalCount - 1) - 0.5) * spreadAngle;
        const speed = isLandscape ? 15 : 18;
        const vx = Math.cos(angleOffset) * speed;
        const vy = Math.sin(angleOffset) * speed;
        
        const petal = new Projectile(Player.x + Player.width, Player.y + Player.height / 2, vx, vy, petalDamage);
        petal.isPetalCannon = true;
        petal.width = isLandscape ? 35 : 45;
        petal.height = isLandscape ? 35 : 45;
        petal.active = true;
        petal.petalIndex = i;
        projectiles.push(petal);
    }
    
    // 나선형 꽃잎 (가로 모드: 렉을 최소화하기 위해 나선형 투사체 0개로 설정, 일반: 2개로 줄임)
    const spiralCount = isLandscape ? 0 : 2;
    for (let i = 0; i < spiralCount; i++) {
        const angle = (i % 2 === 0 ? 1 : -1) * (Math.PI / 6 + i * 0.2);
        const speed = isLandscape ? 13 : 16;
        const vx = Math.cos(angle) * speed * 0.8;
        const vy = Math.sin(angle) * speed;
        
        const spiralPetal = new Projectile(Player.x + Player.width, Player.y + Player.height / 2, vx, vy, petalDamage * 1.5);
        spiralPetal.isPetalCannon = true;
        spiralPetal.isSpiral = true;
        spiralPetal.width = isLandscape ? 38 : 50;
        spiralPetal.height = isLandscape ? 38 : 50;
        spiralPetal.active = true;
        projectiles.push(spiralPetal);
    }
    
    // 화면 플래시 효과 (가로 모드: 경량화)
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: radial-gradient(circle at ${Player.x + Player.width/2}px ${Player.y + Player.height/2}px, 
            rgba(255, 105, 180, ${isLandscape ? 0.5 : 0.8}) 0%, 
            rgba(255, 20, 147, 0.4) 30%,
            rgba(255, 182, 193, 0.2) 70%,
            transparent 100%); 
        pointer-events: none; z-index: 9999;
        transition: opacity 0.5s; opacity: 1;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.style.opacity = '0', 80);
    setTimeout(() => flash.remove(), 600);
    
    const totalPetals = petalCount + 1 + spiralCount;
    const totalDamage = petalDamage * totalPetals;
    addFloatingText(`🌸 꽃잎 포 발사! 🌸`, Player.x, Player.y - 60, '#ff1493');
    addFloatingText(`💥 DAMAGE: ${totalDamage.toLocaleString()} 💥`, Player.x, Player.y - 40, '#ffd700');
    AudioManager.playSFX('explode');
    
    console.log(`[PETAL CANNON] Landscape:${isLandscape}, Lv.${playerLevel}, dmg:${petalDamage}, petals:${totalPetals}`);
}

function endGame() {
    if (currentState !== GAME_STATE.GAME_OVER) gameOverStartTime = Date.now();
    currentState = GAME_STATE.GAME_OVER;
}
function resetGame(stageToStart = 1) {
    projectiles = []; enemies = []; particles = []; gates = [];
    currentStage = stageToStart; // 파라미터로 받은 스테이지로 시작
    enemiesKilled = 0; boss = null;
    currentState = GAME_STATE.PLAYING; gameOverStartTime = 0;
    // 스테이지 1에서 시작할 때만 레벨 시스템 초기화, 아니면 레벨 유지
    if (stageToStart === 1) {
        LevelSystem.init();
    }
    Player.init(); updateMainMenuVisibility();
}

function createBombExplosion() {
    const cx = GAME_WIDTH / 2; const cy = GAME_HEIGHT / 2;
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
    if (isBombUnlimited || Player.bombCount > 0) {
        if (!isBombUnlimited) Player.bombCount--;
        createBombExplosion();
        let bombKills = 0;
        for (const e of enemies) {
            if (e.state !== 'DEAD') {
                e.state = 'DEAD';
                e.aniFrame = 0;
                bombKills++;
                score += 100;
                // 폭탄 킬도 EXP 제공 (5 EXP)
                LevelSystem.addPlayerExp(5);
                createExplosion(e.x, e.y);
            }
        }
        enemiesKilled += bombKills;
        // 보스 처리
        if (boss && boss.active) {
            boss.hp -= 500;
            if (boss.hp <= 0 && boss.state !== 'DEAD') {
                boss.state = 'DEAD';
                boss.aniFrame = 0;
                boss.lastFrameTime = performance.now();
                boss.deathHandled = false;
            }
        }
        AudioManager.playSFX('explode');
        // 스테이지 목표 달성 시 보스 소환
        const stage = getCurrentStageData();
        if (enemiesKilled >= stage.goal && !boss) {
            startBossFight();
        }
    }
}

// 폭탄 버튼 영역 (클릭 감지용)
let bombButtonRect = null;

// [ADVANCED 2D PIXEL ART BOMB BUTTON]
// 고급 2D 도트 스타일 다이너마이트 폭탄 UI
function drawBombButton(ctx) {
    const btnSize = 76;
    const btnX = GAME_WIDTH - btnSize - 20;
    const btnY = GAME_HEIGHT - btnSize - 20;
    const centerX = btnX + btnSize / 2;
    const centerY = btnY + btnSize / 2;

    // 버튼 영역 저장 (클릭 감지용)
    bombButtonRect = { x: btnX, y: btnY, width: btnSize, height: btnSize };

    const time = Date.now();
    const pulse = Player.bombCount > 0 ? Math.sin(time / 140) * 0.18 + 1.05 : 1.0;
    const flicker = Math.sin(time / 50) > 0;

    ctx.save();

    // === 1. 외곽 다이너마이트 불꽃 네온 오라 글로우 (폭탄 잔여량 있을 때만) ===
    if (Player.bombCount > 0) {
        ctx.shadowBlur = 25 * pulse;
        ctx.shadowColor = '#ff3300';
        
        ctx.fillStyle = `rgba(255, 60, 0, ${0.12 * pulse})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, btnSize / 2 + 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // === 2. 프리미엄 메탈릭 섀시 프레임 (골드/블랙 3D 외곽 베젤) ===
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(btnX, btnY, btnSize, btnSize);
    
    // 이중 베젤 반사 (골드/브론즈 고급 메탈 그라데이션)
    const goldGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnSize);
    goldGradient.addColorStop(0, '#bfa76f');
    goldGradient.addColorStop(0.3, '#8c733f');
    goldGradient.addColorStop(0.7, '#42371c');
    goldGradient.addColorStop(1, '#1b160a');
    ctx.fillStyle = goldGradient;
    ctx.fillRect(btnX + 2, btnY + 2, btnSize - 4, btnSize - 4);
    
    // 내측 강렬한 레드/오렌지 액센트 테두리
    ctx.strokeStyle = Player.bombCount > 0 ? (flicker ? '#ff6347' : '#ff4500') : '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX + 4, btnY + 4, btnSize - 8, btnSize - 8);
    
    // === 3. 내부 카본 플레이트 (유리/화염 반사 코팅판) ===
    const innerX = btnX + 7;
    const innerY = btnY + 7;
    const innerSize = btnSize - 14;
    
    ctx.fillStyle = '#0f0c0b';
    ctx.fillRect(innerX, innerY, innerSize, innerSize);
    
    // 도트 불꽃이 반사되는 미세 플리커 광원 효과
    if (Player.bombCount > 0) {
        ctx.fillStyle = flicker ? 'rgba(255, 69, 0, 0.15)' : 'rgba(255, 140, 0, 0.08)';
        ctx.fillRect(innerX, innerY, innerSize, innerSize);
    }
    
    // 플레이트 모서리 고정 나사(Screw) 4개 묘사로 메탈 디테일 극대화
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(innerX + 2, innerY + 2, 2, 2);
    ctx.fillRect(innerX + innerSize - 4, innerY + 2, 2, 2);
    ctx.fillRect(innerX + 2, innerY + innerSize - 4, 2, 2);
    ctx.fillRect(innerX + innerSize - 4, innerY + innerSize - 4, 2, 2);

    // === 4. 중앙 폭탄 아이콘 (3D 도트 다이너마이트 묶음) ===
    if (Player.bombCount > 0) {
        const dW = 10; const dH = 26;
        
        ctx.save();
        ctx.translate(centerX, centerY + 3);
        
        // 1번 대(왼쪽)
        drawDynamiteStick(ctx, -9, -dH/2, dW, dH, '#d91a1a', '#660000');
        // 2번 대(오른쪽)
        drawDynamiteStick(ctx, 9, -dH/2, dW, dH, '#d91a1a', '#660000');
        // 3번 대(중앙 메인 - 입체적으로 위에 덮임)
        drawDynamiteStick(ctx, 0, -dH/2 - 2, dW, dH + 2, '#ff3333', '#800000');
        
        // 중앙 폭탄 고정용 검은 절연테이프 2줄
        ctx.fillStyle = '#111111';
        ctx.fillRect(-15, -dH/2 + 3, 30, 4);
        ctx.fillRect(-15, dH/2 - 9, 30, 4);
        
        ctx.restore();
        
        // 도트 타오르는 불꽃 심지 (Flickering Spark)
        ctx.save();
        ctx.translate(centerX, centerY - dH/2 - 5);
        
        // 심지 줄 (갈색 도트)
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(-4, -2, -1, -8);
        ctx.stroke();
        
        // 타오르는 화약 도트 불꽃 이펙트
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffd700';
        
        const sparkScale = flicker ? 1.3 : 0.8;
        ctx.fillStyle = '#ffd700'; // 외부 노랑
        ctx.beginPath();
        ctx.arc(-1, -8, 5 * sparkScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff4500'; // 내부 핵심 빨강
        ctx.beginPath();
        ctx.arc(-1, -8, 2.5 * sparkScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        // === 5. 잔여 폭탄 개수 뱃지 (우측 하단 코너) ===
        ctx.save();
        ctx.shadowBlur = 0; // 뱃지 테두리 정밀도 확보
        const countBoxX = innerX + innerSize - 20;
        const countBoxY = innerY + innerSize - 11;
        
        // 카본 캡슐 프레임
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeStyle = '#ff4500';
        ctx.lineWidth = 1;
        ctx.fillRect(countBoxX, countBoxY, 18, 9);
        ctx.strokeRect(countBoxX, countBoxY, 18, 9);
        
        // 개수 글꼴
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 6px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`x${Player.bombCount}`, countBoxX + 9, countBoxY + 5);
        ctx.restore();

        // === 6. 단축키 뱃지 (SPACE) - 버튼 상단에 둥둥 떠있는 플로팅 애니메이션 ===
        ctx.save();
        const shortcutColor = '#ff4500';
        const badgeW = 44; const badgeH = 14;
        const floatOffset = Math.sin(time / 160) * 2.5;
        const badgeX = centerX - badgeW / 2; 
        const badgeY = btnY - badgeH - 4 + floatOffset;
        
        ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.strokeStyle = shortcutColor; 
        ctx.lineWidth = 1.5;
        ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        
        ctx.fillStyle = shortcutColor;
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPACE', centerX, badgeY + 7);
        
        // 왼쪽 상단 수명 인디케이터 (폭탄 활성화 시 녹색 미세 핀)
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(btnX + 6, btnY + 6, 4, 4);
        ctx.restore();

    } else {
        // === 폭탄 없음 상태 (그을린 다이너마이트 묶음 실루엣) ===
        const dW = 10; const dH = 26;
        ctx.save();
        ctx.translate(centerX, centerY + 3);
        ctx.globalAlpha = 0.22;
        drawDynamiteStick(ctx, -9, -dH/2, dW, dH, '#333', '#111');
        drawDynamiteStick(ctx, 9, -dH/2, dW, dH, '#333', '#111');
        drawDynamiteStick(ctx, 0, -dH/2 - 2, dW, dH + 2, '#444', '#1a1a1a');
        ctx.restore();
        
        // EMPTY 라벨
        ctx.fillStyle = '#666';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EMPTY', centerX, centerY + 22);
        
        // === 단축키 뱃지 (SPACE) - 비활성 상태 ===
        ctx.save();
        const badgeW2 = 44; const badgeH2 = 14;
        const badgeX2 = centerX - badgeW2 / 2; const badgeY2 = btnY - badgeH2 - 4;
        ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
        ctx.fillRect(badgeX2, badgeY2, badgeW2, badgeH2);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.0;
        ctx.strokeRect(badgeX2, badgeY2, badgeW2, badgeH2);
        
        ctx.fillStyle = '#555';
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPACE', centerX, badgeY2 + 7);
        ctx.restore();
        
        ctx.fillStyle = '#444';
        ctx.fillRect(btnX + 6, btnY + 6, 3, 3);
    }

    ctx.restore();
}

// 꽃잎 포 버튼 영역 (클릭 감지용)
let petalCannonButtonRect = null;

// [ADVANCED 2D PIXEL ART PETAL CANNON BUTTON]
// 고급 2D 도트 스타일 꽃잎 포 버튼 UI
function drawPetalCannonButton(ctx) {
    const btnSize = 76; // 폭탄과 동일 크기
    const btnX = GAME_WIDTH - btnSize - 76 - 20 - 15; // 폭탄 버튼 왼쪽에 15px 간격
    const btnY = GAME_HEIGHT - btnSize - 20;
    const centerX = btnX + btnSize / 2;
    const centerY = btnY + btnSize / 2;
    
    // 버튼 영역 저장 (클릭 감지용)
    petalCannonButtonRect = { x: btnX, y: btnY, width: btnSize, height: btnSize };
    
    const time = Date.now();
    const pulse = Player.petalCannonReady ? Math.sin(time / 120) * 0.25 + 1.1 : 1.0;
    const chargePercent = Math.min(1.0, Player.petalCannonCharge / Player.petalCannonMaxCharge);
    
    ctx.save();
    
    // === 1. 외곽 벚꽃 네온 대형 오라 글로우 (충전 완료시만) ===
    if (Player.petalCannonReady) {
        ctx.shadowBlur = 30 * pulse;
        ctx.shadowColor = '#ff1493';
        
        ctx.fillStyle = `rgba(255, 20, 147, ${0.15 * pulse})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, btnSize / 2 + 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // === 2. 프리미엄 메탈 베젤 프레임 (3D 경사 금속 외곽) ===
    ctx.fillStyle = '#222';
    ctx.fillRect(btnX, btnY, btnSize, btnSize);
    
    // 상단 하이라이트 (메탈릭 반사 그라데이션)
    const metalGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnSize);
    metalGradient.addColorStop(0, '#5a5a5a');
    metalGradient.addColorStop(0.15, '#3c3c3c');
    metalGradient.addColorStop(0.5, '#222222');
    metalGradient.addColorStop(1, '#0e0e0e');
    ctx.fillStyle = metalGradient;
    ctx.fillRect(btnX + 2, btnY + 2, btnSize - 4, btnSize - 4);
    
    // 핑크/마젠타 테두리 액센트 (충전도에 따라 불투명도 및 생기 조절)
    const borderGlowColor = Player.petalCannonReady ? '#ff1493' : `rgba(255, 105, 180, ${0.2 + chargePercent * 0.8})`;
    ctx.strokeStyle = borderGlowColor;
    ctx.lineWidth = Player.petalCannonReady ? 3.0 : 1.5;
    ctx.strokeRect(btnX + 4, btnY + 4, btnSize - 8, btnSize - 8);
    
    // === 3. 내부 글래스 패널 ===
    const innerX = btnX + 7;
    const innerY = btnY + 7;
    const innerSize = btnSize - 14;
    
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(innerX, innerY, innerSize, innerSize);
    
    // === 4. [특허급 연출] 핑크 네온 2D 유체 액체 채우기 (Circular Fluid Wave Fill) ===
    if (chargePercent > 0 && !Player.petalCannonReady) {
        ctx.save();
        // 원형 클리핑 영역 지정 (버튼 내부 관 형상화)
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerSize / 2 - 3, 0, Math.PI * 2);
        ctx.clip();
        
        // 물결 모양 수면 높이 계산 (아래서 위로 차오름)
        const fillHeight = innerSize * chargePercent;
        const waterY = (innerY + innerSize) - fillHeight;
        
        // 좌우 출렁이는 Sine 물결 렌더링
        const waveFrequency = 0.08;
        const waveAmplitude = 3.0; // 출렁임 깊이
        const wavePhase = time / 150;
        
        ctx.fillStyle = 'rgba(255, 20, 147, 0.28)'; // 은은한 핑크빛 충전 유체
        ctx.beginPath();
        ctx.moveTo(innerX - 5, innerY + innerSize + 5);
        for (let wx = innerX - 5; wx <= innerX + innerSize + 5; wx++) {
            const wy = waterY + Math.sin(wx * waveFrequency + wavePhase) * waveAmplitude;
            ctx.lineTo(wx, wy);
        }
        ctx.lineTo(innerX + innerSize + 5, innerY + innerSize + 5);
        ctx.closePath();
        ctx.fill();
        
        // 물결 상단 하이라이트 (빛 반사)
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    } else if (Player.petalCannonReady) {
        // 완충 시 버튼 전체가 끓어오르는 핑크 아크릴로 가득 참
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerSize / 2 - 3, 0, Math.PI * 2);
        ctx.clip();
        
        const radialGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, innerSize / 2);
        radialGrad.addColorStop(0, 'rgba(255, 20, 147, 0.45)');
        radialGrad.addColorStop(0.8, 'rgba(255, 105, 180, 0.2)');
        radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        ctx.fillStyle = radialGrad;
        ctx.fillRect(innerX, innerY, innerSize, innerSize);
        ctx.restore();
    }
    
    // === 5. 꽃잎 포 아이콘 (유기적으로 회전하고 두근거리는 화려한 2D 벚꽃잎) ===
    if (chargePercent > 0 || Player.petalCannonReady) {
        ctx.save();
        ctx.translate(centerX, centerY);
        
        // 완충 시 찬란하게 심장처럼 두근거리는 펄싱 & 빠른 회전
        const rotSpeed = Player.petalCannonReady ? time / 6 : time / 15;
        ctx.rotate(rotSpeed * Math.PI / 180);
        
        const petalSize = Player.petalCannonReady ? 14 : 9;
        ctx.fillStyle = Player.petalCannonReady ? '#ff1493' : '#ff69b4';
        
        // 5가닥의 정교한 벚꽃잎 드로잉 (각 잎마다 3D 음영 적용)
        for (let i = 0; i < 5; i++) {
            ctx.save();
            ctx.rotate((i * 72) * Math.PI / 180);
            
            // 벚꽃잎 픽셀 묘사
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-petalSize, -petalSize * 1.5, -petalSize * 0.5, -petalSize * 2.2, 0, -petalSize * 2.2);
            ctx.bezierCurveTo(petalSize * 0.5, -petalSize * 2.2, petalSize, -petalSize * 1.5, 0, 0);
            ctx.closePath();
            ctx.fill();
            
            // 잎맥 하이라이트 선
            ctx.strokeStyle = Player.petalCannonReady ? '#ffffff' : '#ffa6c9';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -petalSize * 1.8);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 황금빛 중심술 (Gold Core)
        ctx.fillStyle = Player.petalCannonReady ? '#ffd700' : '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, Player.petalCannonReady ? 7 : 4, 0, Math.PI * 2);
        ctx.fill();
        
        // 중심술 디테일 도트 추가
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -1.5, 3, 3);
        
        ctx.restore();
        
        // === 6. 완충 시 외곽 회전 네온 링 (Rotating Arc Halo) ===
        if (Player.petalCannonReady) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff1493';
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            // 각 구간별 2가닥의 회전 아크 링 묘사
            const startAng = (time / 8) * Math.PI / 180;
            ctx.arc(centerX, centerY, innerSize / 2 - 5, startAng, startAng + Math.PI * 0.6);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerSize / 2 - 5, startAng + Math.PI, startAng + Math.PI * 1.6);
            ctx.stroke();
            
            ctx.restore();
        }
    } else {
        // 충전 안됨 (회색 실루엣 벚꽃)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.fillStyle = '#3a3a42';
        for (let i = 0; i < 5; i++) {
            ctx.save();
            ctx.rotate((i * 72) * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-6, -9, -3, -13, 0, -13);
            ctx.bezierCurveTo(3, -13, 6, -9, 0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = '#555562';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // === 7. 충전량 미세 바 (패널 하단 안착) ===
    const barWidth = innerSize - 10;
    const barHeight = 4;
    const barX = innerX + 5;
    const barY = innerY + innerSize - 9;
    
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    if (chargePercent > 0) {
        const barGradient = ctx.createLinearGradient(barX, barY, barX + barWidth * chargePercent, barY);
        barGradient.addColorStop(0, '#9e0050');
        barGradient.addColorStop(0.7, '#ff1493');
        barGradient.addColorStop(1, '#ff69b4');
        ctx.fillStyle = barGradient;
        ctx.fillRect(barX, barY, barWidth * chargePercent, barHeight);
    }
    
    // === 8. 준비 상태 네온 인디케이터 도트 ===
    if (Player.petalCannonReady) {
        ctx.fillStyle = '#00ff00';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ff00';
        ctx.fillRect(btnX + 6, btnY + 6, 4, 4);
    } else if (chargePercent > 0) {
        ctx.fillStyle = '#ff1493';
        ctx.fillRect(btnX + 6, btnY + 6, 3, 3);
    } else {
        ctx.fillStyle = '#444';
        ctx.fillRect(btnX + 6, btnY + 6, 3, 3);
    }
    ctx.shadowBlur = 0;
    
    // === 9. 단축키 뱃지 (F키) - 버튼 상단에 둥둥 떠있는 플로팅 애니메이션 ===
    const shortcutColor = Player.petalCannonReady ? '#ff1493' : (chargePercent > 0 ? '#ff69b4' : '#666');
    const fBadgeW = 24; const fBadgeH = 14;
    const floatOffset = Player.petalCannonReady ? Math.sin(time / 180) * 2.5 : 0;
    const fBadgeX = centerX - fBadgeW / 2;
    const fBadgeY = btnY - fBadgeH - 4 + floatOffset;
    
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.fillRect(fBadgeX, fBadgeY, fBadgeW, fBadgeH);
    ctx.strokeStyle = shortcutColor; 
    ctx.lineWidth = Player.petalCannonReady ? 1.5 : 1.0;
    ctx.strokeRect(fBadgeX, fBadgeY, fBadgeW, fBadgeH);
    
    ctx.fillStyle = shortcutColor;
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('F', centerX, fBadgeY + 11);
    
    ctx.restore();
}

// 꽃잎 포 버튼 클릭 감지 함수
function isPointInPetalCannonButton(x, y) {
    if (!petalCannonButtonRect) return false;
    return x >= petalCannonButtonRect.x &&
        x <= petalCannonButtonRect.x + petalCannonButtonRect.width &&
        y >= petalCannonButtonRect.y &&
        y <= petalCannonButtonRect.y + petalCannonButtonRect.height;
}

// 다이너마이트 스틱 그리기 (픽셀 아트 스타일)
function drawDynamiteStick(ctx, cx, cy, w, h, lightColor, darkColor) {
    const x = cx - w/2;
    
    // 어두면 (그림자)
    ctx.fillStyle = darkColor;
    ctx.fillRect(x + 2, cy + 2, w - 2, h - 2);
    
    // 본체 (밝은 빨강)
    ctx.fillStyle = lightColor;
    ctx.fillRect(x, cy, w, h);
    
    // 하이라이트 (위쪽)
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x + 1, cy + 1, w - 2, 3);
    
    // 그림자 (아래쪽)
    ctx.fillStyle = darkColor;
    ctx.fillRect(x + 1, cy + h - 3, w - 2, 2);
    
    // 측면 하이라이트 (입체감)
    ctx.fillStyle = '#ff8888';
    ctx.fillRect(x + 1, cy + 5, 2, h - 7);
}

// 폭탄 버튼 클릭 감지 함수
function isPointInBombButton(x, y) {
    if (!bombButtonRect) return false;
    return x >= bombButtonRect.x &&
        x <= bombButtonRect.x + bombButtonRect.width &&
        y >= bombButtonRect.y &&
        y <= bombButtonRect.y + bombButtonRect.height;
}

window.addEventListener('mousemove', (e) => Player.targetY = e.clientY - Player.height / 2);
// 데스크톱 클릭 처리 (START 상태에서는 버튼만 작동)
window.addEventListener('mousedown', (e) => {
    if (currentState === GAME_STATE.START) {
        // START 상태에서는 버튼 클릭만 처리 (자동 시작 안함)
        return;
    }

    // 꽃잎 포 버튼 클릭 감지 (데스크탑 & 가로 모드) - 폭탄 버튼보다 먼저 체크
    if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) &&
        isPointInPetalCannonButton(e.clientX, e.clientY)) {
        usePetalCannon();
        return;
    }

    // 폭탄 버튼 클릭 감지 (데스크탑 & 가로 모드)
    if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) &&
        isPointInBombButton(e.clientX, e.clientY)) {
        useBomb();
        return;
    }

    enterMobileFullscreen();
    AudioManager.init(); AudioManager.startBGM();
    if (currentState === GAME_STATE.WIN) {
        projectiles = []; enemies = []; particles = []; gates = [];
        currentStage = 1; enemiesKilled = 0; boss = null;
        currentState = GAME_STATE.START;
        updateMainMenuVisibility();
        return;
    }
    if (currentState === GAME_STATE.GAME_OVER) {
        // 게임오버 버튼이 보이면 클릭으로 재시작하지 않음 (버튼으로만 조작)
        if (!gameoverButtons || gameoverButtons.hidden) resetGame();
    }
    else if (currentState === GAME_STATE.STAGE_CLEAR) {
        if (currentStage < 10) advanceStage();
    }
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

    // 폭탄 버튼 터치 감지 (가로 모드에서만 표시됨)
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        // 꽃잎 포 버튼 클릭 감지
        if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) &&
            isPointInPetalCannonButton(touch.clientX, touch.clientY)) {
            usePetalCannon();
            e.preventDefault();
            return;
        }
        // 폭탄 버튼 클릭 감지
        if ((currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) &&
            isPointInBombButton(touch.clientX, touch.clientY)) {
            useBomb();
            e.preventDefault();
            return;
        }
    }

    enterMobileFullscreen();
    AudioManager.init(); AudioManager.startBGM();

    // 상태 전환 로직
    if (currentState === GAME_STATE.WIN) {
        projectiles = []; enemies = []; particles = []; gates = [];
        currentStage = 1; enemiesKilled = 0; boss = null;
        currentState = GAME_STATE.START;
        updateMainMenuVisibility();
        return;
    }
    if (currentState === GAME_STATE.GAME_OVER) {
        // 게임오버 버튼이 보이면 터치로 재시작하지 않음 (버튼으로만 조작)
        if (!gameoverButtons || gameoverButtons.hidden) resetGame();
    }
    else if (currentState === GAME_STATE.STAGE_CLEAR) {
        if (currentStage < 10) advanceStage();
    }

    // 더블 탭 감지
    const currentTime = Date.now();
    const tapLength = currentTime - lastTapTime;
    if (tapLength > 0 && tapLength < 300) {
        if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT) {
            // 게임 중: 폭탄 사용
            useBomb();
            e.preventDefault();
        } else if (currentState === GAME_STATE.STORY) {
            // 스토리 화면: 가로 모드에서만 스킵 허용
            if (isMobileLandscapeOrientation()) {
                skipStory();
                e.preventDefault();
            }
        } else if (currentState === GAME_STATE.EPILOGUE) {
            // 에필로그 화면: 가로 모드에서 더블탭으로 스킵 허용
            if (isMobileLandscapeOrientation()) {
                // 에필로그 스킵: 메인 화면으로 돌아감
                AudioManager.stopEpilogueBGM();
                currentState = GAME_STATE.START;
                updateMainMenuVisibility();
                updateOverlayVisibility();
                e.preventDefault();
            }
        }
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

window.addEventListener('keydown', (e) => { 
    if (e.code === 'Space' && (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT)) useBomb(); 
    if (e.code === 'KeyF' && (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT)) usePetalCannon();
});

function resizeCanvas() {
    const viewport = getViewportSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    GAME_WIDTH = viewport.width;
    GAME_HEIGHT = viewport.height;
    GAME_DPR = dpr;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    canvas.style.width = GAME_WIDTH + 'px';
    canvas.style.height = GAME_HEIGHT + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    Player.init();
}
function handleResize() {
    applyMobileOptimizations();
    resizeCanvas();

    // 화면 크기가 변하면 스토리 페이지 재계산
    if (currentState === GAME_STATE.STORY) {
        storyPages = []; // 다음 프레임에서 재분할 유도
    }

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
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 스토리 화면
    if (currentState === GAME_STATE.STORY) {
        drawStoryScreen(ctx, timestamp);
        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    // 에필로그 화면 (게임 클리어 후 엔딩 스토리)
    if (currentState === GAME_STATE.EPILOGUE) {
        drawEpilogueScreen(ctx, timestamp);
        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    // 메인 메뉴 가시성 업데이트 (START 상태에서만 표시)
    updateMainMenuVisibility();
    updateInstallButtonVisibility();
    updateGameOverButtonVisibility();

    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT || currentState === GAME_STATE.STAGE_CLEAR) {
        // STAGE_CLEAR일 때도 보스 업데이트 필요 (사망 애니메이션 완료)
        if (currentState !== GAME_STATE.STAGE_CLEAR) {
            Background.update(); Player.update(timestamp);
        }
        if (timestamp - gateSpawnTimer > GATE_SPAWN_INTERVAL && currentState !== GAME_STATE.STAGE_CLEAR && !boss) { gates.push(new GatePair(GAME_WIDTH + 50)); gateSpawnTimer = timestamp; }
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
                        console.log(`[HIT] Bullet damage: ${p.damage}, Enemy HP: ${e.hp} → ${e.hp - p.damage}`);
                        e.hp -= p.damage; p.active = false;
                        if (e.hp <= 0) { 
                            e.state = 'DEAD'; e.aniFrame = 0; enemiesKilled++; score += 100; 
                            // 적 처치 시 EXP 획득 (10 EXP)
                            LevelSystem.addPlayerExp(10);
                            createExplosion(e.x, e.y); AudioManager.playSFX('explode'); 
                            if (enemiesKilled >= stage.goal && !boss) startBossFight(); 
                        }
                        break;
                    }
                }
                if (boss && boss.active && boss.state !== 'DEAD' && checkCollision(p, boss)) {
                    // 스테이지 5 이상부터는 꽃잎포 보스 2배 데미지 무효화 (1배만 적용)
                    const isDoubleDamage = p.isPetalCannon && currentStage < 5;
                    const damageToBoss = isDoubleDamage ? p.damage * 2 : p.damage;
                    boss.hp -= damageToBoss; p.active = false; createExplosion(p.x, p.y, '#ff4757');
                    // 꽃잎 포 보스 타격 시 추가 플로팅 텍스트
                    if (p.isPetalCannon) {
                        if (isDoubleDamage) {
                            addFloatingText(`💥 CRITICAL! -${damageToBoss}`, p.x, p.y - 20, '#ff00ff');
                        } else {
                            addFloatingText(`🌸 HIT! -${damageToBoss}`, p.x, p.y - 20, '#ff69b4');
                        }
                    }
                    if (boss.hp <= 0 && boss.state !== 'DEAD') {
                        boss.state = 'DEAD';
                        boss.aniFrame = 0;
                        boss.lastFrameTime = timestamp;
                        score += 5000;
                        // 보스 처치 시 대량 EXP 획득 (100 EXP)
                        LevelSystem.addPlayerExp(100);
                        addFloatingText(`★ BOSS DEFEATED! +100 EXP ★`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '#f1c40f');
                    }
                }
            } else {
                // 적의 공격 (플레이어에게 맞음)
                if (Player.state === 'ALIVE' && checkCollision(p, Player)) {
                    p.active = false; createExplosion(p.x, p.y, '#ff4757');
                    if (Player.shield <= 0) {
                        const damage = p.isBossEnergyBall ? 3 : 1;
                        Player.takeDamage(damage); // takeDamage 사용
                    }
                }
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) { enemies[i].update(timestamp); if (!enemies[i].active) enemies.splice(i, 1); }
        for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(); if (particles[i].life <= 0) particles.splice(i, 1); }
    }
    Background.draw(ctx);
    if (boss) boss.draw(ctx);
    for (const g of gates) g.draw(ctx);
    for (const p of projectiles) p.draw(ctx);
    for (const e of enemies) e.draw(ctx);
    for (const pt of particles) pt.draw(ctx);
    Player.draw(ctx);

    // 캔버스 기반 HUD 렌더링 (최상단 레이어)
    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.BOSS_FIGHT || currentState === GAME_STATE.STAGE_CLEAR) {
        drawHUD(ctx);
    }

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

    // =========================================================
    // 스킬 알림 HUD (무적/지원군) - 화면 중앙 프리미엄 풀스크린 오버레이
    // =========================================================
    if (Player.skillNotifications && Player.skillNotifications.length > 0) {
        ctx.save();
        const time = Date.now();
        const cw = GAME_WIDTH / (window.devicePixelRatio || 1);
        const ch = GAME_HEIGHT / (window.devicePixelRatio || 1);
        const cx = cw / 2;
        const cy = ch / 2;

        // 활성 스킬 중 가장 최근 것(index 0)을 중앙에 표시
        const notif = Player.skillNotifications[0];
        const secondsLeft = Math.ceil(notif.timeLeft / 1000);
        const isShield = notif.text.includes('SHIELD');

        let skillColor, skillColor2, skillGlow, skillIcon, skillTitle, skillSubtitle, maxDuration;
        if (isShield) {
            skillColor   = '#a855f7';
            skillColor2  = '#e9d5ff';
            skillGlow    = '#c084fc';
            skillIcon    = '🛡️';
            skillTitle   = 'SHIELD ACTIVE';
            skillSubtitle = '무적의 분홍 방패';
            maxDuration  = 15000 + LevelSystem.getItemEffect('SHIELD');
        } else {
            skillColor   = '#f97316';
            skillColor2  = '#fed7aa';
            skillGlow    = '#fb923c';
            skillIcon    = '👥';
            skillTitle   = 'SUPPORT CALLED';
            skillSubtitle = '지원군이 도착했습니다';
            maxDuration  = 20000 + LevelSystem.getItemEffect('SUPPORT');
        }
        const progress   = Math.max(0, Math.min(1, notif.timeLeft / maxDuration));
        const pulse      = 0.88 + 0.12 * Math.sin(time / 220);
        const urgentPulse = secondsLeft <= 3 ? 0.55 + 0.45 * Math.abs(Math.sin(time / 110)) : 1;
        const isNew      = notif.timeLeft > maxDuration - 800; // 처음 0.8초: 입장 연출

        // ── 1. 반투명 풀 배경 (입장 시만 강하게) ────────────
        const bgAlpha = isNew ? 0.55 : 0.30;
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cw, ch) * 0.8);
        bgGrad.addColorStop(0, `rgba(0,0,0,${bgAlpha})`);
        bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, cw, ch);

        // ── 2. 위·아래 씨네마틱 바 ───────────────────────────
        const barH2 = ch * 0.07;
        const barAlpha2 = isNew ? 0.85 : 0.55;
        ctx.fillStyle = `rgba(0,0,0,${barAlpha2})`;
        ctx.fillRect(0, 0, cw, barH2);
        ctx.fillRect(0, ch - barH2, cw, barH2);

        // ── 3. 수평 광선 (빛 줄기) ────────────────────────────
        for (let r = 0; r < 3; r++) {
            const ry = cy + (r - 1) * 28;
            const lineGrad = ctx.createLinearGradient(0, ry, cw, ry);
            lineGrad.addColorStop(0, 'transparent');
            lineGrad.addColorStop(0.3, skillColor + '44');
            lineGrad.addColorStop(0.5, skillGlow + '88');
            lineGrad.addColorStop(0.7, skillColor + '44');
            lineGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = lineGrad;
            ctx.fillRect(0, ry - 1, cw, r === 1 ? 3 : 1);
        }

        // ── 4. 중앙 대형 링 (카운트다운 링) ─────────────────
        const ringR   = Math.min(cw, ch) * 0.20;
        const ringR2  = ringR + 18;
        // 바깥 글로우
        ctx.shadowBlur  = 50 * urgentPulse * pulse;
        ctx.shadowColor = skillColor;
        ctx.strokeStyle = skillColor + '55';
        ctx.lineWidth   = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR2, 0, Math.PI * 2);
        ctx.stroke();

        // 진행 링
        ctx.shadowBlur  = 30 * urgentPulse;
        ctx.shadowColor = skillGlow;
        ctx.strokeStyle = skillColor;
        ctx.lineWidth   = 7;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // 배경 링
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 7;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, -Math.PI / 2 + Math.PI * 2 * progress, -Math.PI / 2 + Math.PI * 2);
        ctx.stroke();

        // ── 5. 아이콘 (중앙) ─────────────────────────────────
        const iconSize = ringR * 0.85 * pulse;
        ctx.shadowBlur  = 25 * pulse;
        ctx.shadowColor = skillGlow;
        ctx.font        = `${Math.round(iconSize)}px serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(skillIcon, cx, cy - 4);

        // ── 6. 타이틀 텍스트 ─────────────────────────────────
        ctx.shadowBlur  = 18 * urgentPulse;
        ctx.shadowColor = skillColor;
        ctx.fillStyle   = skillColor2;
        ctx.font        = `bold ${Math.round(14 * urgentPulse)}px "Press Start 2P"`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(skillTitle, cx, cy - ringR - 22);

        // 서브타이틀
        ctx.shadowBlur = 0;
        ctx.fillStyle  = 'rgba(255,255,255,0.65)';
        ctx.font       = `bold 10px "Press Start 2P"`;
        ctx.fillText(skillSubtitle, cx, cy - ringR - 6);

        // ── 7. 카운트다운 숫자 (링 아래) ─────────────────────
        const urgentColor = secondsLeft <= 3 ? '#ff4757' : '#ffffff';
        ctx.shadowBlur  = secondsLeft <= 3 ? 20 : 10;
        ctx.shadowColor = secondsLeft <= 3 ? '#ff4757' : skillGlow;
        ctx.fillStyle   = urgentColor;
        ctx.font        = `bold ${Math.round(28 * urgentPulse)}px "Press Start 2P"`;
        ctx.fillText(`${secondsLeft}s`, cx, cy + ringR + 38);
        ctx.shadowBlur  = 0;

        // ── 8. 하단 세그먼트 게이지 바 ───────────────────────
        const segments = 12;
        const barW     = ringR * 2.2;
        const barX0    = cx - barW / 2;
        const barY0    = cy + ringR + 50;
        const segH     = 8;
        const segW2    = (barW - segments + 1) / segments;

        for (let s = 0; s < segments; s++) {
            const segFrac = (s + 1) / segments;
            const filled  = segFrac <= progress;
            const sx      = barX0 + s * (segW2 + 1);
            ctx.globalAlpha = filled ? urgentPulse : 0.12;
            if (filled) {
                const sg = ctx.createLinearGradient(sx, barY0, sx, barY0 + segH);
                sg.addColorStop(0, skillColor2);
                sg.addColorStop(1, skillColor);
                ctx.shadowBlur  = 6;
                ctx.shadowColor = skillColor;
                ctx.fillStyle   = sg;
            } else {
                ctx.shadowBlur = 0;
                ctx.fillStyle  = 'rgba(255,255,255,0.15)';
            }
            ctx.beginPath();
            ctx.roundRect(sx, barY0, segW2, segH, 2);
            ctx.fill();
            ctx.shadowBlur  = 0;
        }
        ctx.globalAlpha = 1;

        // 복수 스킬이 활성화된 경우 우측 상단에 작은 아이콘 표시
        if (Player.skillNotifications.length > 1) {
            for (let i = 1; i < Player.skillNotifications.length; i++) {
                const sn = Player.skillNotifications[i];
                const isSh = sn.text.includes('SHIELD');
                const sc2  = isSh ? '#a855f7' : '#f97316';
                const ico2 = isSh ? '🛡️' : '👥';
                const sx2  = cw - 52;
                const sy2  = 60 + (i - 1) * 50;
                const sl2  = Math.ceil(sn.timeLeft / 1000);
                ctx.globalAlpha = 0.85;
                ctx.shadowBlur  = 10;
                ctx.shadowColor = sc2;
                ctx.font = '22px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ico2, sx2, sy2);
                ctx.font     = '7px "Press Start 2P"';
                ctx.fillStyle = sc2;
                ctx.fillText(`${sl2}s`, sx2, sy2 + 18);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }
        }

        ctx.restore();
    }

    drawStoryText(ctx, timestamp); // 스토리 연출 레이어 추가

    if (currentState === GAME_STATE.START) drawStartScreen();
    if (currentState === GAME_STATE.GAME_OVER) drawGameOverScreen();
    if (currentState === GAME_STATE.GAME_CLEAR_IMAGE) {
        drawGameClearImageScreen();
        animationId = requestAnimationFrame(gameLoop);
        return;
    }
    if (currentState === GAME_STATE.WIN || currentState === GAME_STATE.ALL_CLEAR) drawWinScreen();
    if (currentState === GAME_STATE.STAGE_CLEAR) drawStageClearScreen();
    animationId = requestAnimationFrame(gameLoop);
}

function drawStageClearScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const time = Date.now();
    const pulse = Math.sin(time / 300) * 0.1 + 1.0;

    // 승리 이미지 표시
    const winImg = ImageLoader.get('win');
    if (winImg) {
        ctx.save();
        const winSize = Math.min(GAME_WIDTH * 0.25, 180) * pulse;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#f1c40f';
        // 가로 모드에서 상단이 짤리지 않도록 Y 위치 계산 (최소 20px 여백 확보)
        const baseY = GAME_HEIGHT / 2 - winSize / 2 - 50;
        const winY = Math.max(20, baseY); // 최소 20px from top
        ctx.drawImage(winImg, GAME_WIDTH / 2 - winSize / 2, winY, winSize, winSize);
        ctx.restore();
    }

    // 스테이지 클리어 텍스트
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 24px "Press Start 2P"';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#e67e22';
    ctx.fillText(`STAGE ${currentStage} CLEAR!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80);

    // 3초 후 자동 진행 안내
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px "Press Start 2P"';
    ctx.shadowBlur = 0;
    ctx.fillText('Click to continue...', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 120);
    ctx.restore();

    // 축하 파티클 효과
    if (Math.random() < 0.3) {
        const colors = ['#f1c40f', '#e67e22', '#ff6b9d', '#4ecdc4'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10, color));
    }
}

function drawStartScreen() {
    ctx.fillStyle = '#0a0505'; // 좀비물 특유의 핏빛 섞인 어둠
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const titleImg = ImageLoader.get('title');
    const time = Date.now();
    const pulse = Math.sin(time / 400) * 0.05 + 1.0;

    // 좀비 분위기의 피 흘러내리는 픽셀 효과 (위에서 아래로)
    ctx.fillStyle = '#450a0a';
    for (let i = 0; i < GAME_WIDTH; i += 40) {
        const dripLength = Math.abs(Math.sin((i + time / 500) * 0.1)) * 100 + 20;
        ctx.fillRect(i, 0, 10, dripLength);
        ctx.fillRect(i + 2, dripLength, 6, 5); // 핏방울
    }

    // 배경 입자 효과 (독성 포자 느낌)
    if (time % 100 < 5) {
        particles.push(new Particle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 'rgba(46, 204, 113, 0.3)'));
    }

    // 화면 크기에 따른 스케일 계산 (모바일 대응 개선)
    const isMobile = isMobileTouchDevice();
    const minDim = Math.min(GAME_WIDTH, GAME_HEIGHT);
    const maxDim = Math.max(GAME_WIDTH, GAME_HEIGHT);
    const isPortrait = window.innerHeight > window.innerWidth;

    // 모바일/데스크톱 스케일 계산
    let scaleFactor;
    if (isMobile) {
        if (isPortrait) {
            // 세로 모드: 더 작은 스케일 사용
            scaleFactor = Math.max(0.65, Math.min(0.85, minDim / 500));
        } else {
            // 가로 모드: 데스크톱처럼 크게
            scaleFactor = Math.max(0.9, Math.min(1.0, minDim / 600));
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

        // --- 타이틀 이미지 글리치 및 네온 연출 ---
        const glitchTime = time % 2000;
        let glitchX = 0;
        let glitchAlpha = 1;

        // 가끔 발생하는 강렬한 글리치 (2초마다)
        if (glitchTime < 100) {
            glitchX = (Math.random() - 0.5) * 15;
            glitchAlpha = 0.8;
            ctx.filter = `hue-rotate(${Math.random() * 360}deg) brightness(1.5)`;
        }

        ctx.shadowBlur = 40 * pulse;
        ctx.shadowColor = '#e74c3c';

        let maxTitleW;
        if (isMobile && !isPortrait) {
            maxTitleW = Math.min(GAME_HEIGHT * 0.45, GAME_WIDTH * 0.28) * pulse;
        } else if (isMobile) {
            maxTitleW = Math.min(350 * scaleFactor, GAME_WIDTH * 0.8);
        } else {
            maxTitleW = 500 * pulse * scaleFactor;
        }

        const w = maxTitleW;
        const h = (w / titleImg.width) * titleImg.height;

        let titleY;
        if (isMobile && !isPortrait) {
            titleY = 20 * scaleFactor;
        } else if (isMobile) {
            titleY = marginTop;
        } else {
            titleY = GAME_HEIGHT / 2 - h / 2 - 120 * scaleFactor;
        }

        let titleX = GAME_WIDTH / 2 - w / 2 + glitchX;

        ctx.globalAlpha = glitchAlpha;
        ctx.drawImage(titleImg, titleX, titleY, w, h);
        ctx.restore();
    }

    // --- 프리미엄 네온 & 글리치 연출 (임팩트 강화) ---
    ctx.save();

    // 네온 깜빡임 효과 (랜덤하게 깜빡거림)
    const flicker = Math.random() > 0.05 ? 1 : (Math.random() > 0.5 ? 0.3 : 0);
    const glitchX = Math.random() > 0.98 ? (Math.random() - 0.5) * 10 : 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 텍스트 위치 계산
    let textX = GAME_WIDTH / 2 + glitchX;
    let textY;
    if (isMobile && !isPortrait) {
        const titleImgH = titleImg ? (Math.min(GAME_HEIGHT * 0.5, GAME_WIDTH * 0.3) / titleImg.width) * titleImg.height : 100;
        textY = 15 * scaleFactor + titleImgH + 25 * scaleFactor;
    } else if (isMobile) {
        textY = marginTop + (350 * scaleFactor) + 25 * scaleFactor;
    } else {
        textY = GAME_HEIGHT / 2 + 50 * scaleFactor;
    }

    // 네온 광채 (Back Glow)
    ctx.shadowBlur = 30 * scaleFactor * pulse * flicker;
    ctx.shadowColor = '#f1c40f';
    ctx.fillStyle = `rgba(241, 196, 15, ${0.4 * flicker})`;

    const titleFontSize = isMobile ? Math.max(24, Math.floor(32 * scaleFactor)) : Math.floor(36 * scaleFactor);
    ctx.font = `bold ${titleFontSize}px "Press Start 2P"`;

    // 이중 렌더링으로 네온 느낌 극대화
    ctx.fillText('FLOWER PIG', textX + 2, textY + 2);

    ctx.shadowBlur = 15 * scaleFactor * flicker;
    ctx.fillStyle = `rgba(255, 255, 255, ${flicker})`;
    ctx.fillText('FLOWER PIG', textX, textY);

    // 서브타이틀 (네온 레드)
    const subtitleFontSize = isMobile ? Math.max(10, Math.floor(12 * scaleFactor)) : Math.floor(14 * scaleFactor);
    ctx.font = `${subtitleFontSize}px "Press Start 2P"`;
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 10 * scaleFactor * flicker;
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('THE KILLER OF ZOMBIE', textX, textY + 40 * scaleFactor);

    ctx.restore();

    // --- 캔버스 기반 미션 가이드 (가로 모드 충돌 방지: 좌측 하단 배치) ---
    let panelW, panelH, panelX, panelY;
    if (isMobile && !isPortrait) {
        // 가로 모드: 좌측 하단 (비밀번호 UI 위 또는 옆)
        panelW = Math.min(320 * scaleFactor, GAME_WIDTH * 0.35);
        panelH = Math.min(120 * scaleFactor, GAME_HEIGHT * 0.3);
        panelX = 30 * scaleFactor;
        panelY = GAME_HEIGHT - panelH - 120 * scaleFactor; // 90px 위로 이동

        // 비밀번호 UI가 좌측에 있으므로, 가이드는 약간 위로 올리거나 비밀번호 UI와 간격 조정 필요
        // CSS에서 비밀번호 UI 위치를 확인하고 조정할 예정
    } else if (isMobile) {
        panelW = GAME_WIDTH * 0.9;
        panelH = Math.min(160 * scaleFactor, GAME_HEIGHT * 0.3);
        panelX = GAME_WIDTH / 2 - panelW / 2;
        panelY = GAME_HEIGHT / 2 + 100 * scaleFactor;
    } else {
        panelW = 700 * scaleFactor;
        panelH = 150 * scaleFactor;
        panelX = GAME_WIDTH / 2 - panelW / 2;
        panelY = GAME_HEIGHT - panelH - 50 * scaleFactor;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f1c40f';
    ctx.font = `bold ${Math.max(10, 12 * scaleFactor)}px "Press Start 2P"`;
    ctx.fillText('⚔ MISSION GUIDE ⚔', panelX + 15 * scaleFactor, panelY + 25 * scaleFactor);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, 10 * scaleFactor)}px "Press Start 2P"`;
    const lines = isMobile && isPortrait ? ['▶ DRAG to Move', '▶ AUTO FIRE', '▶ BOMB: D-TAP'] : ['▶ MOVE: MOUSE / DRAG', '▶ ATTACK: AUTO FIRE', '▶ BOMB: DOUBLE TAP / SPACE'];
    lines.forEach((line, i) => {
        ctx.fillText(line, panelX + 15 * scaleFactor, panelY + 50 * scaleFactor + i * (18 * scaleFactor));
    });
    ctx.restore();
}

const CREDITS_TEXT = [
    { title: "DIRECTOR", name: "NEO" },
    { title: "PROGRAMMER", name: "NEO" },
    { title: "ART DESIGN", name: "NEO" },
    { title: "SOUND DESIGN", name: "NEO" },
    { title: "PRODUCER", name: "NEO" },
    { title: "GAME BALANCE", name: "NEO" },
    { title: "SPECIAL THANKS TO", name: "YOU" }
];

// 게임 클리어 엔딩 에필로그 텍스트
const EPILOGUE_TEXT = `■■■■ [새벽의 연꽃] 엔딩 ■■■■

블랙홀처럼 빛을 잃었던 태양이 
핏빛 안개 너머로 첫 광선을 토하기 시작했다.

50층, 청토끼의 심장부.
연이의 발굽 아래서 융합된 괴물의 잔해가 
더 이상 맥동하지 않는 살점으로 썩어가고 있었다.

수만 개의 신경삭이 타워 전체에서 
힘없이 늘어지며 생명을 잃어갔다.
그와 동시에 도시 곳곳에서 울부짖던 
괴물들의 포효가 하나둘 잦아들었다.

'...끝났군.'

연이는 반쯤 부서진 산탄총을 바닥에 떨어뜨렸다.
검붉게 물든 분홍빛 털. 
메마른 피가 굳은 상처들.
끝없는 전투가 남긴 상처의 증거들.

창밖으로 보이는 네온 시티의 폐허.
한때 번영하던 도시는 이제 잿더미가 되었지만,
어둠 속에서 희미하게나마 
새벽빛이 스며들기 시작했다.

그녀의 포켓에서 떨어진 낡은 사진.
연꽃 마을의 햇살 가득한 들판 위에서
웃고 있는 가족들의 얼굴.

'엄마, 아빠... 언니...
내가... 살아남았어.'

찢어진 네온 사인들 사이로 
새벽 바람이 스치며 핏냄새를 쓸어갔다.
살아남은 자들에게 보내는 
마지막 메시지를 적을 시간.

[긴급 방송 - 생존자 구호망 103.5MHz]

'여기는 네온 시티 중앙 방송국.
타워의 지배자가 사라졌다.
괴물들의 왕관은 부서졌다.

살아있는 모든 생명에게 전한다.
절망의 밤은 끝났다.

마지막 전사 꽃돼지 연이가
우리에게 새벽을 가져왔다.

아직 포기하지 마라.
희망은 끝에서 피어난다.
분홍빛 새벽이 여러분을 기다리고 있다.'

방송국 타워 꼭대기에서 
새벽의 빛이 퍼져나갔다.

한 생명체의 투쟁이 
지옥을 새벽으로 바꾸기 시작했다.

■■■■ REQUIEM FOR THE PINK DAWN ■■■■`;

function drawGameClearImageScreen() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (!gameClearImageStartTime) gameClearImageStartTime = Date.now();
    const elapsed = Date.now() - gameClearImageStartTime;
    const img = ImageLoader.get('gameClear');

    if (img) {
        ctx.save();
        // 2초간 페이드인 효과
        const alpha = Math.min(1, elapsed / 2000);
        ctx.globalAlpha = alpha;

        // 화면 크기에 맞게 이미지 비율 유지하며 중앙에 렌더링
        const scale = Math.min(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
        const w = img.width * scale * 0.9; // 여백 10%
        const h = img.height * scale * 0.9;
        const x = (GAME_WIDTH - w) / 2;
        const y = (GAME_HEIGHT - h) / 2 - 20; // 살짝 위로

        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(241, 196, 15, 0.5)';
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
    }

    // 5초 유지 후 영화 크레딧(WIN) 씬으로 전환
    if (elapsed > 5000) {
        currentState = GAME_STATE.WIN;
        winScreenAnimationTime = 0;
    }
}

function drawWinScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const time = Date.now();

    if (currentState !== GAME_STATE.ALL_CLEAR) {
        winScreenAnimationTime += 0.5;
    }

    // 골든 스파크
    if (time % 100 < 40) {
        for (let i = 0; i < 3; i++) {
            const p = new Particle(Math.random() * GAME_WIDTH, GAME_HEIGHT + 20, Math.random() > 0.5 ? '#f1c40f' : '#e67e22');
            p.speedY = -1 - Math.random() * 3; p.speedX = (Math.random() - 0.5) * 2;
            p.decay = 0.005;
            particles.push(p);
        }
    }

    const scrollY = GAME_HEIGHT - winScreenAnimationTime * 0.8; // 천천히 스크롤

    ctx.save();
    ctx.textAlign = 'center';

    // 타이틀 텍스트
    let currentY = scrollY;

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 24px "Press Start 2P"';
    ctx.shadowBlur = 20; ctx.shadowColor = '#f39c12';
    ctx.fillText('FLOWER PIG', GAME_WIDTH / 2, currentY);
    currentY += 30;

    ctx.fillStyle = '#e74c3c';
    ctx.font = '12px "Press Start 2P"';
    ctx.shadowBlur = 10; ctx.shadowColor = '#e74c3c';
    ctx.fillText('THE KILLER OF ZOMBIE', GAME_WIDTH / 2, currentY);
    currentY += 120; // 넉넉한 여백

    // 크레딧 출력
    for (const credit of CREDITS_TEXT) {
        // 타이틀 (직책)
        ctx.fillStyle = '#00ffff';
        ctx.font = '10px "Press Start 2P"';
        ctx.shadowBlur = 5; ctx.shadowColor = '#00ffff';
        ctx.fillText(credit.title, GAME_WIDTH / 2, currentY);
        currentY += 25;

        // 이름
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff';
        ctx.fillText(credit.name, GAME_WIDTH / 2, currentY);
        currentY += 70; // 다음 크레딧과의 간격
    }

    currentY += 40;

    // 최종 메시지
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px "Press Start 2P"';
    ctx.shadowBlur = 15; ctx.shadowColor = '#f39c12';
    ctx.fillText('THANK YOU FOR PLAYING', GAME_WIDTH / 2, currentY);

    // 스크롤이 충분히 진행된 후에 ALL CLEAR 오버레이 표시
    if (currentY < GAME_HEIGHT / 2) {
        currentState = GAME_STATE.ALL_CLEAR;
        updateOverlayVisibility();
    }
    ctx.restore();
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(10, 0, 0, 0.95)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const time = Date.now();
    const isMobile = isMobileTouchDevice();
    const isPortrait = window.innerHeight > window.innerWidth;
    if (!gameOverStartTime) gameOverStartTime = time;
    const elapsed = time - gameOverStartTime;
    const introProgress = Math.min(1, elapsed / 900);

    // 절망적인 핏빛 스파크 (아래에서 위로)
    if (time % 100 < 40) {
        const p = new Particle(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10, '#c0392b');
        p.speedY = -1 - Math.random() * 2;
        p.speedX = (Math.random() - 0.5);
        particles.push(p);
    }

    // 화면 크기 계산
    const minDim = Math.min(GAME_WIDTH, GAME_HEIGHT);
    const screenScale = Math.min(1, minDim / 600);

    // 게임오버 이미지
    const img = ImageLoader.get('gameover');
    if (img) {
        ctx.save();
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
        const finalScale = animScale * screenScale;
        const baseW = 400 * screenScale;
        const w = baseW * animScale;
        const h = (baseW / frameStride) * frameHeight * animScale;
        const drawX = GAME_WIDTH / 2 - w / 2 + shake * screenScale;
        const drawY = Math.max(20, GAME_HEIGHT * 0.28 - h / 2); // Position in upper area, ensure not off-screen

        ctx.shadowBlur = 40 + Math.sin(time / 200) * 20;
        ctx.shadowColor = '#c0392b';
        ctx.globalAlpha = alpha * (1 - blend);
        ctx.drawImage(img, frameIndex * frameStride, 0, frameStride, frameHeight, drawX, drawY, w, h);
        ctx.globalAlpha = alpha * blend;
        ctx.drawImage(img, nextFrameIndex * frameStride, 0, frameStride, frameHeight, drawX, drawY, w, h);
        ctx.restore();
    }

}

// --- 스토리 텍스트 연출 시스템 ---
let storyTypingSpeed = 45; // 타자기 느린 타이핑 (밀리초)
let storyTextComplete = false;
let storyClickPending = false;
let storyPages = []; // 페이지 분할된 스토리
let storyCurrentPage = 0; // 현재 페이지
let storyTotalPages = 0; // 전체 페이지 수
let lastTypedCharIndex = 0; // 마지막으로 소리낸 문자 인덱스
let storyStateEnterTime = 0; // 스토리 상태 진입 시간 (클릭 디바운스용)

// 타자기 효과음 (Web Audio API)
let typewriterAudioContext = null;
function playTypewriterSound() {
    try {
        if (!typewriterAudioContext) {
            typewriterAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ctx = typewriterAudioContext;
        const now = ctx.currentTime;

        // 메인 클릭 소리 (낮은 주파수)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.exponentialRampToValueAtTime(400, now + 0.03);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.05);

        // 메커니컬 딸깍 소리 (높은 주파수)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.02);
        gain2.gain.setValueAtTime(0.05, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.04);

        // 노이즈로 기계적 느낌 추가
        const bufferSize = ctx.sampleRate * 0.01;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.03, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);

    } catch (e) {
        // 오디오 컨텍스트 문제 무시
    }
}

// 스토리 텍스트를 페이지로 분할하는 함수 (UI/UX 개선)
function splitStoryIntoPages(text, maxWidth, maxHeight, lineHeight, fontSize = 13) {
    const pages = [];
    // 앞뒤 공백 및 불필요한 연속 개행 정리
    text = text.trim().replace(/\n{3,}/g, '\n\n');
    const paragraphs = text.split('\n');
    let currentPage = [];
    let currentPageHeight = 0;

    // 하단 UI 여백 (안내 텍스트 공간 확보)
    const bottomMargin = 80; // 픽셀
    const effectiveMaxHeight = maxHeight - bottomMargin;

    // 문단 간 여백
    const paragraphSpacing = lineHeight * 0.5; // 줄 높이의 50%

    // 임시 캔버스 컨텍스트 생성 (너비 측정용)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSize}px "Press Start 2P"`;

    for (const paragraph of paragraphs) {
        let paragraphHeight = 0;

        if (paragraph.trim() === '') {
            paragraphHeight = lineHeight;
        } else if (paragraph.startsWith('■■■■') || paragraph.startsWith('EPISODE') || paragraph.startsWith('\'')) {
            // 제목/특수 문단: 여백 추가
            paragraphHeight = lineHeight + paragraphSpacing;
        } else {
            // 일반 텍스트의 줄 수 계산
            let line = '';
            let lineCount = 1;
            for (let n = 0; n < paragraph.length; n++) {
                const char = paragraph[n];
                const testLine = line + char;
                const metrics = tempCtx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lineCount++;
                    line = char;
                } else {
                    line = testLine;
                }
            }
            // 본문 문단도 하단 여백 추가
            paragraphHeight = (lineCount * lineHeight) + paragraphSpacing;
        }

        // 현재 문단이 단독으로 최대 높이를 초과하는 경우 (방어 코드)
        if (paragraphHeight > effectiveMaxHeight && currentPage.length === 0) {
            currentPage.push(paragraph);
            pages.push(currentPage.join('\n'));
            currentPage = [];
            currentPageHeight = 0;
            continue;
        }

        // 현재 페이지에 추가할 수 있는지 확인
        if (currentPageHeight + paragraphHeight > effectiveMaxHeight && currentPage.length > 0) {
            // 새 페이지 시작
            pages.push(currentPage.join('\n'));
            currentPage = [paragraph];
            currentPageHeight = paragraphHeight;
        } else {
            currentPage.push(paragraph);
            currentPageHeight += paragraphHeight;
        }
    }

    // 마지막 페이지 추가 (비어있지 않은 경우에만)
    if (currentPage.length > 0 && currentPage.join('\n').trim() !== '') {
        pages.push(currentPage.join('\n'));
    }

    // 빈 페이지 필터링 (최종 안전장치)
    return pages.filter(p => p.trim().length > 0);
}

// 스토리 다음 페이지로 이동
function nextStoryPage() {
    if (storyCurrentPage < storyTotalPages - 1) {
        storyCurrentPage++;
        storyDisplayTime = Date.now();
        storyStateEnterTime = Date.now(); // 새 페이지 진입 시간 갱신
        storyTextComplete = false;
        lastTypedCharIndex = 0; // 타자기 인덱스 초기화
        return false; // 아직 끝나지 않음
    } else {
        // 모든 페이지 끝, 게임 시작
        startGameplay();
        return true; // 끝남
    }
}

function drawEpilogueScreen(ctx, timestamp) {
    if (!EPILOGUE_TEXT) {
        currentState = GAME_STATE.GAME_CLEAR_IMAGE;
        gameClearImageStartTime = Date.now();
        return;
    }

    // 페이지 분할 (처음 한 번만)
    if (storyPages.length === 0) {
        const maxWidth = Math.min(GAME_WIDTH * 0.85, 800);

        const isMobile = isMobileTouchDevice();
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobileLandscape = isMobile && !isPortrait;

        const storyFontSize = isMobileLandscape ? 13 : 13;
        const storyLineHeight = isMobileLandscape ? 24 : 26;
        const topMargin = isMobileLandscape ? 120 : 170;
        const bottomMargin = isMobileLandscape ? 60 : 80;

        const maxHeight = GAME_HEIGHT - topMargin - bottomMargin;
        const lineHeight = storyLineHeight;
        storyPages = splitStoryIntoPages(EPILOGUE_TEXT, maxWidth, maxHeight, lineHeight, storyFontSize);
        storyTotalPages = storyPages.length;
        storyCurrentPage = 0;
        storyDisplayTime = Date.now();
        storyStateEnterTime = Date.now();
        storyTextComplete = false;
        lastTypedCharIndex = 0;
        console.log(`[Epilogue] Initialized, pages: ${storyTotalPages}`);
    }

    if (!storyDisplayTime || storyDisplayTime <= 0 || storyDisplayTime > Date.now() + 1000) {
        storyDisplayTime = Date.now();
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const isMobileLandscape = isMobileTouchDevice() && window.innerHeight <= window.innerWidth;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const episodeFontSize = isMobileLandscape ? 14 : 16;
    const episodeY = isMobileLandscape ? 20 : 30;
    const pageY = isMobileLandscape ? 42 : 55;

    ctx.font = `bold ${episodeFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#e74c3c';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#e74c3c';
    ctx.fillText(`EPILOGUE`, GAME_WIDTH / 2, episodeY);

    if (storyTotalPages > 1) {
        ctx.font = `${isMobileLandscape ? 10 : 12}px "Press Start 2P"`;
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillText(`PAGE ${storyCurrentPage + 1} / ${storyTotalPages}`, GAME_WIDTH / 2, pageY);
    }
    ctx.restore();

    const currentPageText = storyPages[storyCurrentPage] || '';
    const elapsed = Date.now() - storyDisplayTime;
    const charCount = Math.floor(elapsed / storyTypingSpeed);
    const displayText = currentPageText.substring(0, charCount);

    if (charCount > lastTypedCharIndex && charCount < currentPageText.length) {
        const currentChar = currentPageText[charCount - 1];
        if (currentChar && currentChar !== ' ' && currentChar !== '\n') {
            if (Math.random() > 0.15) {
                playTypewriterSound();
            }
        }
        lastTypedCharIndex = charCount;
    }

    storyTextComplete = charCount >= currentPageText.length;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const storyFontSize = isMobileLandscape ? 14 : 13;
    const storyLineHeight = isMobileLandscape ? 24 : 26;
    const storyStartY = isMobileLandscape ? 70 : 85;

    ctx.font = `${storyFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';

    const maxWidth = Math.min(GAME_WIDTH * 0.85, 800);
    const startX = (GAME_WIDTH - maxWidth) / 2;
    const startY = storyStartY;
    const lineHeight = storyLineHeight;

    const paragraphs = displayText.split('\n');
    let currentY = startY;
    const paragraphSpacing = lineHeight * 0.5;

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const isLastParagraph = i === paragraphs.length - 1;

        if (paragraph.trim() === '') {
            currentY += lineHeight;
        } else if (paragraph.startsWith('■■■■') || paragraph.startsWith('EPISODE') || paragraph.startsWith('\'') || paragraph.startsWith('[')) {
            ctx.textAlign = 'center';
            ctx.fillStyle = paragraph.startsWith('■') ? '#f1c40f' : (paragraph.startsWith('\'') ? '#00ffff' : '#ffffff');
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            ctx.fillText(paragraph, GAME_WIDTH / 2, currentY);
            ctx.shadowBlur = 0;
            currentY += lineHeight + paragraphSpacing;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
        } else {
            currentY = wrapTextLeftAlign(ctx, paragraph, startX, currentY, maxWidth, lineHeight);
            if (!isLastParagraph) {
                currentY += paragraphSpacing;
            }
        }
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const blink = Math.sin(Date.now() / 300) > 0;
    ctx.font = 'bold 12px "Press Start 2P"';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';

    let promptText;
    if (storyTextComplete) {
        if (storyCurrentPage < storyTotalPages - 1) {
            ctx.fillStyle = blink ? '#00ffff' : '#0088aa';
            promptText = isMobileTouchDevice() ? '▼ TAP FOR NEXT PAGE ▼' : '▼ CLICK or TAB: NEXT PAGE ▼';
        } else {
            ctx.fillStyle = blink ? '#f1c40f' : '#c9a227';
            promptText = isMobileTouchDevice() ? '▼ TAP TO FINISH ▼' : '▼ CLICK or TAB: FINISH ▼';
        }
    } else {
        ctx.fillStyle = '#888888';
        promptText = isMobileTouchDevice() ? '...TYPING...' : '...TYPING...';
    }

    ctx.fillText(promptText, GAME_WIDTH / 2, GAME_HEIGHT - 30);
    
    // 가로모드에서 더블탭 스킵 힌트 추가
    if (isMobileLandscapeOrientation()) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('▼ DOUBLE TAP TO SKIP ▼', GAME_WIDTH / 2, GAME_HEIGHT - 12);
    }
    
    ctx.restore();
}

function drawStoryScreen(ctx, timestamp) {
    const stage = STAGE_DATA[currentStage];
    if (!stage || !stage.storyText) {
        startGameplay();
        return;
    }

    // 페이지 분할 (처음 한 번만)
    if (storyPages.length === 0) {
        const maxWidth = Math.min(GAME_WIDTH * 0.85, 800);

        // 모바일 가로 모드 감지
        const isMobile = isMobileTouchDevice();
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobileLandscape = isMobile && !isPortrait;

        // 가로 모드: 더 큰 폰트와 줄 높이, 여백
        const storyFontSize = isMobileLandscape ? 13 : 13; // 가시성 위해 가로 모드에서도 최소 13px 유지
        const storyLineHeight = isMobileLandscape ? 24 : 26;
        const topMargin = isMobileLandscape ? 120 : 170; // 상단 여백 줄임
        const bottomMargin = isMobileLandscape ? 60 : 80; // 하단 여백

        const maxHeight = GAME_HEIGHT - topMargin - bottomMargin; // 효과적인 텍스트 영역 높이
        const lineHeight = storyLineHeight;
        // 폰트 크기 전달하여 정확한 페이지 분할
        storyPages = splitStoryIntoPages(stage.storyText, maxWidth, maxHeight, lineHeight, storyFontSize);
        storyTotalPages = storyPages.length;
        storyCurrentPage = 0;
        // 처음부터 타이핑되도록 시간 초기화
        storyDisplayTime = Date.now();
        storyStateEnterTime = Date.now(); // 페이지 초기화 시에도 시간 갱신
        storyTextComplete = false;
        lastTypedCharIndex = 0;
        console.log(`[Story] Stage ${currentStage} story initialized, pages: ${storyTotalPages}, time: ${storyDisplayTime}`);
    }

    // 추가 안전장치: storyDisplayTime이 0이거나 미래면 현재 시간으로 재설정
    if (!storyDisplayTime || storyDisplayTime <= 0 || storyDisplayTime > Date.now() + 1000) {
        storyDisplayTime = Date.now();
        console.log(`[Story] Time reset to now: ${storyDisplayTime}`);
    }

    // 검은 배경
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 모바일 가로 모드 감지 (이미 위에서 정의된 값 사용)
    const isMobileLandscape = isMobileTouchDevice() && window.innerHeight <= window.innerWidth;

    // 상단 에피소드 및 페이지 표시
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 가로 모드: 더 작은 폰트와 위치
    const episodeFontSize = isMobileLandscape ? 14 : 16;
    const episodeY = isMobileLandscape ? 20 : 30;
    const pageY = isMobileLandscape ? 42 : 55;

    ctx.font = `bold ${episodeFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#e74c3c';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#e74c3c';
    ctx.fillText(`EPISODE ${currentStage}`, GAME_WIDTH / 2, episodeY);

    // 페이지 인디케이터
    if (storyTotalPages > 1) {
        ctx.font = `${isMobileLandscape ? 10 : 12}px "Press Start 2P"`;
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillText(`PAGE ${storyCurrentPage + 1} / ${storyTotalPages}`, GAME_WIDTH / 2, pageY);
    }
    ctx.restore();

    // 현재 페이지 텍스트 표시 (타이핑 효과)
    const currentPageText = storyPages[storyCurrentPage] || '';
    const elapsed = Date.now() - storyDisplayTime;
    const charCount = Math.floor(elapsed / storyTypingSpeed);
    const displayText = currentPageText.substring(0, charCount);

    // 새로운 문자가 타이핑될 때 효과음 재생
    if (charCount > lastTypedCharIndex && charCount < currentPageText.length) {
        // 공백이나 줄바꿈이 아닌 문자만 소리냄
        const currentChar = currentPageText[charCount - 1];
        if (currentChar && currentChar !== ' ' && currentChar !== '\n') {
            // 연속으로 너무 많이 재생되지 않도록 약간의 확률 조정
            if (Math.random() > 0.15) {
                playTypewriterSound();
            }
        }
        lastTypedCharIndex = charCount;
    }

    // 현재 페이지의 타이핑이 완료되었는지 확인
    storyTextComplete = charCount >= currentPageText.length;

    // 스토리 텍스트 렌더링
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // isMobileLandscape는 위에서 이미 선언됨
    // 가로 모드: 텍스트 가시성 강화
    const storyFontSize = isMobileLandscape ? 14 : 13; // 가로 모드에서 폰트 크기 상향
    const storyLineHeight = isMobileLandscape ? 24 : 26;
    const storyStartY = isMobileLandscape ? 70 : 85;

    ctx.font = `${storyFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#ffffff';
    // 텍스트 그림자 추가로 가시성 극대화
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';

    const maxWidth = Math.min(GAME_WIDTH * 0.85, 800);
    const startX = (GAME_WIDTH - maxWidth) / 2;
    const startY = storyStartY;
    const lineHeight = storyLineHeight;

    const paragraphs = displayText.split('\n');
    let currentY = startY;

    // 문단 간 여백
    const paragraphSpacing = lineHeight * 0.5;

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const isLastParagraph = i === paragraphs.length - 1;

        if (paragraph.trim() === '') {
            currentY += lineHeight;
        } else if (paragraph.startsWith('■■■■') || paragraph.startsWith('EPISODE') || paragraph.startsWith('\'')) {
            // 제목/특수 문단: 상하 여백 추가
            ctx.textAlign = 'center';
            ctx.fillStyle = paragraph.startsWith('■') ? '#f1c40f' : (paragraph.startsWith('\'') ? '#00ffff' : '#ffffff');
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            ctx.fillText(paragraph, GAME_WIDTH / 2, currentY);
            ctx.shadowBlur = 0;
            currentY += lineHeight + paragraphSpacing;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
        } else {
            // 일반 텍스트: 문단 하단 여백 추가
            currentY = wrapTextLeftAlign(ctx, paragraph, startX, currentY, maxWidth, lineHeight);
            // 마지막 문단이 아니면 여백 추가
            if (!isLastParagraph) {
                currentY += paragraphSpacing;
            }
        }
    }
    ctx.restore();

    // 하단 안내 텍스트
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const blink = Math.sin(Date.now() / 300) > 0;
    ctx.font = 'bold 12px "Press Start 2P"';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';

    let promptText;
    if (storyTextComplete) {
        if (storyCurrentPage < storyTotalPages - 1) {
            // 다음 페이지 있음
            ctx.fillStyle = blink ? '#00ffff' : '#0088aa';
            promptText = isMobileTouchDevice() ? '▼ TAP FOR NEXT PAGE ▼' : '▼ CLICK or TAB: NEXT PAGE ▼';
        } else {
            // 마지막 페이지
            ctx.fillStyle = blink ? '#f1c40f' : '#c9a227';
            promptText = isMobileTouchDevice() ? '▼ TAP TO START ▼' : '▼ CLICK or TAB: START GAME ▼';
        }
    } else {
        // 타이핑 중
        ctx.fillStyle = '#888888';
        promptText = isMobileTouchDevice() ? '...TYPING...' : '...TYPING...';
    }

    ctx.fillText(promptText, GAME_WIDTH / 2, GAME_HEIGHT - 30);

    // 스킵 안내 - 가로모드에서만 더블탭 스킵 표시
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#666666';
    ctx.shadowBlur = 0;
    if (isMobileLandscapeOrientation()) {
        ctx.fillText('▼ DOUBLE TAP TO SKIP ▼', GAME_WIDTH / 2, GAME_HEIGHT - 12);
    } else if (!isMobileTouchDevice()) {
        ctx.fillText('▼ PRESS ESC TO SKIP ▼', GAME_WIDTH / 2, GAME_HEIGHT - 12);
    }

    ctx.restore();
}

function wrapTextLeftAlign(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    let currentY = y;
    let lineCount = 0;

    for (let n = 0; n < text.length; n++) {
        const char = text[n];
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = char;
            currentY += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    // 마지막 줄 출력
    if (line) {
        ctx.fillText(line, x, currentY);
        lineCount++;
    }
    // 다음 시작 위치 반환 (마지막 줄의 다음 위치)
    return currentY + lineHeight;
}

// 레거시 함수 - 게임 중 스토리 표시용 (사용 안함)
function drawStoryText(ctx, timestamp) {
    // 이제 게임 시작 전에만 스토리 표시
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
    console.log("[Yeon-Game] init() started!");
    try {
        console.log("[Yeon-Game] Loading all assets...");
        await ImageLoader.loadAllAssets();
        console.log("[Yeon-Game] All assets loaded successfully!");
        
        console.log("[Yeon-Game] Initializing LevelSystem...");
        LevelSystem.init();
        console.log("[Yeon-Game] Initializing Player...");
        Player.init();
        
        console.log("[Yeon-Game] Updating UI visibility...");
        updateMainMenuVisibility();
        updateInstallButtonVisibility();
        updateGameOverButtonVisibility();

    // 패스워드 및 스테이지 선택 이벤트 리스너 설정
    if (passwordSubmitBtn) {
        passwordSubmitBtn.addEventListener('click', checkStagePassword);
    }
    if (stagePasswordInput) {
        // 키 입력 시 dots 업데이트
        stagePasswordInput.addEventListener('input', (e) => {
            updatePasswordDots(e.target.value.length);
        });
        // 포커스 시 활성화 표시
        stagePasswordInput.addEventListener('focus', () => {
            updatePasswordDots(stagePasswordInput.value.length);
        });
        stagePasswordInput.addEventListener('blur', () => {
            updatePasswordDots(stagePasswordInput.value.length);
        });
        // Enter 키로 제출
        stagePasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkStagePassword();
        });
        // 입력 필드 클릭 이벤트 (디버깅용)
        stagePasswordInput.addEventListener('click', () => {
            console.log('[Password] Input clicked/focused');
        });
    }
    // password-dots 영역 클릭 시 입력 필드 포커스
    if (passwordDots && stagePasswordInput) {
        passwordDots.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('[Password] Dots clicked, focusing input');
            stagePasswordInput.focus();
        });
        // 터치 이벤트도 추가 (모바일)
        passwordDots.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log('[Password] Dots touched, focusing input');
            stagePasswordInput.focus();
        });
    }
    // password-panel 접기/펴기 토글
    const passwordPanel = document.getElementById('password-panel');
    if (passwordPanel) {
        passwordPanel.addEventListener('click', (e) => {
            // 입력 필드나 버튼을 클릭한 경우는 무시 (접힌 상태에서 아이콘 클릭시에만 토글)
            if (passwordPanel.classList.contains('collapsed')) {
                passwordPanel.classList.remove('collapsed');
                e.stopPropagation();
            }
        });

        // 아이콘(열쇠) 클릭 시에도 토글 지원
        const passwordIcon = passwordPanel.querySelector('.password-icon');
        if (passwordIcon) {
            passwordIcon.addEventListener('click', (e) => {
                if (!passwordPanel.classList.contains('collapsed')) {
                    passwordPanel.classList.add('collapsed');
                    e.stopPropagation();
                }
            });
        }
    }

    if (stageSelectCloseBtn) {
        stageSelectCloseBtn.addEventListener('click', () => {
            hideStageSelectUI();
            // 메인 메뉴로 돌아가기
            isStageUnlocked = false;
            updateMainMenuVisibility();
        });
    }
    // 스테이지 버튼 이벤트 리스너 - 각 버튼에 명시적으로 설정
    stageButtons.forEach((btn, index) => {
        // 클릭 이벤트
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const stageNum = parseInt(btn.dataset.stage);
            console.log(`[Stage Select] Button ${stageNum} clicked`);
            startGameAtStage(stageNum);
        });
        // 마우스 다운 이벤트 (더 빠른 반응)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const stageNum = parseInt(btn.dataset.stage);
            console.log(`[Stage Select] Button ${stageNum} mousedown`);
            startGameAtStage(stageNum);
        });
        // 터치 이벤트도 추가 (모바일 대응)
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const stageNum = parseInt(btn.dataset.stage);
            console.log(`[Stage Select] Button ${stageNum} touched`);
            startGameAtStage(stageNum);
        });
    });
    console.log(`[Init] ${stageButtons.length} stage buttons initialized`);

    // 스테이지 선택 컨테이너에 이벤트 위임 (백업 방법)
    if (stageSelectContainer) {
        stageSelectContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.stage-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const stageNum = parseInt(btn.dataset.stage);
                console.log(`[Stage Select] Delegated click for stage ${stageNum}`);
                startGameAtStage(stageNum);
            }
        });
    }

    // 모바일 메인 화면 즉시 전체화면
    if (isMobileTouchDevice()) {
        requestMobileMainFullscreen();
        handleMobileOrientation();
    }

    // 초기 모바일 상태 체크
    checkMobileEasyModeStatus();

    animationId = requestAnimationFrame(gameLoop);
    } catch (err) {
        console.error("[Yeon-Game] Fatal initialization error:", err);
    }
}

// 모바일 첫 터치 시 전체화면
if (isMobileTouchDevice()) {
    document.addEventListener('touchstart', () => {
        if (currentState === GAME_STATE.START && !document.fullscreenElement) {
            requestMobileMainFullscreen();
        }
    }, { once: true });
}

// ==========================================
// 모바일 뒤로가기 버튼 처리 (2번 누르면 종료)
// ==========================================
let backButtonPressCount = 0;
let backButtonTimer = null;
const BACK_BUTTON_EXIT_DELAY = 2000; // 2초 내에 2번 눌러야 종료

// History API를 사용하여 뒤로가기 감지
if (isMobileTouchDevice()) {
    // 초기 상태 푸시
    history.pushState({ page: 'game' }, '', location.href);

    // 뒤로가기 버튼 감지
    window.addEventListener('popstate', (e) => {
        // 뒤로가기 버튼 눌림
        backButtonPressCount++;
        console.log(`[Back Button] Pressed ${backButtonPressCount} time(s)`);

        if (backButtonPressCount === 1) {
            // 첫 번째 누름: 토스트 메시지 표시
            showBackButtonToast('Press back again to exit');

            // 타이머 시작
            backButtonTimer = setTimeout(() => {
                backButtonPressCount = 0;
                console.log('[Back Button] Timer reset');
            }, BACK_BUTTON_EXIT_DELAY);

            // 상태 다시 푸시 (뒤로가기 막기)
            history.pushState({ page: 'game' }, '', location.href);

        } else if (backButtonPressCount >= 2) {
            // 두 번째 누름: 게임 종료
            console.log('[Back Button] Exit game');
            clearTimeout(backButtonTimer);
            exitGame();
        }
    });
}

// 뒤로가기 토스트 메시지 표시
function showBackButtonToast(message) {
    // 기존 토스트 제거
    const existingToast = document.getElementById('back-button-toast');
    if (existingToast) existingToast.remove();

    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.id = 'back-button-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 12px 24px;
        border-radius: 4px;
        font-family: 'Press Start 2P', cursive;
        font-size: 10px;
        z-index: 10000;
        border: 2px solid #ff4757;
        animation: fadeInOut 2s ease-in-out;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 2초 후 제거
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 2000);
}

// 페이드 인/아웃 애니메이션 CSS
const backButtonStyle = document.createElement('style');
backButtonStyle.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;

// Back button style을 head에 추가
document.head.appendChild(backButtonStyle);

// 게임 초기화
init();
