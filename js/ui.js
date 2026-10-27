var UI = (function () {

    function showScreen(id) {
        var all = document.querySelectorAll('.screen');
        for (var i = 0; i < all.length; i++) {
            all[i].classList.remove('active');
            all[i].classList.add('hidden');
        }
        var s = document.getElementById(id);
        if (s) { s.classList.remove('hidden'); s.classList.add('active'); }
        Debug.render();
    }

    /* ---- NOME / MENU ---- */
    function getPlayerName() { return document.getElementById('player-name').value.trim(); }
    function setPlayerNameInput(n) { document.getElementById('player-name').value = n || ''; }
    function setDisplayName(n) { document.getElementById('display-name').textContent = n; }

    /* ---- HOST ---- */
    function setRoomCode(c) { document.getElementById('room-code-display').textContent = c; }
    function setHostStatus(t) {
        var e = document.getElementById('host-status-text');
        if (e) e.textContent = t;
    }
    function getRoomCodeForLink(c) {
        var base = window.location.href.split('?')[0].split('#')[0];
        return base + '?room=' + c;
    }

    /* ---- JOIN ---- */
    function getJoinCode() { return document.getElementById('join-code').value.trim().toUpperCase(); }
    function setJoinCode(c) { document.getElementById('join-code').value = c || ''; }
    function showJoinError(m) {
        var e = document.getElementById('join-error');
        e.textContent = m; e.classList.remove('hidden');
        document.getElementById('join-status').classList.add('hidden');
    }
    function hideJoinError() { document.getElementById('join-error').classList.add('hidden'); }
    function showJoinStatus(m) {
        var e = document.getElementById('join-status');
        e.textContent = m; e.classList.remove('hidden');
        hideJoinError();
    }
    function hideJoinStatus() { document.getElementById('join-status').classList.add('hidden'); }

    /* ---- PAINEL DE CONEXÃO (esquerda) ---- */
    function setConnRoom(code) {
        var e = document.getElementById('conn-room-code');
        if (e) e.textContent = code || '—';
    }
    function setConnStatus(online) {
        var d = document.getElementById('conn-dot');
        if (!d) return;
        d.className = 'conn-dot ' + (online ? 'online' : 'offline');
    }

    /* ---- JOGO ---- */
    function initGameUI(myName, oppName, matchNumber) {
        document.getElementById('score-name-me').textContent = myName;
        document.getElementById('score-name-opponent').textContent = oppName;
        document.getElementById('score-me').textContent = '0';
        document.getElementById('score-opponent').textContent = '0';
        document.getElementById('battle-label-me').textContent = myName;
        document.getElementById('battle-label-opponent').textContent = oppName;
        document.getElementById('battle-symbol-me').textContent = '?';
        document.getElementById('battle-symbol-opponent').textContent = '?';
        document.getElementById('battle-me').className = 'battle-card';
        document.getElementById('battle-opponent').className = 'battle-card';
        document.getElementById('game-log').innerHTML = '';
        setGameStatus('Escolha uma carta para jogar', '');

        if (matchNumber && matchNumber > 1) {
            addSystemLog('— Partida #' + matchNumber + ' —');
        }
    }

    function renderHand(hand, selectedIndex, onSelect) {
        var box = document.getElementById('hand-cards');
        box.innerHTML = '';

        hand.forEach(function (card, i) {
            var el = document.createElement('div');
            el.className = 'card';
            if (card.used) el.classList.add('used');
            else if (selectedIndex === i) el.classList.add('selected');

            var s = Game.SYMBOLS[card.type];
            el.innerHTML = '<span>' + s.emoji + '</span>' +
                           '<span class="card-label">' + s.name + '</span>';

            if (!card.used) {
                el.addEventListener('click', function () { onSelect(i); });
            }
            box.appendChild(el);
        });
    }

    function disableAllCards() {
        var cards = document.querySelectorAll('.card');
        for (var i = 0; i < cards.length; i++) cards[i].classList.add('disabled');
    }

    function updateScores(a, b) {
        document.getElementById('score-me').textContent = a;
        document.getElementById('score-opponent').textContent = b;
    }

    function setGameStatus(text, type) {
        var e = document.getElementById('game-status');
        e.textContent = text;
        e.className = 'game-status';
        if (type) e.classList.add('highlight-' + type);
    }

    function showBattleResult(mine, opp, result) {
        var a = document.getElementById('battle-me');
        var b = document.getElementById('battle-opponent');
        document.getElementById('battle-symbol-me').textContent = Game.SYMBOLS[mine].emoji;
        document.getElementById('battle-symbol-opponent').textContent = Game.SYMBOLS[opp].emoji;
        a.className = 'battle-card';
        b.className = 'battle-card';
        if (result === 'win') { a.classList.add('win'); b.classList.add('lose'); }
        else if (result === 'lose') { a.classList.add('lose'); b.classList.add('win'); }
        else { a.classList.add('draw'); b.classList.add('draw'); }
    }

    function resetBattle() {
        document.getElementById('battle-symbol-me').textContent = '?';
        document.getElementById('battle-symbol-opponent').textContent = '?';
        document.getElementById('battle-me').className = 'battle-card';
        document.getElementById('battle-opponent').className = 'battle-card';
    }

    function addLogEntry(round, text, result) {
        var box = document.getElementById('game-log');
        var e = document.createElement('div');
        e.className = 'log-entry ' + result;
        e.innerHTML = '<span class="round-num">Rodada ' + round + '</span><br>' + text;
        box.appendChild(e);
        box.scrollTop = box.scrollHeight;
    }

    function addSystemLog(text) {
        var box = document.getElementById('game-log');
        var e = document.createElement('div');
        e.className = 'log-entry system';
        e.textContent = text;
        box.appendChild(e);
        box.scrollTop = box.scrollHeight;
    }

    /* ---- MODAL ---- */
    function showExitModal() { document.getElementById('exit-modal').classList.remove('hidden'); }
    function hideExitModal() { document.getElementById('exit-modal').classList.add('hidden'); }

    /* ---- GAME OVER ---- */
    function showGameOver(winner, myName, oppName, myScore, oppScore, rounds, canRematch) {
        var title, sub;
        if (winner === 'me') {
            title = '🏆 Vitória!';
            sub = 'Parabéns, ' + myName + '! Você venceu a partida!';
        } else if (winner === 'opponent') {
            title = '😞 Derrota';
            sub = oppName + ' venceu a partida.';
        } else {
            title = 'Partida Encerrada';
            sub = 'A partida foi finalizada.';
        }

        document.getElementById('gameover-title').textContent = title;
        document.getElementById('gameover-subtitle').textContent = sub;
        document.getElementById('gameover-stats').innerHTML =
            '<p>' + myName + ': <strong>' + myScore + '</strong> pontos</p>' +
            '<p>' + oppName + ': <strong>' + oppScore + '</strong> pontos</p>' +
            '<p style="color:var(--text-dim);font-size:0.9rem;margin-top:8px;">Total de rodadas: ' + rounds + '</p>';

        var btn = document.getElementById('btn-rematch');
        btn.disabled = !canRematch;
        btn.textContent = 'Jogar Novamente';
        btn.style.display = canRematch ? '' : 'none';

        hideRematchStatus();
        showScreen('screen-gameover');
    }

    function setRematchStatus(msg, type) {
        var e = document.getElementById('rematch-status');
        e.textContent = msg;
        e.className = 'status-text' + (type ? ' ' + type : '');
    }
    function hideRematchStatus() {
        document.getElementById('rematch-status').className = 'status-text hidden';
    }
    function setRematchButton(text, disabled) {
        var b = document.getElementById('btn-rematch');
        b.textContent = text;
        b.disabled = !!disabled;
    }
    function hideRematchButton() {
        document.getElementById('btn-rematch').style.display = 'none';
    }

    return {
        showScreen: showScreen,
        getPlayerName: getPlayerName,
        setPlayerNameInput: setPlayerNameInput,
        setDisplayName: setDisplayName,
        setRoomCode: setRoomCode,
        setHostStatus: setHostStatus,
        getRoomCodeForLink: getRoomCodeForLink,
        getJoinCode: getJoinCode,
        setJoinCode: setJoinCode,
        showJoinError: showJoinError,
        hideJoinError: hideJoinError,
        showJoinStatus: showJoinStatus,
        hideJoinStatus: hideJoinStatus,
        setConnRoom: setConnRoom,
        setConnStatus: setConnStatus,
        initGameUI: initGameUI,
        renderHand: renderHand,
        disableAllCards: disableAllCards,
        updateScores: updateScores,
        setGameStatus: setGameStatus,
        showBattleResult: showBattleResult,
        resetBattle: resetBattle,
        addLogEntry: addLogEntry,
        addSystemLog: addSystemLog,
        showExitModal: showExitModal,
        hideExitModal: hideExitModal,
        showGameOver: showGameOver,
        setRematchStatus: setRematchStatus,
        hideRematchStatus: hideRematchStatus,
        setRematchButton: setRematchButton,
        hideRematchButton: hideRematchButton
    };
})();
