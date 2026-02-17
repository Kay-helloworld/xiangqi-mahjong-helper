// 象棋麻將助手 - 戰術智慧版 (V2)

const TILES = {
    R7: { name: '帥', count: 1, val: 7, type: 'red' },
    R6: { name: '仕', count: 2, val: 6, type: 'red' },
    R5: { name: '相', count: 2, val: 5, type: 'red' },
    R4: { name: '俥', count: 2, val: 4, type: 'red' },
    R3: { name: '傌', count: 2, val: 3, type: 'red' },
    R2: { name: '炮', count: 2, val: 2, type: 'red' },
    R1: { name: '兵', count: 5, val: 1, type: 'red' },
    B7: { name: '將', count: 1, val: 7, type: 'black' },
    B6: { name: '士', count: 2, val: 6, type: 'black' },
    B5: { name: '象', count: 2, val: 5, type: 'black' },
    B4: { name: '車', count: 2, val: 4, type: 'black' },
    B3: { name: '馬', count: 2, val: 3, type: 'black' },
    B2: { name: '包', count: 2, val: 2, type: 'black' },
    B1: { name: '卒', count: 5, val: 1, type: 'black' }
};

const ID_MAP = {
    '帥': 'R7', '仕': 'R6', '相': 'R5', '俥': 'R4', '傌': 'R3', '炮': 'R2', '兵': 'R1',
    '將': 'B7', '士': 'B6', '象': 'B5', '車': 'B4', '馬': 'B3', '包': 'B2', '卒': 'B1'
};
const REV_MAP = Object.fromEntries(Object.entries(ID_MAP).map(([k, v]) => [v, k]));

const PLAYER_NAMES = ['我', '下家', '對家', '上家'];

const MELDS_DEFINITIONS = [
    ['R7', 'R6', 'R5'], // 帥仕相
    ['B7', 'B6', 'B5'], // 將士象
    ['R4', 'R3', 'R2'], // 俥傌炮
    ['B4', 'B3', 'B2']  // 車馬包
];

let gameState = {
    wallCount: 32,
    myHand: [],
    drawnTile: null,
    rivers: [[], [], [], []],
    melds: [[], [], [], []],
    mode: 'hand',
    selectedPlayer: 3,
    history: []
};

let tempAction = null;
let tempMeld = null;

function pushHistory() {
    gameState.history.push(JSON.parse(JSON.stringify({
        wallCount: gameState.wallCount,
        myHand: gameState.myHand,
        drawnTile: gameState.drawnTile,
        rivers: gameState.rivers,
        melds: gameState.melds,
        selectedPlayer: gameState.selectedPlayer,
        mode: gameState.mode
    })));
}

function undo() {
    if (gameState.history.length === 0) return;
    const prev = gameState.history.pop();
    Object.assign(gameState, prev);
    render();
    closeModals();
}

function init() {
    gameState = {
        wallCount: 32,
        myHand: [],
        drawnTile: null,
        rivers: [[], [], [], []],
        melds: [[], [], [], []],
        mode: 'hand',
        selectedPlayer: 3,
        history: []
    };
    render();
    attachEvents();
}

function inputTile(char) {
    const id = ID_MAP[char];
    if (!id) return;
    if (document.getElementById('meldInputModal').classList.contains('show')) return;

    pushHistory();
    gameState.wallCount--;
    if (gameState.wallCount < 0) gameState.wallCount = 0;

    if (gameState.mode === 'hand') {
        if (gameState.drawnTile) {
            alert('手牌已滿 (+1)，請先打出一張牌');
            gameState.history.pop();
            return;
        }
        if (gameState.myHand.length < 4) {
            gameState.myHand.push(id);
            sortHand();
        } else {
            gameState.drawnTile = id;
        }
    } else {
        gameState.rivers[gameState.selectedPlayer].push(id);
    }
    render();
}

function discardMe(index) {
    pushHistory();
    let tile;
    if (index === -1) {
        tile = gameState.drawnTile;
        gameState.drawnTile = null;
    } else {
        tile = gameState.myHand[index];
        gameState.myHand.splice(index, 1);
        if (gameState.drawnTile) {
            gameState.myHand.push(gameState.drawnTile);
            gameState.drawnTile = null;
            sortHand();
        }
    }
    gameState.rivers[0].push(tile);
    render();
}

function sortHand() {
    const val = (id) => {
        const type = id[0];
        const v = parseInt(id[1]);
        return type === 'R' ? 10 + v : v;
    };
    gameState.myHand.sort((a, b) => val(b) - val(a));
}

function onRiverClick(pIdx, tIdx, id) {
    tempAction = { sourceP: pIdx, sourceTIdx: tIdx, tileId: id };
    const eaterIdx = (pIdx + 1) % 4;
    tempMeld = { eater: eaterIdx, tiles: [id] };
    const eaterName = PLAYER_NAMES[eaterIdx];
    document.getElementById('meld-title').textContent = `${eaterName} 吃 ${REV_MAP[id]}?`;
    updateMeldPreview();
    document.getElementById('meldInputModal').classList.add('show');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(el => el.classList.remove('show'));
    tempAction = null;
    tempMeld = null;
}

function updateMeldPreview() {
    const container = document.getElementById('meld-preview');
    container.innerHTML = tempMeld.tiles.map(id => createTile(id, 'normal')).join('');
}

function onDeleteTile() {
    if (!tempAction) return;
    pushHistory();
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);
    gameState.wallCount++;
    closeModals();
    render();
}

function finishMeld() {
    if (!tempMeld || !tempAction) return;
    pushHistory();

    // 移除河牌
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    // 加入吃牌區
    gameState.melds[tempMeld.eater].push({
        type: 'eat',
        tiles: tempMeld.tiles,
        from: tempAction.sourceP
    });

    if (tempMeld.eater === 0) {
        if (gameState.myHand.length === 4) gameState.drawnTile = tempMeld.tiles[0];
        else { gameState.myHand.push(tempMeld.tiles[0]); sortHand(); }
        gameState.mode = 'hand'; // 我吃牌，選中模式為 hand
    } else {
        gameState.selectedPlayer = tempMeld.eater; // 自動切換到吃牌的那家
        gameState.mode = 'record';
    }

    closeModals();
    render();
}

// --- 核心 AI 邏輯 ---

function checkHu(tiles) {
    if (tiles.length !== 5) return false;
    const counts = {};
    tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);

    // 1. 五兵/五卒判定
    if (counts['R1'] === 5 || counts['B1'] === 5) return { type: 'five_pawns', score: 50 };

    // 2. 3+2 結構判定 (必須有對子 + 一組面子)
    const uniqueTiles = Object.keys(counts);
    for (let pairTile of uniqueTiles) {
        if (counts[pairTile] >= 2) {
            let remaining = [...tiles];
            // 移除兩張對子
            const firstIdx = remaining.indexOf(pairTile);
            remaining.splice(firstIdx, 1);
            const secondIdx = remaining.indexOf(pairTile);
            remaining.splice(secondIdx, 1);

            if (isMeld(remaining)) return { type: 'normal', score: calculateScore(tiles) };
        }
    }
    return false;
}

function isMeld(tiles) {
    if (tiles.length !== 3) return false;
    const sorted = [...tiles].sort();

    // 刻子
    if (sorted[0] === sorted[1] && sorted[1] === sorted[2]) return true;

    // 順子
    for (let mDef of MELDS_DEFINITIONS) {
        let sortedDef = [...mDef].sort();
        if (sorted[0] === sortedDef[0] && sorted[1] === sortedDef[1] && sorted[2] === sortedDef[2]) return true;
    }
    return false;
}

function calculateScore(tiles) {
    const isRed = tiles.every(t => t.startsWith('R'));
    const isBlack = tiles.every(t => t.startsWith('B'));
    return (isRed || isBlack) ? 20 : 10;
}

function getRemaining(id) {
    let count = TILES[id].count;
    gameState.myHand.forEach(t => { if (t === id) count--; });
    if (gameState.drawnTile === id) count--;
    gameState.rivers.forEach(r => r.forEach(t => { if (t === id) count--; }));
    gameState.melds.forEach(mList => mList.forEach(m => m.tiles.forEach(t => { if (t === id) count--; })));
    return Math.max(0, count);
}

// --- 戰術權重邏輯 (當胡牌機率相差不遠或為0時) ---
function evaluateHandPotential(tiles) {
    let score = 0;
    const counts = {};
    tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);

    // 1. 清一色潛力 (同色牌越多加越多)
    const reds = tiles.filter(t => t[0] === 'R').length;
    const blacks = tiles.filter(t => t[0] === 'B').length;
    score += Math.max(reds, blacks) * 2;

    // 2. 對子加分
    Object.values(counts).forEach(c => { if (c >= 2) score += 5; });

    // 3. 順子搭子加分 (檢查是否有 2/3 的順子)
    // 簡單判定：遍歷所有定義的順子，看手牌包含其中幾個
    for (let def of MELDS_DEFINITIONS) {
        let matchCount = 0;
        let localCounts = { ...counts };
        def.forEach(d => { if (localCounts[d] > 0) { matchCount++; localCounts[d]--; } });
        if (matchCount === 2) score += 4;
        if (matchCount === 3) score += 10;
    }

    // 4. 五兵潛力
    if (counts['R1'] >= 2) score += counts['R1'] * 3;
    if (counts['B1'] >= 2) score += counts['B1'] * 3;

    return score;
}

function getWaitingTiles(fourTiles) {
    let waiting = [];
    const allPossibleIds = Object.keys(TILES);
    const wallLeft = Math.max(1, gameState.wallCount);

    allPossibleIds.forEach(id => {
        const count = getRemaining(id);
        if (count > 0) {
            const hu = checkHu([...fourTiles, id]);
            if (hu) {
                waiting.push({ id, count, huScore: hu.score, ev: (count / wallLeft) * hu.score });
            }
        }
    });
    return waiting;
}

function analyze() {
    const defenseEl = document.getElementById('rec-defense');
    const offenseEl = document.getElementById('rec-offense');

    // 防守：僅顯示目前河裡的現物
    let safeTiles = new Set();
    gameState.rivers.forEach(r => r.forEach(t => safeTiles.add(t)));
    let warnings = [];
    for (let i = 1; i <= 3; i++) {
        if (gameState.melds[i].some(m => m.tiles.includes('R1') || m.tiles.includes('B1'))) {
            warnings.push(`${PLAYER_NAMES[i]}聽兵!`);
        }
    }
    let dHtml = '<div class="defense-list">';
    if (warnings.length > 0) dHtml += `<div class="warning-text">${warnings.join(' ')}</div>`;
    dHtml += '<div class="safe-icons">' + Array.from(safeTiles).map(id => createTile(id, 'tiny')).join('') + '</div></div>';
    defenseEl.innerHTML = dHtml;

    // 進攻
    if (gameState.myHand.length < 4) {
        offenseEl.innerHTML = '<div class="placeholder-text">先輸入 4 張手牌</div>';
        return;
    }

    const currentHand = [...gameState.myHand];
    if (gameState.drawnTile) currentHand.push(gameState.drawnTile);

    // 已胡牌判定
    if (currentHand.length === 5) {
        const hu = checkHu(currentHand);
        if (hu) {
            offenseEl.innerHTML = `<div style="color:#ffeb3b; font-weight:bold; text-align:center;">✨ 已胡牌: ${hu.score}分</div>`;
            return;
        }
    }

    if (currentHand.length === 4) {
        const waiting = getWaitingTiles(currentHand);
        if (waiting.length === 0) {
            offenseEl.innerHTML = '<div class="placeholder-text">目前未聽牌 (向聽中)</div>';
        } else {
            let html = '<div class="ev-list">';
            waiting.sort((a, b) => b.ev - a.ev).forEach(w => {
                html += `<div class="ev-item">${createTile(w.id, 'tiny')} x ${w.count}張 (EV:${w.ev.toFixed(1)})</div>`;
            });
            offenseEl.innerHTML = html + '</div>';
        }
    } else {
        // 5 張牌的建議打法
        let analysis = [];
        const choices = [...new Set(currentHand)];
        choices.forEach(t => {
            let nextHand = [...currentHand];
            nextHand.splice(nextHand.indexOf(t), 1);

            const waitings = getWaitingTiles(nextHand);
            const totalEV = waitings.reduce((s, w) => s + w.ev, 0);
            const totalWaitCount = waitings.reduce((s, w) => s + w.count, 0);

            // 如果 EV 是 0，根據潛力模型評分
            const potential = evaluateHandPotential(nextHand);

            analysis.push({ id: t, ev: totalEV, wCount: totalWaitCount, potential: potential });
        });

        // 排序：EV 優先，Potential 其次
        analysis.sort((a, b) => b.ev - a.ev || b.potential - a.potential);

        let html = '<div class="ev-list">';
        analysis.forEach(a => {
            let label = a.ev > 0 ? `聽${a.wCount}張 (EV:${a.ev.toFixed(1)})` : `(潛力:${a.potential})`;
            html += `<div class="ev-item">打${REV_MAP[a.id]} -> ${label}</div>`;
        });
        offenseEl.innerHTML = html + '</div>';
    }
}

function render() {
    document.getElementById('wall-count').textContent = gameState.wallCount;
    for (let i = 0; i < 4; i++) {
        const rEl = document.getElementById(`river-${i}`);
        rEl.innerHTML = '';
        gameState.rivers[i].forEach((id, idx) => {
            const div = document.createElement('div');
            div.className = createTileClass(id, 'small');
            div.innerHTML = REV_MAP[id];
            div.onclick = (e) => { e.stopPropagation(); onRiverClick(i, idx, id); };
            rEl.appendChild(div);
        });
        const mEl = document.getElementById(`melds-${i}`);
        mEl.innerHTML = gameState.melds[i].map(m => `<div class="meld-group">${m.tiles.map(id => createTile(id, 'tiny')).join('')}</div>`).join('');
        if (i > 0) {
            const oppEl = document.getElementById(`player-${i}`);
            oppEl.classList.toggle('selected', gameState.selectedPlayer === i && gameState.mode === 'record');
        }
    }
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = gameState.myHand.map((id, idx) => createTile(id, 'normal', `discardMe(${idx})`)).join('');
    const drawDiv = document.getElementById('drawn-tile');
    if (gameState.drawnTile) {
        drawDiv.innerHTML = createTile(gameState.drawnTile, 'normal', `discardMe(-1)`);
        drawDiv.classList.remove('hidden');
    } else { drawDiv.classList.add('hidden'); }
    analyze();
}

function createTile(id, size = 'normal', action = '') {
    const char = REV_MAP[id];
    const clickAttr = action ? `onclick="${action}"` : '';
    return `<div class="${createTileClass(id, size)}" ${clickAttr}>${char}</div>`;
}
function createTileClass(id, size) {
    const type = id.startsWith('R') ? 'red' : 'black';
    return `game-tile ${size} ${type}`;
}
function selectOpponent(idx) {
    gameState.selectedPlayer = idx; gameState.mode = 'record'; render();
}
function attachEvents() {
    [1, 2, 3].forEach(idx => document.getElementById(`player-${idx}`).addEventListener('click', () => selectOpponent(idx)));
    document.getElementById('draw-btn').addEventListener('click', () => { gameState.mode = 'hand'; render(); });
    document.querySelectorAll('.kb-btn').forEach(btn => { if (btn.dataset.tile) btn.addEventListener('click', () => inputTile(btn.dataset.tile)); });
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('reset-btn').addEventListener('click', () => { if (confirm('重置?')) init(); });
}
init();
attachEvents();
window.inputTile = inputTile; window.discardMe = discardMe; window.onRiverClick = onRiverClick; window.onDeleteTile = onDeleteTile; window.finishMeld = finishMeld; window.undo = undo; window.closeModals = closeModals;
