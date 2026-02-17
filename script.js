// 象棋麻將助手 - 四家戰情室版 (自動吃牌識別)

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

// Player Names
const PLAYER_NAMES = ['我', '下家', '對家', '上家'];

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

    // 如果 Modal 開啟，這就是輸入吃牌補充
    if (document.getElementById('meldInputModal').classList.contains('show')) {
        addMeldTile(char);
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

    // Auto detect eater (Logic: eater follows sourceP)
    // 3(Left) -> 0(Me)
    // 2(Top) -> 3(Left)
    // 1(Right) -> 2(Top)
    // 0(Me) -> 1(Right)
    const eaterIdx = (pIdx + 1) % 4;

    tempMeld = {
        eater: eaterIdx,
        tiles: [id]
    };

    // Setup Modal
    const eaterName = PLAYER_NAMES[eaterIdx];
    document.getElementById('meld-title').textContent = `${eaterName} 吃 ${REV_MAP[id]}`;

    updateMeldPreview();
    document.getElementById('meldInputModal').classList.add('show');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(el => el.classList.remove('show'));
    tempAction = null;
    tempMeld = null;
}

function addMeldTile(char) {
    if (!tempMeld) return;
    if (tempMeld.tiles.length >= 3) return;
    const id = ID_MAP[char];
    tempMeld.tiles.push(id);
    updateMeldPreview();
}

function updateMeldPreview() {
    const container = document.getElementById('meld-preview');
    container.innerHTML = tempMeld.tiles.map(id => createTile(id, 'small')).join('');
    // Placeholder
    for (let i = tempMeld.tiles.length; i < 3; i++) {
        container.innerHTML += `<div class="game-tile small" style="border:1px dashed #777; background:none; color:#777">?</div>`;
    }
}

function onDeleteTile() {
    if (!tempAction) return;
    pushHistory();
    // 刪除該河牌 (視為誤操作)
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);
    // 補回 wallCount? 假設誤操作是之前 inputTile 扣過的
    gameState.wallCount++;

    closeModals();
    render();
}

function finishMeld() {
    if (!tempMeld || !tempAction) return;
    // 必須滿3張
    if (tempMeld.tiles.length < 3) {
        alert('吃牌必須滿3張');
        return;
    }

    pushHistory();

    // 1. Remove eaten tile from source river
    gameState.rivers[tempAction.sourceP].splice(tempAction.sourceTIdx, 1);

    // 2. Add to eater's Melds
    gameState.melds[tempMeld.eater].push({
        type: 'eat',
        tiles: tempMeld.tiles,
        from: tempAction.sourceP
    });

    // 3. Update Wall Count
    // 只有補進來的2張是從未知變已知
    const extraTilesCount = tempMeld.tiles.length - 1;
    gameState.wallCount -= extraTilesCount;
    if (gameState.wallCount < 0) gameState.wallCount = 0;

    closeModals();
    render();
}

// --- Render & Analysis ---

function getRemaining(id) {
    let count = TILES[id].count;
    // ... logic same as before ...
    // 手牌
    gameState.myHand.forEach(t => { if (t === id) count--; });
    if (gameState.drawnTile === id) count--;
    // Rivers
    gameState.rivers.forEach(r => r.forEach(t => { if (t === id) count--; }));
    // Melds
    gameState.melds.forEach(mList => mList.forEach(m => {
        m.tiles.forEach(t => { if (t === id) count--; });
    }));
    return count;
}

function analyze() {
    // 1. Defense (Show Safe Tiles: Rivers + Melds' eaten tile?)
    // 其實只有現物絕對安全。吃進去的牌已經不在河裡，但它曾經被打出過。
    // 但是象棋麻將的「現物」定義是「該玩家打過的牌」。
    // 這裡我們列出所有已見牌做為參考？不，只列出絕對安全牌。
    // 安全牌 = 所有人打過的牌 (即便被吃走，只要打出過就算現物嗎？這要看規則。通常算！)

    const defenseEl = document.getElementById('rec-defense');
    let safeTiles = new Set();

    // 如果被吃走，它還算是某人的捨牌嗎？
    // 記錄歷史裡我們把 rivers splice 掉了。這會導致「現物」消失。
    // 這是一個潛在bug。
    // 如果想要保留現物記錄，我們也許不該 splice，而是標記 `eaten: true`?
    // 或者我們假設因為被吃走，下家立刻打了一張，那張就變成新的現物。
    // 被吃的那張因為不在河裡，所以也不能跟打？
    // 通常規則：上家打的被吃，那張就不是「過水」對象，因為沒過。
    // 所以 splice 是對的。

    gameState.rivers.forEach(r => r.forEach(t => safeTiles.add(t)));

    if (safeTiles.size === 0) {
        defenseEl.innerHTML = '<div class="placeholder-text">無現物</div>';
    } else {
        let html = '';
        Array.from(safeTiles).forEach(id => {
            html += createTile(id, 'tiny');
        });
        defenseEl.innerHTML = html;
    }

    // 2. Offense Placeholder
    document.getElementById('rec-offense').innerHTML = '<div class="placeholder-text">分析功能開發中...</div>';
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

        // Melds
        const mEl = document.getElementById(`melds-${i}`);
        mEl.innerHTML = gameState.melds[i].map(m => {
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
// Global exports for inline HTML calls
window.inputTile = inputTile;
window.discardMe = discardMe;
window.onRiverClick = onRiverClick; // used in JS render mainly
window.onDeleteTile = onDeleteTile;
window.addMeldTile = addMeldTile;
window.finishMeld = finishMeld;
window.undo = undo;
window.closeModals = closeModals;
