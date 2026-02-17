// 象棋麻將助手 - 四家戰情室版 (簡化吃牌邏輯)

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

let gameState = {
    wallCount: 32,
    myHand: [],
    drawnTile: null,
    rivers: [[], [], [], []],
    melds: [[], [], [], []], // [ { type:'eat', tiles:['R1'] } ] - 只存一張

    mode: 'hand',
    selectedPlayer: 3,
    history: []
};

let tempAction = null; // { sourceP, sourceTIdx, tileId }
let tempMeld = null;   // { eater, tiles: [] }

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
    // attachEvents(); // 移除這裡的調用，避免重複綁定
}

function inputTile(char) {
    const id = ID_MAP[char];
    if (!id) return;

    // 如果 Modal 開啟，不再響應輸入（因為不需要補充牌了）
    if (document.getElementById('meldInputModal').classList.contains('show')) {
        return;
    }

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

// --- River Click ---
function onRiverClick(pIdx, tIdx, id) {
    tempAction = { sourceP: pIdx, sourceTIdx: tIdx, tileId: id };

    // Auto detect eater: (pIdx + 1) % 4
    const eaterIdx = (pIdx + 1) % 4;

    tempMeld = {
        eater: eaterIdx,
        tiles: [id] // 只包括這張牌
    };

    // Setup Modal
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
    // 只顯示一張
    container.innerHTML = tempMeld.tiles.map(id => createTile(id, 'normal')).join('');
}

function onDeleteTile() {
    if (!tempAction) return;
    pushHistory();
    // 刪除該河牌
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    gameState.wallCount++;

    closeModals();
    render();
}

function finishMeld() {
    if (!tempMeld || !tempAction) return;

    pushHistory();

    // 1. Remove eaten tile from source river
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    // 2. Add to eater's Melds (Record keeping)
    gameState.melds[tempMeld.eater].push({
        type: 'eat',
        tiles: tempMeld.tiles, // [id]
        from: tempAction.sourceP
    });

    // 3. 如果是我吃，還要真正加到手牌裡
    if (tempMeld.eater === 0) {
        // 先檢查手牌上限？理論上吃牌只能在輪到自己摸牌前（也就是手牌4張時）發生
        // 吃牌後手牌變成 5 張
        if (gameState.drawnTile) {
            // 這是不應該發生的，除非記錄有錯
            // 但為了強健性，我們假設這是剛摸到的牌
            // 不處理，直接加
        }
        // 將這張牌加入手牌 (視為 drawnTile 比較好，因為要打出一張)
        // 或者直接 push 到 hand，反正 discardMe 會處理
        // 為了 UI 邏輯一致（需要打出一張），我們把它設為 `drawnTile`
        if (gameState.myHand.length === 4) {
            gameState.drawnTile = tempMeld.tiles[0];
        } else {
            gameState.myHand.push(tempMeld.tiles[0]); // 一般補牌
            sortHand();
        }
    }

    // 4. Update Wall Count -> 不變！
    // 吃牌是撿河裡的，不消耗牆牌

    closeModals();
    render();
}

// --- Render & Analysis ---
function analyze() {
    // Defense: Show safe tiles (Rivers + Eaten Tiles?)
    // 對手吃進去的牌，也是現物的一種（因為曾經被打出過，大家都知道這張牌被消耗了）
    const defenseEl = document.getElementById('rec-defense');
    let safeTiles = new Set();

    gameState.rivers.forEach(r => r.forEach(t => safeTiles.add(t)));

    // Eaten tiles are also visible/known used
    gameState.melds.forEach(mList => mList.forEach(m => {
        m.tiles.forEach(t => safeTiles.add(t));
    }));

    if (safeTiles.size === 0) {
        defenseEl.innerHTML = '<div class="placeholder-text">無現物</div>';
    } else {
        let html = '';
        Array.from(safeTiles).forEach(id => {
            html += createTile(id, 'tiny');
        });
        defenseEl.innerHTML = html;
    }

    // Offense
    document.getElementById('rec-offense').innerHTML = '<div class="placeholder-text">分析功能開發中...</div>';
}

function getRemaining(id) {
    // 這裡我們只計算「絕對已知」的牌
    let count = TILES[id].count;
    // Hand
    gameState.myHand.forEach(t => { if (t === id) count--; });
    if (gameState.drawnTile === id) count--;
    // Rivers
    gameState.rivers.forEach(r => r.forEach(t => { if (t === id) count--; }));
    // Melds (所有 meld 裡的牌都是已知的)
    gameState.melds.forEach(mList => mList.forEach(m => {
        m.tiles.forEach(t => { if (t === id) count--; });
    }));
    return count;
}


function render() {
    document.getElementById('wall-count').textContent = gameState.wallCount;

    for (let i = 0; i < 4; i++) {
        // Rivers
        const rEl = document.getElementById(`river-${i}`);
        rEl.innerHTML = '';
        gameState.rivers[i].forEach((id, idx) => {
            const div = document.createElement('div');
            div.className = createTileClass(id, 'small');
            div.innerHTML = REV_MAP[id];
            div.onclick = (e) => { e.stopPropagation(); onRiverClick(i, idx, id); };
            rEl.appendChild(div);
        });

        // Melds - 只顯示單張被吃進來的
        const mEl = document.getElementById(`melds-${i}`);
        mEl.innerHTML = gameState.melds[i].map(m => {
            // m.tiles 只有一張
            return `<div class="meld-group">${m.tiles.map(id => createTile(id, 'tiny')).join('')}</div>`;
        }).join('');

        // Highlight
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
        if (btn.dataset.tile) {
            btn.addEventListener('click', () => inputTile(btn.dataset.tile));
        }
    });

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('reset-btn').addEventListener('click', () => { if (confirm('重置?')) init(); });
}

init();
attachEvents(); // 唯一一次綁定
// Exports
window.inputTile = inputTile;
window.discardMe = discardMe;
window.onRiverClick = onRiverClick;
window.onDeleteTile = onDeleteTile;
// window.addMeldTile = addMeldTile; // No longer needed
window.finishMeld = finishMeld;
window.undo = undo;
window.closeModals = closeModals;
