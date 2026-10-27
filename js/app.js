(function () {
    'use strict';

    var playerName = '';
    var isHost = false;
    var myChoiceType = null;
    var opponentChoiceType = null;
    var roundInProgress = false;
    var currentRoomCode = '';
    var gameStarted = false;
    var hsTimer = null;

    // revanche
    var iWantRematch = false;
    var oppWantsRematch = false;
    var atGameOver = false;
    var selfClosed = false;

    /* ---------- INIT ---------- */
    function init() {
        var saved = localStorage.getItem('rspmp_player_name');
        if (saved) UI.setPlayerNameInput(saved);

        var p = new URLSearchParams(window.location.search).get('room');
        if (p) window._autoJoinRoom = p.toUpperCase().trim();

        bindEvents();
        bindDebug();

        Connection.onOpen(onOpen);
        Connection.onMessage(onMessage);
        Connection.onClose(onClose);

        UI.setConnStatus(false);
        Debug.log('APP >> iniciado');
    }

    function bindDebug() {
        document.getElementById('debug-toggle').addEventListener('click', function () {
            document.getElementById('debug-panel').classList.toggle('hidden');
            Debug.render();
        });
        document.getElementById('debug-close').addEventListener('click', function () {
            document.getElementById('debug-panel').classList.add('hidden');
        });
        document.getElementById('debug-clear').addEventListener('click', Debug.clear);
    }

    function bindEvents() {
        document.getElementById('btn-confirm-name').addEventListener('click', onConfirmName);
        document.getElementById('player-name').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') onConfirmName();
        });
        document.getElementById('btn-host').addEventListener('click', onHost);
        document.getElementById('btn-join').addEventListener('click', onJoinScreen);
        document.getElementById('btn-rename').addEventListener('click', function () {
            UI.setPlayerNameInput(playerName);
            UI.showScreen('screen-name');
        });
        document.getElementById('btn-copy-code').addEventListener('click', onCopyCode);
        document.getElementById('btn-cancel-host').addEventListener('click', function () {
            leaveEverything();
            UI.showScreen('screen-menu');
        });
        document.getElementById('btn-join-confirm').addEventListener('click', onJoinConfirm);
        document.getElementById('btn-join-back').addEventListener('click', function () {
            leaveEverything();
            UI.showScreen('screen-menu');
        });
        document.getElementById('join-code').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') onJoinConfirm();
        });
        document.getElementById('btn-exit-game').addEventListener('click', function () {
            UI.showExitModal();
        });
        document.getElementById('exit-confirm').addEventListener('click', onExitConfirm);
        document.getElementById('exit-cancel').addEventListener('click', UI.hideExitModal);
        document.getElementById('btn-rematch').addEventListener('click', onRematchClick);
        document.getElementById('btn-back-menu').addEventListener('click', onBackToMenu);
    }

    /* ---------- NOME ---------- */
    function onConfirmName() {
        var n = UI.getPlayerName();
        if (!n) { alert('Por favor, digite um nome.'); return; }
        playerName = n;
        localStorage.setItem('rspmp_player_name', playerName);
        UI.setDisplayName(playerName);
        UI.showScreen('screen-menu');

        if (window._autoJoinRoom) {
            var code = window._autoJoinRoom;
            delete window._autoJoinRoom;
            UI.setJoinCode(code);
            UI.showScreen('screen-join');
            setTimeout(onJoinConfirm, 400);
        }
    }

    /* ---------- HOST ---------- */
    function onHost() {
        isHost = true;
        gameStarted = false;
        selfClosed = false;
        stopHandshake();

        UI.setRoomCode('...');
        UI.setHostStatus('Conectando ao servidor...');
        UI.showScreen('screen-host');

        Connection.host(function (s) { UI.setHostStatus(s); })
            .then(function (code) {
                currentRoomCode = code;
                UI.setRoomCode(code);
                UI.setConnRoom(code);
            })
            .catch(function (err) {
                Debug.log('APP >> ERRO host: ' + err.message);
                alert('Erro ao criar sala: ' + err.message);
                UI.showScreen('screen-menu');
            });
    }

    function onCopyCode() {
        var link = UI.getRoomCodeForLink(currentRoomCode);
        var btn = document.getElementById('btn-copy-code');
        function ok() {
            btn.textContent = '✓ Copiado!';
            setTimeout(function () { btn.textContent = 'Copiar Link'; }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(ok).catch(function () { fallback(link, ok); });
        } else { fallback(link, ok); }
    }

    function fallback(text, ok) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); }
        catch (e) { prompt('Copie manualmente:', text); }
        document.body.removeChild(ta);
    }

    /* ---------- JOIN ---------- */
    function onJoinScreen() {
        UI.hideJoinError(); UI.hideJoinStatus(); UI.setJoinCode('');
        UI.showScreen('screen-join');
    }

    function onJoinConfirm() {
        var code = UI.getJoinCode();
        if (!code) { UI.showJoinError('Digite o código da sala.'); return; }

        UI.hideJoinError();
        isHost = false;
        gameStarted = false;
        selfClosed = false;
        currentRoomCode = code;
        UI.setConnRoom(code);
        stopHandshake();

        var btn = document.getElementById('btn-join-confirm');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        Connection.join(code, function (s) { UI.showJoinStatus(s); })
            .then(function () { UI.showJoinStatus('Conectado! Sincronizando...'); })
            .catch(function (err) {
                Debug.log('APP >> ERRO join: ' + err.message);
                UI.showJoinError(err.message);
                UI.hideJoinStatus();
            })
            .then(function () {
                btn.disabled = false;
                btn.textContent = 'Entrar';
            });
    }

    /* ---------- HANDSHAKE ---------- */
    function startHandshake() {
        stopHandshake();
        var n = 0;
        Debug.log('HS >> handshake iniciado');
        Connection.send({ type: 'hello', name: playerName });
        hsTimer = setInterval(function () {
            n++;
            if (gameStarted || n > 30) { stopHandshake(); return; }
            Connection.send({ type: 'hello', name: playerName });
        }, 700);
    }

    function stopHandshake() {
        if (hsTimer) { clearInterval(hsTimer); hsTimer = null; }
    }

    /* ---------- CALLBACKS ---------- */
    function onOpen() {
        UI.setConnStatus(true);
        startHandshake();
    }

    function onMessage(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'hello':
                Connection.send({ type: 'hello_ack', name: playerName });
                stopHandshake();
                startGame(data.name);
                break;
            case 'hello_ack':
                stopHandshake();
                startGame(data.name);
                break;
            case 'choice':
                handleOpponentChoice(data);
                break;
            case 'rematch':
                handleRematchRequest();
                break;
            case 'exit':
                handleOpponentExit();
                break;
        }
    }

    function onClose() {
        UI.setConnStatus(false);
        stopHandshake();

        if (selfClosed) return;

        if (gameStarted && !Game.getState().gameOver) {
            handleOpponentExit();
        } else if (atGameOver) {
            UI.hideRematchButton();
            UI.setRematchStatus('O oponente saiu da sala.', 'bad');
        }
    }

    /* ---------- START / RESTART ---------- */
    function startGame(opponentName) {
        if (gameStarted) return;
        gameStarted = true;
        atGameOver = false;
        opponentName = opponentName || 'Oponente';

        Debug.log('APP >> INICIANDO: ' + playerName + ' vs ' + opponentName);

        Game.init(playerName, opponentName, isHost);
        UI.setConnRoom(currentRoomCode);
        UI.setConnStatus(true);
        UI.initGameUI(playerName, opponentName, 1);
        UI.renderHand(Game.getState().myHand, null, onCardSelect);

        myChoiceType = null;
        opponentChoiceType = null;
        roundInProgress = false;

        UI.showScreen('screen-game');
    }

    function doRematch() {
        iWantRematch = false;
        oppWantsRematch = false;
        atGameOver = false;
        gameStarted = true;

        var s = Game.reset();
        Debug.log('APP >> REVANCHE partida #' + s.matchNumber);

        UI.initGameUI(s.myName, s.opponentName, s.matchNumber);
        UI.renderHand(s.myHand, null, onCardSelect);

        myChoiceType = null;
        opponentChoiceType = null;
        roundInProgress = false;

        UI.showScreen('screen-game');
    }

    function onRematchClick() {
        if (!Connection.isConnected()) {
            UI.setRematchStatus('Conexão perdida. Volte ao menu.', 'bad');
            UI.hideRematchButton();
            return;
        }
        iWantRematch = true;
        Connection.send({ type: 'rematch' });
        UI.setRematchButton('Aguardando...', true);

        if (oppWantsRematch) doRematch();
        else UI.setRematchStatus('Pedido enviado. Aguardando o oponente...', 'warn');
    }

    function handleRematchRequest() {
        oppWantsRematch = true;
        if (iWantRematch) {
            doRematch();
        } else if (atGameOver) {
            UI.setRematchStatus('O oponente quer jogar novamente!', 'ok');
            UI.setRematchButton('Aceitar Revanche', false);
        }
    }

    /* ---------- CARTAS ---------- */
    function onCardSelect(index) {
        if (roundInProgress) return;
        var st = Game.getState();
        if (st.gameOver || st.myHand[index].used) return;

        if (st.myChoice === index) { confirmChoice(); return; }

        Game.selectCard(index);
        var ns = Game.getState();
        UI.renderHand(ns.myHand, ns.myChoice, onCardSelect);
        UI.setGameStatus('Clique novamente na carta para confirmar', '');
    }

    function confirmChoice() {
        var t = Game.confirmChoice();
        if (!t) return;
        myChoiceType = t;
        roundInProgress = true;

        UI.renderHand(Game.getState().myHand, null, onCardSelect);
        UI.disableAllCards();
        document.getElementById('battle-symbol-me').textContent = Game.SYMBOLS[t].emoji;

        Connection.send({ type: 'choice', symbol: t });

        if (opponentChoiceType) resolveRound();
        else UI.setGameStatus('Aguardando oponente escolher...', '');
    }

    function handleOpponentChoice(data) {
        opponentChoiceType = data.symbol;
        Game.receiveOpponentChoice(data.symbol);
        if (myChoiceType) resolveRound();
        else UI.setGameStatus('Oponente já escolheu. Sua vez!', '');
    }

    /* ---------- RODADA ---------- */
    function resolveRound() {
        var r = Game.resolveRound();
        if (!r) return;

        UI.showBattleResult(r.mySymbol, r.oppSymbol, r.result);
        UI.updateScores(r.myScore, r.oppScore);

        if (r.result === 'win') {
            UI.setGameStatus('Você venceu a rodada! (' + Game.SYMBOLS[r.mySymbol].name +
                ' > ' + Game.SYMBOLS[r.oppSymbol].name + ')', 'win');
        } else if (r.result === 'lose') {
            UI.setGameStatus('Você perdeu a rodada! (' + Game.SYMBOLS[r.oppSymbol].name +
                ' > ' + Game.SYMBOLS[r.mySymbol].name + ')', 'lose');
        } else {
            UI.setGameStatus('Empate! Ambos jogaram ' + Game.SYMBOLS[r.mySymbol].name, 'draw');
        }

        UI.addLogEntry(r.roundNumber, r.logText, r.result);

        if (r.gameOver) {
            setTimeout(function () {
                var s = Game.getState();
                gameStarted = false;
                atGameOver = true;
                iWantRematch = false;
                oppWantsRematch = false;

                UI.showGameOver(r.winner, s.myName, s.opponentName,
                    s.myScore, s.opponentScore, s.roundNumber,
                    Connection.isConnected());
            }, 2500);
            return;
        }

        setTimeout(function () {
            myChoiceType = null;
            opponentChoiceType = null;
            roundInProgress = false;
            var s = Game.getState();

            if (r.newHand) {
                UI.setGameStatus('Novas cartas distribuídas!', '');
                setTimeout(function () {
                    UI.renderHand(s.myHand, null, onCardSelect);
                    UI.resetBattle();
                    UI.setGameStatus('Escolha uma carta para jogar', '');
                }, 800);
            } else {
                UI.renderHand(s.myHand, null, onCardSelect);
                UI.resetBattle();
                UI.setGameStatus('Escolha uma carta para jogar', '');
            }
        }, 2200);
    }

    /* ---------- SAÍDA ---------- */
    function onExitConfirm() {
        UI.hideExitModal();
        Connection.send({ type: 'exit' });

        var s = Game.getState();
        Game.forceEnd();
        gameStarted = false;
        atGameOver = true;
        selfClosed = true;
        stopHandshake();

        setTimeout(function () {
            Connection.close();
            UI.setConnStatus(false);
        }, 250);

        UI.showGameOver('cancelled', s.myName, s.opponentName,
            s.myScore, s.opponentScore, s.roundNumber, false);
        UI.setRematchStatus('Você encerrou a sala.', 'bad');
    }

    function handleOpponentExit() {
        Game.forceEnd();
        UI.hideExitModal();

        var s = Game.getState();
        gameStarted = false;
        atGameOver = true;
        selfClosed = true;
        stopHandshake();
        Connection.close();
        UI.setConnStatus(false);

        var w = 'cancelled';
        if (s.myScore > s.opponentScore) w = 'me';
        else if (s.opponentScore > s.myScore) w = 'opponent';

        UI.showGameOver(w, s.myName, s.opponentName,
            s.myScore, s.opponentScore, s.roundNumber, false);
        UI.setRematchStatus('O oponente saiu da sala.', 'bad');
    }

    function leaveEverything() {
        selfClosed = true;
        stopHandshake();
        Connection.close();
        UI.setConnStatus(false);
        UI.setConnRoom('—');
        gameStarted = false;
        atGameOver = false;
    }

    function onBackToMenu() {
        leaveEverything();
        var url = window.location.href.split('?')[0].split('#')[0];
        window.history.replaceState({}, '', url);
        UI.showScreen('screen-menu');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
