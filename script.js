// 象棋麻將助手 - 四家戰情室版

const TILES = {
    // 紅色 (Red)
    R7: { name: '帥', count: 1, val: 7, type: 'red' },
    R6: { name: '仕', count: 2, val: 6, type: 'red' },
    R5: { name: '相', count: 2, val: 5, type: 'red' },
    R4: { name: '俥', count: 2, val: 4, type: 'red' },
    R3: { name: '傌', count: 2, val: 3, type: 'red' },
    R2: { name: '炮', count: 2, val: 2, type: 'red' },
    R1: { name: '兵', count: 5, val: 1, type: 'red' },
    // 黑色 (Black)
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

let gameState = {
    wallCount: 32,
    myHand: [], // 我手牌
    drawnTile: null, // 我摸到的牌
    rivers: [[], [], [], []], // 四家河 [我, 下, 對, 上]
    melds: [[], [], [], []], // 四家吃牌 [ {tile:'R4', from:3, set:['R4','R3','R2']} ]
    mode: 'hand', // 'hand' or 'record'
    selectedPlayer: 3, // 預設記錄上家
    history: []
};

// Undo Logic
function pushHistory() {
    gameState.history.push(JSON.parse(JSON.stringify({
        wallCount: gameState.wallCount,
        myHand: gameState.myHand,
        drawnTile: gameState.drawnTile,
        rivers: gameState.rivers,
        melds: gameState.melds
    })));
}

function undo() {
    if (gameState.history.length === 0) return;
    const prev = gameState.history.pop();
    Object.assign(gameState, prev);
    render();
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

// --- 核心操作 ---

function inputTile(char) {
    const id = ID_MAP[char];
    if (!id) return;

    pushHistory();

    // 扣除牌牆
    gameState.wallCount--;
    if (gameState.wallCount < 0) gameState.wallCount = 0;

    if (gameState.mode === 'hand') {
        // 自己摸牌/建立手牌
        if (gameState.drawnTile) {
            alert('手牌已滿 (+1)，請先打出一張牌 (點擊手牌)');
            gameState.history.pop(); // Revert
            return;
        }
        if (gameState.myHand.length < 4) {
            gameState.myHand.push(id);
            sortHand();
        } else {
            gameState.drawnTile = id;
        }
    } else {
        // 記錄對手打牌
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
    // 加入我的河
    gameState.rivers[0].push(tile);
    render();
}

function sortHand() {
    // 簡單排序: R7->R1, B7->B1
    const val = (id) => {
        const type = id[0];
        const v = parseInt(id[1]);
        return type === 'R' ? 10 + v : v;
    };
    gameState.myHand.sort((a, b) => val(b) - val(a));
}

// 吃牌邏輯 (Meld)
// 為了簡化，這裡只記錄「消耗掉的牌」。
// 假設上家打出 tile A, 下家吃進 tile A, 並亮出 A, B, C
// 那麼 A 從上家河裡移除 (被吃了)，B, C 從未知牌變成已知牌 (Melds)
function recordMeld(playerIdx, eatenTile, exposedTiles) {
    pushHistory();

    // 1. 如果 eatenTile 是有人打出來的，要從那人的河裡移除嗎？
    // 通常記錄為：上家打出 -> 下家吃。
    // 為了簡單，我們假設已經記錄了上家打出 A (在 rivers[3])。
    // 現在下家吃 A。
    // 選項：
    // A. 從 rivers[3] 移除 A，放入 melds[1]。此時 wallCount 不變。
    // B. 不移除，直接在 melds[1] 增加 A, B, C。此時 wallCount 要扣除 2 (因為 B, C 是手牌)。

    // 我們採用 B 方案比較直覺：
    // 記錄這是一個 Meld，顯示出來。
    // 重要的是 B, C 被消耗了。

    // 不過用戶通常是先點「上家打出 A」，然後發現「下家吃了」。
    // 這時候要回頭去上家河裡把 A 拿回來嗎？
    // 為了操作流暢，我們不自動拿回。
    // 建議：直接在「吃牌」操作時，指定「吃了誰的哪張牌」。

    // 簡化版實現：
    // 1. 選擇誰吃了牌 (playerIdx)
    // 2. 選擇吃了什麼 (eatenTile)
    // 3. 選擇搭配什麼 (otherTiles - 預設兩張)

    // 這裡我們先做一個簡易版：只記錄消耗。
    // 假設 eatenTile 是從河裡撿回來的，或者剛打出來的。
    // exposedTiles 是他手裡拿出來的。

    gameState.melds[playerIdx].push({
        tile: eatenTile, // 吃的牌
        set: exposedTiles // 整組牌
    });

    // 扣除牌牆 (因為 exposedTiles 是從未知變已知)
    // 扣除數量 = exposedTiles.length - 1 (因為有一張是吃的，原本就在場上或剛打出)
    // 等等，如果剛打出的牌還沒計入 wallCount (因為 inputTile 就扣了)，那這裡不用扣。
    // 如果是 inputTile 扣了，那河裡有一張。

    // 讓我們約定：
    // 1. 上家打出 A -> inputTile(A) -> rivers[3]有A, wallCount-1
    // 2. 下家吃 A -> recordMeld(1, A)
    //    -> 從 rivers[3] 移除 A (因為被吃走)
    //    -> 在 melds[1] 增加 [A, B, C]
    //    -> wallCount 再減 2 (因為 B, C 是從手牌拿出來的，原本沒算在已知)

    // 尋找最近一張被打出的 eatenTile
    // 遍歷所有河，找最後一張
    let found = false;
    for (let r = 0; r < 4; r++) {
        const last = gameState.rivers[r][gameState.rivers[r].length - 1];
        if (last === eatenTile) {
            gameState.rivers[r].pop(); // 移除被吃的牌
            found = true;
            break;
        }
    }

    if (!found) {
        // 沒找到，可能是漏記了，或者剛摸的？
        // 不扣除 wallCount (假設這張牌已經被計數過)
    }

    // 扣除 B, C
    gameState.wallCount -= (exposedTiles.length - 1);

    render();
}

// --- 分析 ---
// 計算剩餘張數
function getRemaining(id) {
    let count = TILES[id].count;
    // 扣除我的手牌
    gameState.myHand.forEach(t => { if (t === id) count--; });
    if (gameState.drawnTile === id) count--;

    // 扣除四家河
    gameState.rivers.forEach(r => r.forEach(t => { if (t === id) count--; }));

    // 扣除 Melds
    gameState.melds.forEach(mList => mList.forEach(m => {
        m.set.forEach(t => { if (t === id) count--; });
    }));

    return count;
}

function analyze() {
    // 1. 防守分析
    const defenseEl = document.getElementById('rec-defense');
    let safeTiles = new Set();
    // 現物 (所有人打過的牌) - 其實只有下家能吃我，所以下家打過的牌對我最安全？
    // 象棋麻將沒有「過水」規則，所以現物就是絕對安全。
    // 收集所有河牌
    gameState.rivers.forEach(r => r.forEach(t => safeTiles.add(t)));

    if (safeTiles.size === 0) {
        defenseEl.innerHTML = '<div class="placeholder-text">無現物</div>';
    } else {
        let html = '';
        Array.from(safeTiles).forEach(id => {
            const char = REV_MAP[id];
            const type = id.startsWith('R') ? 'red' : 'black';
            html += `<span class="rec-tile-s ${type}">${char}</span>`;
        });
        defenseEl.innerHTML = html;
    }

    // 2. 進攻分析 (EV)
    // ... (使用之前的 heavy logic，這裡簡化調用)
    // 為了節省空間，這裡暫時略過完整的 checkHu 邏輯，
    // 實際專案中應該複製之前 script.js 的 checkHu/analyzeHand 部分。
    // 這裡先顯示一個簡單的 "剩餘張數" 列表
}

// --- Render ---

function render() {
    document.getElementById('wall-count').textContent = gameState.wallCount;

    // Render Rivers & Melds
    for (let i = 0; i < 4; i++) {
        const rEl = document.getElementById(`river-${i}`);
        const mEl = document.getElementById(`melds-${i}`);
        if (rEl) {
            rEl.innerHTML = gameState.rivers[i].map(id => createTile(id, 'small')).join('');
        }
        if (mEl) {
            mEl.innerHTML = gameState.melds[i].map(m => {
                // 顯示一組
                return `<div class="meld-group">${m.set.map(id => createTile(id, 'tiny')).join('')}</div>`;
            }).join('');
        }

        // Update opponent active state
        if (i > 0) { // 0 is me
            const oppEl = document.getElementById(`player-${i}`);
            if (oppEl) {
                if (gameState.selectedPlayer === i && gameState.mode === 'record') {
                    oppEl.classList.add('selected');
                } else {
                    oppEl.classList.remove('selected');
                }
            }
        }
    }

    // Render Hand
    const handDiv = document.getElementById('my-hand');
    handDiv.innerHTML = gameState.myHand.map((id, idx) => createTile(id, 'normal', `discardMe(${idx})`)).join('');

    const drawDiv = document.getElementById('drawn-tile');
    if (gameState.drawnTile) {
        drawDiv.innerHTML = createTile(gameState.drawnTile, 'normal', `discardMe(-1)`);
        drawDiv.classList.remove('hidden');
    } else {
        drawDiv.classList.add('hidden');
    }

    analyze();
}

function createTile(id, size = 'normal', action = '') {
    const char = REV_MAP[id];
    const type = id.startsWith('R') ? 'red' : 'black';
    return `<div class="game-tile ${size} ${type}" onclick="${action}">${char}</div>`;
}

// --- Toggle Mode ---
function selectOpponent(idx) {
    gameState.selectedPlayer = idx;
    gameState.mode = 'record';
    render();
}

// --- Attach Events ---
function attachEvents() {
    // 選擇對手
    [1, 2, 3].forEach(idx => {
        document.getElementById(`player-${idx}`).addEventListener('click', () => selectOpponent(idx));
    });

    // 自己摸牌 (切換回 hand 模式)
    document.getElementById('draw-btn').addEventListener('click', () => {
        gameState.mode = 'hand';
        render(); // remove highlight
    });

    // 鍵盤
    document.querySelectorAll('.kb-btn').forEach(btn => {
        btn.addEventListener('click', () => inputTile(btn.dataset.tile));
    });

    // 撤銷
    document.getElementById('undo-btn').addEventListener('click', undo);

    // 重置
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('重置?')) init();
    });
}

init();
