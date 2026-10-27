var Game = (function () {
    var SYMBOLS = {
        ROCK:     { emoji: '🪨', name: 'Pedra',   beats: 'SCISSORS' },
        PAPER:    { emoji: '📄', name: 'Papel',   beats: 'ROCK' },
        SCISSORS: { emoji: '✂️', name: 'Tesoura', beats: 'PAPER' }
    };

    var SYMBOL_KEYS = ['ROCK', 'PAPER', 'SCISSORS'];

    var state = emptyState();
    var cardIdCounter = 0;

    function emptyState() {
        return {
            myName: '', opponentName: '',
            myScore: 0, opponentScore: 0,
            myHand: [], myChoice: null, opponentChoice: null,
            roundNumber: 0, log: [],
            waiting: false, gameOver: false, isHost: false,
            matchNumber: 1
        };
    }

    function generateHand() {
        var hand = [];
        for (var i = 0; i < 5; i++) {
            hand.push({
                id: cardIdCounter++,
                type: SYMBOL_KEYS[Math.floor(Math.random() * 3)],
                used: false
            });
        }
        return hand;
    }

    function init(myName, opponentName, host) {
        cardIdCounter = 0;
        state = emptyState();
        state.myName = myName;
        state.opponentName = opponentName;
        state.isHost = host;
        state.myHand = generateHand();
        return getState();
    }

    /* Revanche: mantém nomes, zera placar, novas cartas */
    function reset() {
        var m = state.matchNumber + 1;
        var myName = state.myName;
        var oppName = state.opponentName;
        var host = state.isHost;

        cardIdCounter = 0;
        state = emptyState();
        state.myName = myName;
        state.opponentName = oppName;
        state.isHost = host;
        state.matchNumber = m;
        state.myHand = generateHand();
        return getState();
    }

    function getState() {
        var copy = {};
        for (var k in state) copy[k] = state[k];
        copy.myHand = state.myHand.map(function (c) {
            return { id: c.id, type: c.type, used: c.used };
        });
        return copy;
    }

    function selectCard(i) {
        if (state.gameOver || state.waiting) return false;
        if (i < 0 || i >= state.myHand.length) return false;
        if (state.myHand[i].used) return false;
        state.myChoice = i;
        return true;
    }

    function confirmChoice() {
        if (state.myChoice === null) return null;
        var card = state.myHand[state.myChoice];
        card.used = true;
        state.waiting = true;
        return card.type;
    }

    function receiveOpponentChoice(sym) {
        state.opponentChoice = sym;
    }

    function resolveRound() {
        if (state.myChoice === null || state.opponentChoice === null) return null;

        var mySymbol = state.myHand[state.myChoice].type;
        var oppSymbol = state.opponentChoice;

        state.roundNumber++;

        var result;
        if (mySymbol === oppSymbol) {
            result = 'draw';
        } else if (SYMBOLS[mySymbol].beats === oppSymbol) {
            result = 'win';
            state.myScore++;
        } else {
            result = 'lose';
            state.opponentScore++;
        }

        var logText = result === 'win'  ? state.myName + ' venceu!'
                    : result === 'lose' ? state.opponentName + ' venceu!'
                    : 'Empate!';

        state.log.push({
            round: state.roundNumber,
            mySymbol: mySymbol, oppSymbol: oppSymbol,
            result: result, text: logText
        });

        var out = {
            result: result,
            mySymbol: mySymbol, oppSymbol: oppSymbol,
            myScore: state.myScore, oppScore: state.opponentScore,
            roundNumber: state.roundNumber,
            logText: logText,
            gameOver: false, winner: null, newHand: false
        };

        if (Math.abs(state.myScore - state.opponentScore) >= 2 && state.roundNumber >= 2) {
            state.gameOver = true;
            out.gameOver = true;
            out.winner = state.myScore > state.opponentScore ? 'me' : 'opponent';
        }

        state.myChoice = null;
        state.opponentChoice = null;
        state.waiting = false;

        var left = state.myHand.filter(function (c) { return !c.used; });
        if (left.length === 0 && !state.gameOver) {
            state.myHand = generateHand();
            out.newHand = true;
        }

        return out;
    }

    function forceEnd() { state.gameOver = true; }

    return {
        SYMBOLS: SYMBOLS,
        SYMBOL_KEYS: SYMBOL_KEYS,
        init: init,
        reset: reset,
        getState: getState,
        generateHand: generateHand,
        selectCard: selectCard,
        confirmChoice: confirmChoice,
        receiveOpponentChoice: receiveOpponentChoice,
        resolveRound: resolveRound,
        forceEnd: forceEnd
    };
})();
