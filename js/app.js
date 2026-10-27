/*  ============================================
    APP MODULE
    Main controller - ties everything together
    ============================================ */

(function () {
    'use strict';

    let playerName = '';
    let isHost = false;
    let myChoiceType = null;       // symbol key I chose
    let opponentChoiceType = null; // symbol key opponent chose
    let bothReady = false;
    let roundInProgress = false;
    let currentRoomCode = '';

    // ---- INIT ----
    function init() {
        // Check for saved name
        const savedName = localStorage.getItem('rspmp_player_name');
        if (savedName) {
            UI.setPlayerNameInput(savedName);
        }

        // Check URL for room code
        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');

        bindEvents();

        if (roomFromUrl) {
            // Auto-fill join screen
            UI.setPlayerNameInput(savedName || '');
            // We'll handle this after name is set
            window._autoJoinRoom = roomFromUrl;
        }
    }

    // ---- EVENT BINDINGS ----
    function bindEvents() {
        // Name screen
        document.getElementById('btn-confirm-name').addEventListener('click', onConfirmName);
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') onConfirmName();
        });

        // Menu
        document.getElementById('btn-host').addEventListener('click', onHost);
        document.getElementById('btn-join').addEventListener('click', onJoinScreen);
        document.getElementById('btn-rename').addEventListener('click', onRename);

        // Host screen
        document.getElementById('btn-copy-code').addEventListener('click', onCopyCode);
        document.getElementById('btn-cancel-host').addEventListener('click', onCancelHost);

        // Join screen
        document.getElementById('btn-join-confirm').addEventListener('click', onJoinConfirm);
        document.getElementById('btn-join-back').addEventListener('click', () => UI.showScreen('screen-menu'));
        document.getElementById('join-code').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') onJoinConfirm();
        });

        // Game
        document.getElementById('btn-exit-game').addEventListener('click', () => UI.showExitModal());

        // Exit modal
        document.getElementById('exit-confirm').addEventListener('click', onExitConfirm);
        document.getElementById('exit-cancel').addEventListener('click', () => UI.hideExitModal());

        // Game over
        document.getElementById('btn-back-menu').addEventListener('click', onBackToMenu);

        // Connection events
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

        // Auto join if came from link
        if (window._autoJoinRoom) {
            const code = window._autoJoinRoom;
            delete window._autoJoinRoom;
            UI.setJoinCode(code);
            UI.showScreen('screen-join');
        }
    }

    function onRename() {
        UI.setPlayerNameInput(playerName);
        UI.showScreen('screen-name');
    }

    // ---- HOST ----
    async function onHost() {
        isHost = true;
        try {
            const roomCode = await Connection.host();
            currentRoomCode = roomCode;
            UI.setRoomCode(roomCode);
            UI.showScreen('screen-host');
        } catch (err) {
            alert('Erro ao criar sala: ' + err.message);
        }
    }

    function onCopyCode() {
        const link = UI.getRoomCodeForLink(currentRoomCode);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                document.getElementById('btn-copy-code').textContent = 'Copiado!';
                setTimeout(() => {
                    document.getElementById('btn-copy-code').textContent = 'Copiar Link';
                }, 2000);
            });
        } else {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = link;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            document.getElementById('btn-copy-code').textContent = 'Copiado!';
            setTimeout(() => {
                document.getElementById('btn-copy-code').textContent = 'Copiar Link';
            }, 2000);
        }
    }

    function onCancelHost() {
        Connection.close();
        UI.showScreen('screen-menu');
    }

    // ---- JOIN ----
    function onJoinScreen() {
        UI.hideJoinError();
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

        try {
            await Connection.join(code);
            currentRoomCode = code;
            // Will transition to game on connection open
            UI.setGameStatus('Conectando...', '');
        } catch (err) {
            UI.showJoinError(err.message);
        }
    }

    // ---- CONNECTION CALLBACKS ----
    function onConnectionOpen() {
        // Send name to opponent
        Connection.send({
            type: 'hello',
            name: playerName
        });
    }

    function onConnectionMessage(data) {
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
            case 'hand_seed':
                // Host sends seed so both can have same randomness if needed
                break;
        }
    }

    function onConnectionClose() {
        if (!Game.getState().gameOver) {
            handleOpponentExit();
        }
    }

    // ---- HELLO HANDSHAKE ----
    function handleHello(data) {
        const opponentName = data.name || 'Oponente';

        // Start game
        Game.init(playerName, opponentName, isHost);
        UI.initGameUI(playerName, opponentName);

        const state = Game.getState();
        UI.renderHand(state.myHand, state.myChoice, onCardSelect);

        UI.showScreen('screen-game');

        myChoiceType = null;
        opponentChoiceType = null;
        roundInProgress = false;
    }

    // ---- CARD SELECTION ----
    function onCardSelect(index) {
        if (roundInProgress) return;

        const state = Game.getState();
        if (state.gameOver) return;
        if (state.myHand[index].used) return;

        // Toggle selection
        const currentChoice = Game.getState().myChoice;
        if (currentChoice === index) {
            // Confirm the choice
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

        // Show my choice in battle area
        document.getElementById('battle-symbol-me').textContent = Game.SYMBOLS[choiceType].emoji;

        // Send to opponent
        Connection.send({
            type: 'choice',
            symbol: choiceType
        });

        if (opponentChoiceType) {
            // Opponent already chose, resolve immediately
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
            // I already chose, resolve
            resolveRound();
        }
    }

    // ---- RESOLVE ROUND ----
    function resolveRound() {
        const result = Game.resolveRound();
        if (!result) return;

        // Show battle result
        UI.showBattleResult(result.mySymbol, result.oppSymbol, result.result);
        UI.updateScores(result.myScore, result.oppScore);

        // Status text
        if (result.result === 'win') {
            UI.setGameStatus(`Você venceu a rodada! (${Game.SYMBOLS[result.mySymbol].name} > ${Game.SYMBOLS[result.oppSymbol].name})`, 'win');
        } else if (result.result === 'lose') {
            UI.setGameStatus(`Você perdeu a rodada! (${Game.SYMBOLS[result.oppSymbol].name} > ${Game.SYMBOLS[result.mySymbol].name})`, 'lose');
        } else {
            UI.setGameStatus(`Empate! Ambos jogaram ${Game.SYMBOLS[result.mySymbol].name}`, 'draw');
        }

        // Add to log
        UI.addLogEntry(result.roundNumber, result.logText, result.result);

        // Check game over
        if (result.gameOver) {
            setTimeout(() => {
                const state = Game.getState();
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

        // Prepare next round after delay
        setTimeout(() => {
            myChoiceType = null;
            opponentChoiceType = null;
            roundInProgress = false;

            const state = Game.getState();

            if (result.newHand) {
                // Animate new hand
                UI.setGameStatus('Novas cartas distribuídas!', '');
                setTimeout(() => {
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
        Connection.close();

        const state = Game.getState();
        Game.forceEnd();

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
        Connection.close();

        UI.showGameOver(
            state.myScore > state.opponentScore ? 'me' : (state.opponentScore > state.myScore ? 'opponent' : 'cancelled'),
            state.myName,
            state.opponentName,
            state.myScore,
            state.opponentScore,
            state.roundNumber
        );
    }

    function onBackToMenu() {
        Connection.close();
        // Clean URL params
        const url = window.location.href.split('?')[0].split('#')[0];
        window.history.replaceState({}, '', url);
        UI.showScreen('screen-menu');
    }

    // ---- START ----
    document.addEventListener('DOMContentLoaded', init);
})();
