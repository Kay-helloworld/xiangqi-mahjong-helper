// 象棋麻將助手 3.0 (EV版)
// 規則：32張，手牌4張，胡牌5張 (3+2)，特殊五兵/五卒

const TILES = {
    // 紅色 (Red)
    R_K: { name: '帥', count: 1, type: 'red', val: 7 }, // King
    R_A: { name: '仕', count: 2, type: 'red', val: 6 }, // Advisor
    R_E: { name: '相', count: 2, type: 'red', val: 5 }, // Elephant
    R_R: { name: '俥', count: 2, type: 'red', val: 4 }, // Rook
    R_H: { name: '傌', count: 2, type: 'red', val: 3 }, // Horse
    R_C: { name: '炮', count: 2, type: 'red', val: 2 }, // Cannon
    R_P: { name: '兵', count: 5, type: 'red', val: 1 }, // Pawn

    // 黑色 (Black)
    B_K: { name: '將', count: 1, type: 'black', val: 7 },
    B_A: { name: '士', count: 2, type: 'black', val: 6 },
    B_E: { name: '象', count: 2, type: 'black', val: 5 },
    B_R: { name: '車', count: 2, type: 'black', val: 4 },
    B_H: { name: '馬', count: 2, type: 'black', val: 3 },
    B_C: { name: '包', count: 2, type: 'black', val: 2 },
    B_P: { name: '卒', count: 5, type: 'black', val: 1 }
};

// 為了方便計算，建立 ID 映射
// R1=兵, R2=炮 ... R7=帥
// B1=卒, B2=包 ... B7=將
const ID_MAP = {
    '帥': 'R7', '仕': 'R6', '相': 'R5', '俥': 'R4', '傌': 'R3', '炮': 'R2', '兵': 'R1',
    '將': 'B7', '士': 'B6', '象': 'B5', '車': 'B4', '馬': 'B3', '包': 'B2', '卒': 'B1'
};

const REV_MAP = Object.fromEntries(Object.entries(ID_MAP).map(([k, v]) => [v, k]));

let gameState = {
    wallCount: 32,
    tileCounts: {}, // 剩餘牌計數
    myHand: [], // 自己的手牌 (ID array)
    drawnTile: null, // 摸到的牌
    history: [] // Undo stack
};

// 初始化
function init() {
    initCounts();
    renderCounts();
    attachEvents();
    updateUI();
}

function initCounts() {
    Object.values(TILES).forEach(t => {
        // Find ID
        const id = Object.keys(ID_MAP).find(k => TILES[ID_MAP[k]] === t) ||
            (t.type === 'red' ? 'R' + t.val : 'B' + t.val);
        // 這邊有點繞，直接重新遍歷 ID_MAP
    });

    // Reset Counts
    gameState.tileCounts = {};
    for (let id in REV_MAP) {
        const char = REV_MAP[id];
        // 找原始定義
        let def;
        if (id.startsWith('R')) def = Object.values(TILES).find(x => x.name === char && x.type === 'red');
        else def = Object.values(TILES).find(x => x.name === char && x.type === 'black');

        gameState.tileCounts[id] = def ? def.count : 0;
    }

    gameState.wallCount = 32;
    gameState.myHand = [];
    gameState.drawnTile = null;
    gameState.history = [];
}

// --- 核心算法 ---

// 檢查是否胡牌 (5張)
// tiles: Array of IDs (e.g., ['R1', 'R1', 'R1', 'R2', 'R2'])
function checkHu(tiles) {
    if (tiles.length !== 5) return { isHu: false };

    const sorted = [...tiles].sort();

    // 1. 五兵/五卒 (Five Pawns) - 50分
    const isFivePawns = sorted.every(t => t === 'R1') || sorted.every(t => t === 'B1');
    if (isFivePawns) return { isHu: true, score: 50, type: '五兵/卒' };

    // 2. 標準 3+2
    // 嘗試拆出對子 (2張)
    const uniqueTiles = [...new Set(sorted)];
    for (const pairTile of uniqueTiles) {
        // 檢查是否有 >= 2 張
        const pairCount = sorted.filter(t => t === pairTile).length;
        if (pairCount >= 2) {
            // 移除一對，剩 3 張，檢查是否成組 (Set)
            const remain = removeTiles(sorted, [pairTile, pairTile]);
            if (checkSet(remain)) {
                // 胡牌！計算分數
                const score = calculateScore(sorted);
                return { isHu: true, score: score.val, type: score.type };
            }
        }
    }

    return { isHu: false };
}

// 檢查 3 張是否成組 (刻子 or 順子)
function checkSet(tiles) {
    if (tiles.length !== 3) return false;
    const t1 = tiles[0], t2 = tiles[1], t3 = tiles[2];

    // 1. 刻子 (AAA)
    if (t1 === t2 && t2 === t3) return true;

    // 2. 特殊順 (兵兵兵 / 卒卒卒) - 其實就是刻子，但因為兵有5張，任意3張都算
    if (t1 === 'R1' && t2 === 'R1' && t3 === 'R1') return true;
    if (t1 === 'B1' && t2 === 'B1' && t3 === 'B1') return true;

    // 3. 順子 (將士象 / 車馬包 / 帥仕相 / 俥傌炮)
    // 轉成數值比較
    const v1 = parseInt(t1.substr(1));
    const v2 = parseInt(t2.substr(1));
    const v3 = parseInt(t3.substr(1));
    const c1 = t1.charAt(0); // Color

    // 必須同色
    if (t2.charAt(0) !== c1 || t3.charAt(0) !== c1) return false;

    // 帥仕相 (7,6,5)
    if (v1 === 5 && v2 === 6 && v3 === 7) return true; // 排序後是 5,6,7

    // 俥傌炮 (4,3,2) -> 2,3,4
    if (v1 === 2 && v2 === 3 && v3 === 4) return true;

    return false;
}

function removeTiles(source, toRemove) {
    let res = [...source];
    toRemove.forEach(t => {
        const idx = res.indexOf(t);
        if (idx > -1) res.splice(idx, 1);
    });
    return res;
}

function calculateScore(tiles) {
    // 假設已胡牌
    // 1. 五兵/卒 (前面已檢查，這裡備用)
    if (tiles.every(t => t === 'R1' || t === 'B1')) return { val: 50, type: '五兵/卒' };

    // 2. 清一色 (Full Flush)
    const firstColor = tiles[0].charAt(0);
    const isFullColor = tiles.every(t => t.charAt(0) === firstColor);

    if (isFullColor) return { val: 20, type: '清一色' };

    // 3. 混色 (Mixed)
    return { val: 10, type: '混色' };
}

// 分析手牌 (EV計算)
function analyzeHand() {
    const hand = [...gameState.myHand];
    if (gameState.drawnTile) hand.push(gameState.drawnTile);

    // 必須有 5 張牌 (輪到我打牌)，或者 4 張牌 (等待對手打牌 - 防守模式?)
    // 這裡我們只做進攻分析：輪到我打牌(5張)，打哪張最好？

    if (hand.length !== 5) {
        document.getElementById('recommendation-list').innerHTML = '<div class="placeholder">請補齊 5 張手牌 (4張+1張摸牌)</div>';
        return;
    }

    let results = [];

    // 嘗試打出每一張
    // 為了去重，用 Set
    const uniqueDiscard = [...new Set(hand)];

    uniqueDiscard.forEach(discard => {
        const remainHand = removeTiles(hand, [discard]); // 剩 4 張

        // 檢查聽牌 (Uke-ire)
        // 遍歷所有可能的第 5 張牌 (剩餘張數 > 0)
        let effective = []; // 有效進牌 { tile, count, score }

        for (let id in gameState.tileCounts) {
            // 注意：這裡是算「剩餘幾張」，包括自己剛剛打出去的那張(假設還沒打)？
            // 不，EV是基於「未來」。
            // 我們假設已經打出 discard。

            // 剩餘張數
            // 這裡必須考慮：gameState.tileCounts 是全局剩餘。
            // 但我們手牌裡的牌還沒從 tileCounts 扣掉 (UI輸入時扣掉了)。
            // 等等，我們的邏輯是：輸入手牌時，tileCounts 就會減少。
            // 所以 gameState.tileCounts 已經是「場上剩餘 + 未知牌牆」。
            // 而我們為了模擬，必須假設把 discard 打回池子裡嗎？
            // 不，打出去就是死牌。我們看的是「牌牆裡還有多少」。

            let count = gameState.tileCounts[id] || 0;
            if (count === 0) continue;

            // 嘗試摸這張牌
            const tryTiles = [...remainHand, id];
            const hu = checkHu(tryTiles);

            if (hu.isHu) {
                effective.push({
                    tile: id,
                    count: count,
                    score: hu.score,
                    type: hu.type
                });
            }
        }

        if (effective.length > 0) {
            // 計算 EV
            // EV = Sum ( count * score ) / Total_Wall ? 
            // 簡化：EV Score = Sum ( count * score )
            let totalScore = 0;
            let totalCount = 0;
            effective.forEach(e => {
                totalScore += e.count * e.score;
                totalCount += e.count;
            });

            results.push({
                discard: discard,
                effective: effective,
                ev: totalScore,
                totalCount: totalCount
            });
        }
    });

    renderDecision(results);
}

function renderDecision(results) {
    const container = document.getElementById('recommendation-list');
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = '<div class="placeholder">相公 (無聽牌建議)，建議打孤張</div>';
        return;
    }

    // 排序：EV 高 -> 低
    results.sort((a, b) => b.ev - a.ev);

    results.forEach(res => {
        const discardName = REV_MAP[res.discard] || res.discard;
        const colorClass = res.discard.startsWith('R') ? 'red' : 'black';

        // 顯示聽牌詳情 (前3個)
        const waits = res.effective.sort((a, b) => b.score - a.score).slice(0, 4);
        let waitHtml = '';
        waits.forEach(w => {
            const wName = REV_MAP[w.tile];
            const wClass = w.tile.startsWith('R') ? 'red' : 'black';
            waitHtml += `<div class="rec-tile-s ${wClass}">${wName}</div>`;
        });
        if (res.effective.length > 4) waitHtml += `<span style="font-size:0.8rem">...</span>`;

        const html = `
        <div class="decision-item">
            <div class="rec-target ${colorClass}">
                打 ${discardName}
            </div>
            <div class="rec-info">
                <div class="rec-stat">聽 ${res.totalCount} 張牌</div>
                <div class="rec-score">EV: ${res.ev}</div>
            </div>
            <div class="rec-tiles">
                ${waitHtml}
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// --- UI 操作 ---

function inputTile(char) {
    const id = ID_MAP[char];
    if (!id) return;

    // 記錄歷史 (Undo)
    pushHistory();

    // 如果計數器已經是0，提示
    if (gameState.tileCounts[id] <= 0) {
        // 強制輸入？ (可能記錯) -> 允許，變成負數提醒
    }

    // 扣除剩餘
    gameState.tileCounts[id]--;
    gameState.wallCount--;

    // 判斷是「自己摸牌」還是「對手打牌」
    // 如果手牌未滿4張 -> 算建立手牌
    // 如果手牌4張，未摸牌 -> 算摸牌
    // 這裡我們簡化：點擊鍵盤總是算「建立手牌」或「摸牌」。
    // 對手打牌要點上面的計數器

    const handSize = gameState.myHand.length;

    if (gameState.drawnTile) {
        // 已經摸牌了，再點鍵盤？ -> 視為換牌？或者忽略
        alert('請先打出一張牌');
        popHistory(); // Revert
        return;
    }

    if (handSize < 4) {
        gameState.myHand.push(id);
    } else {
        gameState.drawnTile = id;
    }

    updateUI();
}

function enemyDiscard(id) {
    pushHistory();
    gameState.tileCounts[id]--;
    gameState.wallCount--;
    updateUI();
}

function discardTile(index) {
    pushHistory();
    // 如果是摸到的牌 (index = -1)
    if (index === -1) {
        // 打出摸到的牌
        gameState.drawnTile = null;
    } else {
        // 打出手牌，摸到的牌補進來
        gameState.myHand.splice(index, 1);
        if (gameState.drawnTile) {
            gameState.myHand.push(gameState.drawnTile);
            gameState.drawnTile = null;
            // Sort
            gameState.myHand.sort();
        }
    }
    updateUI();
}

// --- 事件 ---
function attachEvents() {
    // 鍵盤點擊
    document.querySelectorAll('.kb-btn').forEach(btn => {
        btn.addEventListener('click', () => inputTile(btn.dataset.tile));
    });

    // 撤銷
    document.getElementById('undo-btn').addEventListener('click', undo);

    // 重置
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('重置?')) init();
    });

    // 對手打牌 (點擊上方計數器)
    // 我們需要動態生成的，所以在 renderCounts 裡綁定

    document.getElementById('draw-btn').addEventListener('click', () => {
        // 這裡只是視覺上的？不，實際要有功能
        // 其實「摸牌」按鈕在這個APP裡意義不大，因為摸牌也是要輸入是什麼牌
        // 所以這個按鈕可以改成：「提示輸入摸牌」
    });
}

function pushHistory() {
    const snapshot = JSON.parse(JSON.stringify({
        tileCounts: gameState.tileCounts,
        wallCount: gameState.wallCount,
        myHand: gameState.myHand,
        drawnTile: gameState.drawnTile
    }));
    gameState.history.push(snapshot);
}

function popHistory() {
    gameState.history.pop();
}

function undo() {
    if (gameState.history.length === 0) return;
    const prev = gameState.history.pop();
    Object.assign(gameState, prev);
    updateUI();
}

function renderCounts() {
    const rContainer = document.getElementById('counter-red');
    const bContainer = document.getElementById('counter-black');
    rContainer.innerHTML = '';
    bContainer.innerHTML = '';

    // 帥仕相俥傌炮兵
    const rOrder = ['R7', 'R6', 'R5', 'R4', 'R3', 'R2', 'R1'];
    // 將士象車馬包卒
    const bOrder = ['B7', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1'];

    const createEl = (id) => {
        const count = gameState.tileCounts[id];
        const char = REV_MAP[id];
        const type = id.startsWith('R') ? 'red' : 'black';

        const div = document.createElement('div');
        div.className = `counter-tile ${count <= 0 ? 'zero' : ''}`;
        div.innerHTML = `
            <div class="tile-icon ${type}">${char}</div>
            <div class="counter-num">${count}</div>
        `;
        div.onclick = () => enemyDiscard(id); // 點擊 = 對手打出
        return div;
    };

    rOrder.forEach(id => rContainer.appendChild(createEl(id)));
    bOrder.forEach(id => bContainer.appendChild(createEl(id)));
}

function updateUI() {
    document.getElementById('wall-count').textContent = gameState.wallCount;
    renderCounts();

    // Render Hand
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = '';
    gameState.myHand.forEach((id, idx) => {
        const char = REV_MAP[id];
        const type = id.startsWith('R') ? 'red' : 'black';
        handDiv.innerHTML += `<div class="game-tile ${type}" onclick="discardTile(${idx})">${char}</div>`;
    });

    const tileDiv = document.getElementById('drawn-tile');
    if (gameState.drawnTile) {
        const id = gameState.drawnTile;
        const char = REV_MAP[id];
        const type = id.startsWith('R') ? 'red' : 'black';
        tileDiv.innerHTML = `<div class="game-tile ${type}" onclick="discardTile(-1)">${char}</div>`;
        tileDiv.classList.remove('hidden');
    } else {
        tileDiv.innerHTML = '';
        tileDiv.classList.add('hidden');
    }

    // Analyze
    analyzeHand();
}

init();
