(function () {
    'use strict';

    let playerName = '';
    let isHost = false;
    let myChoiceType = null;
    let opponentChoiceType = null;
    let roundInProgress = false;
    let currentRoomCode = '';
    let gameStarted = false;

    function init() {
        const savedName = localStorage.getItem('rspmp_player_name');
        if (savedName) {
            UI.setPlayerNameInput(savedName);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        if (roomFromUrl) {
            window._autoJoinRoom = roomFromUrl.toUpperCase().trim();
        }

        bindEvents();
        setupConnectionHandlers();
    }

    function bindEvents() {
        document.getElementById('btn-confirm-name').addEventListener('click', onConfirmName);
        document.getElementById('player-name').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') onConfirmName();
        });

        document.getElementById('btn-host').addEventListener('click', onHost);
        document.getElementById('btn-join').addEventListener('click', onJoinScreen);
        document.getElementById('btn-rename').addEventListener('click', onRename);

        document.getElementById('btn-copy-code').addEventListener('click', onCopyCode);
        document.getElementById('btn-cancel-host').addEventListener('click', onCancelHost);

        document.getElementById('btn-join-confirm').addEventListener('click', onJoinConfirm);
        document.getElementById('btn-join-back').addEventListener('click', function () {
            Connection.close();
            UI.showScreen('screen-menu');
        });
        document.getElementById('join-code').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') onJoinConfirm();
        });

        document.getElementById('btn-exit-game').addEventListener('click', function () {
            UI.showExitModal();
        });

        document.getElementById('exit-confirm').addEventListener('click', onExitConfirm);
        document.getElementById('exit-cancel').addEventListener('click', function () {
            UI.hideExitModal();
        });

        document.getElementById('btn-back-menu').addEventListener('click', onBackToMenu);
    }

    function setupConnectionHandlers() {
        Connection.onOpen(onConnectionOpen);
        Connection.onMessage(onConnectionMessage);
        Connection.onClose(onConnectionClose);
    }

    // ---- NAME ----
    function onConfirmName() {
        const name = UI.getPlayerName();
        if (!name || name.length < 1) {
            alert('Por favor, digite um nome.');
            return;
        }
        playerName = name;
        localStorage.setItem('rspmp_player_name', playerName);
        UI.setDisplayName(playerName);
        UI.showScreen('screen-menu');

        if (window._autoJoinRoom) {
            const code = window._autoJoinRoom;
            delete window._autoJoinRoom;
            UI.setJoinCode(code);
            UI.showScreen('screen-join');
            // Auto-join
            setTimeout(function () {
                onJoinConfirm();
            }, 300);
        }
    }

    function onRename() {
        UI.setPlayerNameInput(playerName);
        UI.showScreen('screen-name');
    }

    // ---- HOST ----
    async function onHost() {
        isHost = true;
        gameStarted = false;

        // Rebuild handlers since we're creating a new connection
        setupConnectionHandlers();

        UI.setRoomCode('...');
        UI.setHostStatus('Conectando ao servidor...');
        UI.showScreen('screen-host');

        try {
            const roomCode = await Connection.host(function (status) {
                UI.setHostStatus(status);
            });
            currentRoomCode = roomCode;
            UI.setRoomCode(roomCode);
            UI.setHostStatus('Aguardando oponente...');
            console.log('[APP] Room created:', roomCode);
        } catch (err) {
            console.error('[APP] Host error:', err);
            alert('Erro ao criar sala: ' + err.message);
            UI.showScreen('screen-menu');
        }
    }

    function onCopyCode() {
        const link = UI.getRoomCodeForLink(currentRoomCode);
        const btn = document.getElementById('btn-copy-code');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(function () {
                btn.textContent = '✓ Copiado!';
                setTimeout(function () { btn.textContent = 'Copiar Link'; }, 2000);
            }).catch(function () {
                fallbackCopy(link, btn);
            });
        } else {
            fallbackCopy(link, btn);
        }
    }

    function fallbackCopy(text, btn) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            btn.textContent = '✓ Copiado!';
        } catch (e) {
            btn.textContent = 'Erro ao copiar';
            prompt('Copie o link manualmente:', text);
        }
        document.body.removeChild(ta);
        setTimeout(function () { btn.textContent = 'Copiar Link'; }, 2000);
    }

    function onCancelHost() {
        Connection.close();
        UI.showScreen('screen-menu');
    }

    // ---- JOIN ----
    function onJoinScreen() {
        UI.hideJoinError();
        UI.hideJoinStatus();
        UI.setJoinCode('');
        UI.showScreen('screen-join');
    }

    async function onJoinConfirm() {
        const code = UI.getJoinCode();
        if (!code) {
            UI.showJoinError('Digite o código da sala.');
            return;
        }

        UI.hideJoinError();
        isHost = false;
        gameStarted = false;
        currentRoomCode = code;

        // Rebuild handlers
        setupConnectionHandlers();

        // Disable button during connection
        const btn = document.getElementById('btn-join-confirm');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        try {
            await Connection.join(code, function (status) {
                UI.showJoinStatus(status);
            });
            UI.showJoinStatus('Conectado! Iniciando partida...');
            console.log('[APP] Joined room:', code);
        } catch (err) {
            console.error('[APP] Join error:', err);
            UI.showJoinError(err.message);
            UI.hideJoinStatus();
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    }

    // ---- CONNECTION CALLBACKS ----
    function onConnectionOpen() {
        console.log('[APP] Connection open, sending hello');
        Connection.send({
            type: 'hello',
            name: playerName
        });
    }

    function onConnectionMessage(data) {
        if (!data || !data.type) {
            console.warn('[APP] Invalid message:', data);
            return;
        }

        console.log('[APP] Message received:', data.type);

        switch (data.type) {
            case 'hello':
                handleHello(data);
                break;
            case 'choice':
                handleOpponentChoice(data);
                break;
            case 'exit':
                handleOpponentExit();
                break;
        }
    }

    function onConnectionClose() {
        console.log('[APP] Connection closed, gameStarted:', gameStarted);
        if (gameStarted && !Game.getState().gameOver) {
            handleOpponentExit();
        }
    }

    // ---- HELLO HANDSHAKE ----
    function handleHello(data) {
        if (gameStarted) return;

        const opponentName = data.name || 'Oponente';
        gameStarted = true;

        console.log('[APP] Game starting! Me:', playerName, 'vs', opponentName);

        Game.init(playerName, opponentName, isHost);
        UI.initGameUI(playerName, opponentName);

        const state = Game.getState();
        UI.renderHand(state.myHand, null, onCardSelect);

        myChoiceType = null;
        opponentChoiceType = null;
        roundInProgress = false;

        UI.showScreen('screen-game');
    }

    // ---- CARD SELECTION ----
    function onCardSelect(index) {
        if (roundInProgress) return;

        const state = Game.getState();
        if (state.gameOver) return;
        if (state.myHand[index].used) return;

        if (state.myChoice === index) {
            // Second click = confirm
            confirmAndSendChoice();
            return;
        }

        Game.selectCard(index);
        const newState = Game.getState();
        UI.renderHand(newState.myHand, newState.myChoice, onCardSelect);
        UI.setGameStatus('Clique novamente na carta para confirmar', '');
    }

    function confirmAndSendChoice() {
        const choiceType = Game.confirmChoice();
        if (!choiceType) return;

        myChoiceType = choiceType;
        roundInProgress = true;

        const state = Game.getState();
        UI.renderHand(state.myHand, null, onCardSelect);
        UI.disableAllCards();

        document.getElementById('battle-symbol-me').textContent = Game.SYMBOLS[choiceType].emoji;

        Connection.send({
            type: 'choice',
            symbol: choiceType
        });

        if (opponentChoiceType) {
            resolveRound();
        } else {
            UI.setGameStatus('Aguardando oponente escolher...', '');
        }
    }

    // ---- OPPONENT CHOICE ----
    function handleOpponentChoice(data) {
        opponentChoiceType = data.symbol;
        Game.receiveOpponentChoice(data.symbol);

        if (myChoiceType) {
            resolveRound();
        }
    }

    // ---- RESOLVE ROUND ----
    function resolveRound() {
        const result = Game.resolveRound();
        if (!result) return;

        UI.showBattleResult(result.mySymbol, result.oppSymbol, result.result);
        UI.updateScores(result.myScore, result.oppScore);

        if (result.result === 'win') {
            UI.setGameStatus(
                'Você venceu a rodada! (' + Game.SYMBOLS[result.mySymbol].name + ' > ' + Game.SYMBOLS[result.oppSymbol].name + ')',
                'win'
            );
        } else if (result.result === 'lose') {
            UI.setGameStatus(
                'Você perdeu a rodada! (' + Game.SYMBOLS[result.oppSymbol].name + ' > ' + Game.SYMBOLS[result.mySymbol].name + ')',
                'lose'
            );
        } else {
            UI.setGameStatus(
                'Empate! Ambos jogaram ' + Game.SYMBOLS[result.mySymbol].name,
                'draw'
            );
        }

        UI.addLogEntry(result.roundNumber, result.logText, result.result);

        if (result.gameOver) {
            setTimeout(function () {
                const state = Game.getState();
                gameStarted = false;
                UI.showGameOver(
                    result.winner,
                    state.myName,
                    state.opponentName,
                    state.myScore,
                    state.opponentScore,
                    state.roundNumber
                );
                Connection.close();
            }, 2500);
            return;
        }

        setTimeout(function () {
            myChoiceType = null;
            opponentChoiceType = null;
            roundInProgress = false;

            const state = Game.getState();

            if (result.newHand) {
                UI.setGameStatus('Novas cartas distribuídas!', '');
                setTimeout(function () {
                    UI.renderHand(state.myHand, null, onCardSelect);
                    UI.resetBattle();
                    UI.setGameStatus('Escolha uma carta para jogar', '');
                }, 800);
            } else {
                UI.renderHand(state.myHand, null, onCardSelect);
                UI.resetBattle();
                UI.setGameStatus('Escolha uma carta para jogar', '');
            }
        }, 2200);
    }

    // ---- EXIT ----
    function onExitConfirm() {
        UI.hideExitModal();
        Connection.send({ type: 'exit' });

        const state = Game.getState();
        Game.forceEnd();
        gameStarted = false;

        Connection.close();

        UI.showGameOver(
            'cancelled',
            state.myName,
            state.opponentName,
            state.myScore,
            state.opponentScore,
            state.roundNumber
        );
    }

    function handleOpponentExit() {
        Game.forceEnd();
        UI.hideExitModal();

        const state = Game.getState();
        gameStarted = false;

        Connection.close();

        let winner = 'cancelled';
        if (state.myScore > state.opponentScore) winner = 'me';
        else if (state.opponentScore > state.myScore) winner = 'opponent';

        UI.showGameOver(
            winner,
            state.myName,
            state.opponentName,
            state.myScore,
            state.opponentScore,
            state.roundNumber
        );
    }

    function onBackToMenu() {
        Connection.close();
        gameStarted = false;
        const url = window.location.href.split('?')[0].split('#')[0];
        window.history.replaceState({}, '', url);
        UI.showScreen('screen-menu');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
