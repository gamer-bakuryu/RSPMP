const Game = (() => {
    const SYMBOLS = {
        ROCK: { emoji: '🪨', name: 'Pedra', beats: 'SCISSORS' },
        PAPER: { emoji: '📄', name: 'Papel', beats: 'ROCK' },
        SCISSORS: { emoji: '✂️', name: 'Tesoura', beats: 'PAPER' }
    };

    const SYMBOL_KEYS = ['ROCK', 'PAPER', 'SCISSORS'];

    let state = {
        myName: '',
        opponentName: '',
        myScore: 0,
        opponentScore: 0,
        myHand: [],
        myChoice: null,
        opponentChoice: null,
        roundNumber: 0,
        log: [],
        waiting: false,
        gameOver: false,
        isHost: false
    };

    let cardIdCounter = 0;

    function generateHand() {
        const hand = [];
        for (let i = 0; i < 5; i++) {
            const type = SYMBOL_KEYS[Math.floor(Math.random() * 3)];
            hand.push({
                id: cardIdCounter++,
                type: type,
                used: false
            });
        }
        return hand;
    }

    function init(myName, opponentName, host) {
        cardIdCounter = 0;
        state = {
            myName: myName,
            opponentName: opponentName,
            myScore: 0,
            opponentScore: 0,
            myHand: generateHand(),
            myChoice: null,
            opponentChoice: null,
            roundNumber: 0,
            log: [],
            waiting: false,
            gameOver: false,
            isHost: host
        };
        return { ...state };
    }

    function getState() {
        return { ...state, myHand: state.myHand.map(c => ({ ...c })) };
    }

    function selectCard(cardIndex) {
        if (state.gameOver || state.waiting) return false;
        if (cardIndex < 0 || cardIndex >= state.myHand.length) return false;
        if (state.myHand[cardIndex].used) return false;
        state.myChoice = cardIndex;
        return true;
    }

    function deselectCard() {
        state.myChoice = null;
    }

    function confirmChoice() {
        if (state.myChoice === null) return null;
        const card = state.myHand[state.myChoice];
        card.used = true;
        state.waiting = true;
        return card.type;
    }

    function receiveOpponentChoice(symbolKey) {
        state.opponentChoice = symbolKey;
    }

    function resolveRound() {
        if (state.myChoice === null || state.opponentChoice === null) return null;

        const myCard = state.myHand[state.myChoice];
        const mySymbol = myCard.type;
        const oppSymbol = state.opponentChoice;

        state.roundNumber++;

        let result;
        if (mySymbol === oppSymbol) {
            result = 'draw';
        } else if (SYMBOLS[mySymbol].beats === oppSymbol) {
            result = 'win';
            state.myScore++;
        } else {
            result = 'lose';
            state.opponentScore++;
        }

        let logText;
        if (result === 'win') {
            logText = state.myName + ' venceu!';
        } else if (result === 'lose') {
            logText = state.opponentName + ' venceu!';
        } else {
            logText = 'Empate!';
        }

        state.log.push({
            round: state.roundNumber,
            mySymbol: mySymbol,
            oppSymbol: oppSymbol,
            result: result,
            text: logText
        });

        const roundResult = {
            result: result,
            mySymbol: mySymbol,
            oppSymbol: oppSymbol,
            myScore: state.myScore,
            oppScore: state.opponentScore,
            roundNumber: state.roundNumber,
            logText: logText,
            gameOver: false,
            winner: null,
            newHand: false
        };

        if (Math.abs(state.myScore - state.opponentScore) >= 2 && state.roundNumber >= 2) {
            state.gameOver = true;
            roundResult.gameOver = true;
            roundResult.winner = state.myScore > state.opponentScore ? 'me' : 'opponent';
        }

        state.myChoice = null;
        state.opponentChoice = null;
        state.waiting = false;

        const availableCards = state.myHand.filter(c => !c.used);
        if (availableCards.length === 0 && !state.gameOver) {
            state.myHand = generateHand();
            roundResult.newHand = true;
        }

        return roundResult;
    }

    function forceEnd() {
        state.gameOver = true;
    }

    return {
        SYMBOLS,
        SYMBOL_KEYS,
        init,
        getState,
        generateHand,
        selectCard,
        deselectCard,
        confirmChoice,
        receiveOpponentChoice,
        resolveRound,
        forceEnd
    };
})();
