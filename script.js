// 象棋麻將助手 - 四家戰情室版 (吃牌優化)

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

let gameState = {
    wallCount: 32,
    myHand: [], // [id, id, ...]
    drawnTile: null,
    rivers: [[], [], [], []], // 0:Me, 1:Right, 2:Top, 3:Left
    melds: [[], [], [], []], // [ { type:'eat', tiles:['R1','R1','R1'], from:3 } ]

    mode: 'hand', // 'hand' or 'record'
    selectedPlayer: 3,
    history: []
};

// Temp state for Meld Action
let tempAction = null; // { sourceP: int, sourceTIdx: int, tileId: string }
let tempMeld = null;   // { eater: int, tiles: [] }

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

// --- 輸入操作 ---

function inputTile(char) {
    const id = ID_MAP[char];
    if (!id) return;

    // 如果是 Meld 模式 (彈窗開啟中)
    if (document.getElementById('meldInputModal').classList.contains('show')) {
        addMeldTile(char);
        return;
    }

    pushHistory();

    // 扣除牌牆
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

// --- 河牌點擊與吃牌邏輯 ---

function onRiverClick(pIdx, tIdx, id) {
    tempAction = { sourceP: pIdx, sourceTIdx: tIdx, tileId: id };

    // Show Modal 1
    const modal = document.getElementById('tileActionModal');
    document.getElementById('modal-tile-display').innerHTML = createTile(id, 'normal');

    // Update labels if needed
    // ...

    modal.classList.add('show');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(el => el.classList.remove('show'));
    tempAction = null;
    tempMeld = null;
}

function onDeleteTile() {
    if (!tempAction) return;
    pushHistory();

    // Remove from river
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    // Wall count? Usually inputTile decreased it. Deleting means it was a mistake?
    // Let's increment wallCount back if we assume deletion is undoing an input.
    gameState.wallCount++;

    closeModals();
    render();
}

function onEatConfirm(eaterIdx) {
    // Hide Action Modal, Show Input Modal
    document.getElementById('tileActionModal').classList.remove('show');

    tempMeld = {
        eater: eaterIdx,
        tiles: [tempAction.tileId] // Start with the eaten tile
    };

    updateMeldPreview();
    document.getElementById('meldInputModal').classList.add('show');
}

function addMeldTile(char) {
    if (!tempMeld) return;
    if (tempMeld.tiles.length >= 3) return; // Max 3

    const id = ID_MAP[char];
    tempMeld.tiles.push(id);
    updateMeldPreview();
}

function updateMeldPreview() {
    const container = document.getElementById('meld-preview');
    container.innerHTML = tempMeld.tiles.map(id => createTile(id, 'small')).join('');

    // Show placeholder for missing
    for (let i = tempMeld.tiles.length; i < 3; i++) {
        container.innerHTML += `<div class="game-tile small" style="border:1px dashed #777; background:none;">?</div>`;
    }
}

function finishMeld() {
    if (!tempMeld || !tempAction) return;

    // Commit
    pushHistory();

    // 1. Remove from source river
    // 注意：River 可能變動了（如果剛才撤銷過），這裡假設 Index 還準確。
    // 安全起見，我們可以重新找這張牌，或者相信 index。
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    // 2. Add to eater's Melds
    gameState.melds[tempMeld.eater].push({
        type: 'eat',
        tiles: tempMeld.tiles, // [吃, 手, 手]
        from: tempAction.sourceP
    });

    // 3. Update Wall Count
    // 吃掉的那張 (tempAction.tileId) 原本已經在 river 裡 (wallCount 已扣1)
    // 另外輸入的牌 (tempMeld.tiles 裡剩下的) 是從 eater 的手牌拿出來的 (未知 -> 已知)
    // 所以 wallCount 要扣除 (tiles.length - 1)
    const extraTilesCount = tempMeld.tiles.length - 1;
    gameState.wallCount -= extraTilesCount;
    if (gameState.wallCount < 0) gameState.wallCount = 0;

    closeModals();
    render();
}


// --- 分析 & UI ---

function getRemaining(id) {
    let count = TILES[id].count;
    gameState.myHand.forEach(t => { if (t === id) count--; });
    if (gameState.drawnTile === id) count--;
    gameState.rivers.forEach(r => r.forEach(t => { if (t === id) count--; }));
    gameState.melds.forEach(mList => mList.forEach(m => {
        m.tiles.forEach(t => { if (t === id) count--; });
    }));
    return count;
}

function render() {
    document.getElementById('wall-count').textContent = gameState.wallCount;

    // Rivers
    for (let i = 0; i < 4; i++) {
        const rEl = document.getElementById(`river-${i}`);
        rEl.innerHTML = '';
        gameState.rivers[i].forEach((id, idx) => {
            // Add click event
            const div = document.createElement('div');
            // Use innerHTML from createTile string, but add click handler
            div.innerHTML = REV_MAP[id];
            div.className = createTileClass(id, 'small');
            div.onclick = (e) => {
                e.stopPropagation();
                onRiverClick(i, idx, id);
            };
            rEl.appendChild(div);
        });

        // Melds
        const mEl = document.getElementById(`melds-${i}`);
        mEl.innerHTML = gameState.melds[i].map(m => {
            return `<div class="meld-group">${m.tiles.map(id => createTile(id, 'tiny')).join('')}</div>`;
        }).join('');

        // Select logic
        if (i > 0) {
            const oppEl = document.getElementById(`player-${i}`);
            if (gameState.selectedPlayer === i && gameState.mode === 'record') {
                oppEl.classList.add('selected');
            } else {
                oppEl.classList.remove('selected');
            }
        }
    }

    // Hand
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
    const clickAttr = action ? `onclick="${action}"` : '';
    return `<div class="${createTileClass(id, size)}" ${clickAttr}>${char}</div>`;
}

function createTileClass(id, size) {
    const type = id.startsWith('R') ? 'red' : 'black';
    return `game-tile ${size} ${type}`;
}

// --- Attach Events ---
function selectOpponent(idx) {
    gameState.selectedPlayer = idx;
    gameState.mode = 'record';
    render();
}

function attachEvents() {
    [1, 2, 3].forEach(idx => {
        document.getElementById(`player-${idx}`).addEventListener('click', () => selectOpponent(idx));
    });

    document.getElementById('draw-btn').addEventListener('click', () => {
        gameState.mode = 'hand';
        render();
    });

    document.querySelectorAll('.kb-btn').forEach(btn => {
        // Use onclick defined in HTML to call inputTile, or listen here?
        // HTML has onclick="inputTile(...)". But addMeldTile is separate.
        // Wait, index.html has data-tile setup for kb-btn?
        // Let's stick to handling via JS listeners for cleaner separate logic.
        // Actually, for Modal keyboard, I used onclick="addMeldTile" in HTML.
        // For Main keyboard, I used data-tile.
        if (btn.dataset.tile) {
            btn.addEventListener('click', () => inputTile(btn.dataset.tile));
        }
    });

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('reset-btn').addEventListener('click', () => { if (confirm('重置?')) init(); });
}

// Analysis Placeholder
function analyze() {
    // 1. Defense (Show Safe Tiles)
    const defenseEl = document.getElementById('rec-defense');
    let safeTiles = new Set();
    gameState.rivers.forEach(r => r.forEach(t => safeTiles.add(t)));

    if (safeTiles.size === 0) {
        defenseEl.innerHTML = '<div class="placeholder">無現物</div>';
    } else {
        let html = '';
        Array.from(safeTiles).forEach(id => {
            html += createTile(id, 'tiny');
        });
        defenseEl.innerHTML = html;
    }

    // 2. Offense (EV) - Just a count for now
    const offenseEl = document.getElementById('rec-offense');
    // Calculate shanten/EV here... (Omitted for brevity in this step, can add back)
    offenseEl.innerHTML = '<div class="placeholder">分析中...</div>';
}

init();
// Make global for HTML access
window.inputTile = inputTile;
window.discardMe = discardMe;
window.onRiverClick = onRiverClick; // Important
window.closeModals = closeModals;
window.onDeleteTile = onDeleteTile;
window.onEatConfirm = onEatConfirm;
window.addMeldTile = addMeldTile;
window.finishMeld = finishMeld;
window.undo = undo;
