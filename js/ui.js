/*  ============================================
    UI MODULE
    Handles all DOM interactions
    ============================================ */

const UI = (() => {
    // ---- SCREEN MANAGEMENT ----
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });
        const screen = document.getElementById(screenId);
        screen.classList.remove('hidden');
        screen.classList.add('active');
    }

    // ---- NAME SCREEN ----
    function getPlayerName() {
        return document.getElementById('player-name').value.trim();
    }

    function setPlayerNameInput(name) {
        document.getElementById('player-name').value = name;
    }

    function setDisplayName(name) {
        document.getElementById('display-name').textContent = name;
    }

    // ---- HOST SCREEN ----
    function setRoomCode(code) {
        document.getElementById('room-code-display').textContent = code;
    }

    function getRoomCodeForLink(code) {
        const base = window.location.href.split('?')[0].split('#')[0];
        return base + '?room=' + code;
    }

    // ---- JOIN SCREEN ----
    function getJoinCode() {
        return document.getElementById('join-code').value.trim().toUpperCase();
    }

    function setJoinCode(code) {
        document.getElementById('join-code').value = code;
    }

    function showJoinError(msg) {
        const el = document.getElementById('join-error');
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function hideJoinError() {
        document.getElementById('join-error').classList.add('hidden');
    }

    // ---- GAME SCREEN ----
    function initGameUI(myName, opponentName) {
        document.getElementById('score-name-me').textContent = myName;
        document.getElementById('score-name-opponent').textContent = opponentName;
        document.getElementById('score-me').textContent = '0';
        document.getElementById('score-opponent').textContent = '0';
        document.getElementById('battle-label-me').textContent = myName;
        document.getElementById('battle-label-opponent').textContent = opponentName;
        document.getElementById('battle-symbol-me').textContent = '?';
        document.getElementById('battle-symbol-opponent').textContent = '?';
        document.getElementById('game-log').innerHTML = '';
        setGameStatus('Escolha uma carta para jogar', '');

        // Reset battle card styles
        document.getElementById('battle-me').className = 'battle-card';
        document.getElementById('battle-opponent').className = 'battle-card';
    }

    function renderHand(hand, selectedIndex, onSelect) {
        const container = document.getElementById('hand-cards');
        container.innerHTML = '';

        hand.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = 'card';

            if (card.used) {
                el.classList.add('used');
            } else if (selectedIndex === index) {
                el.classList.add('selected');
            }

            const symbol = Game.SYMBOLS[card.type];
            el.innerHTML = `
                <span>${symbol.emoji}</span>
                <span class="card-label">${symbol.name}</span>
            `;

            if (!card.used) {
                el.addEventListener('click', () => onSelect(index));
            }

            container.appendChild(el);
        });
    }

    function disableAllCards() {
        document.querySelectorAll('.card').forEach(c => {
            c.classList.add('disabled');
        });
    }

    function updateScores(myScore, oppScore) {
        document.getElementById('score-me').textContent = myScore;
        document.getElementById('score-opponent').textContent = oppScore;
    }

    function setGameStatus(text, type) {
        const el = document.getElementById('game-status');
        el.textContent = text;
        el.className = 'game-status';
        if (type) el.classList.add('highlight-' + type);
    }

    function showBattleResult(mySymbol, oppSymbol, result) {
        const myBattle = document.getElementById('battle-me');
        const oppBattle = document.getElementById('battle-opponent');
        const mySymbolEl = document.getElementById('battle-symbol-me');
        const oppSymbolEl = document.getElementById('battle-symbol-opponent');

        mySymbolEl.textContent = Game.SYMBOLS[mySymbol].emoji;
        oppSymbolEl.textContent = Game.SYMBOLS[oppSymbol].emoji;

        // Reset classes
        myBattle.className = 'battle-card';
        oppBattle.className = 'battle-card';

        if (result === 'win') {
            myBattle.classList.add('win');
            oppBattle.classList.add('lose');
        } else if (result === 'lose') {
            myBattle.classList.add('lose');
            oppBattle.classList.add('win');
        } else {
            myBattle.classList.add('draw');
            oppBattle.classList.add('draw');
        }
    }

    function resetBattle() {
        document.getElementById('battle-symbol-me').textContent = '?';
        document.getElementById('battle-symbol-opponent').textContent = '?';
        document.getElementById('battle-me').className = 'battle-card';
        document.getElementById('battle-opponent').className = 'battle-card';
    }

    function addLogEntry(roundNum, text, result) {
        const container = document.getElementById('game-log');
        const entry = document.createElement('div');
        entry.className = 'log-entry ' + result;
        entry.innerHTML = `<span class="round-num">Rodada ${roundNum}</span><br>${text}`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    // ---- EXIT MODAL ----
    function showExitModal() {
        document.getElementById('exit-modal').classList.remove('hidden');
    }

    function hideExitModal() {
        document.getElementById('exit-modal').classList.add('hidden');
    }

    // ---- GAME OVER SCREEN ----
    function showGameOver(winner, myName, oppName, myScore, oppScore, rounds) {
        let title, subtitle;

        if (winner === 'me') {
            title = '🏆 Vitória!';
            subtitle = `Parabéns, ${myName}! Você venceu a partida!`;
        } else if (winner === 'opponent') {
            title = '😞 Derrota';
            subtitle = `${oppName} venceu a partida.`;
        } else {
            title = 'Partida Encerrada';
            subtitle = 'A partida foi finalizada.';
        }

        document.getElementById('gameover-title').textContent = title;
        document.getElementById('gameover-subtitle').textContent = subtitle;
        document.getElementById('gameover-stats').innerHTML = `
            <p>${myName}: <strong>${myScore}</strong> pontos</p>
            <p>${oppName}: <strong>${oppScore}</strong> pontos</p>
            <p style="color: var(--text-dim); font-size: 0.9rem; margin-top: 8px;">Total de rodadas: ${rounds}</p>
        `;

        showScreen('screen-gameover');
    }

    return {
        showScreen,
        getPlayerName,
        setPlayerNameInput,
        setDisplayName,
        setRoomCode,
        getRoomCodeForLink,
        getJoinCode,
        setJoinCode,
        showJoinError,
        hideJoinError,
        initGameUI,
        renderHand,
        disableAllCards,
        updateScores,
        setGameStatus,
        showBattleResult,
        resetBattle,
        addLogEntry,
        showExitModal,
        hideExitModal,
        showGameOver
    };
})();
