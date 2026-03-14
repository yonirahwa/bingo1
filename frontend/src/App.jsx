import { useEffect, useState, useRef } from 'react';
import socket from './socket';
import { createInitialState } from './useGameStore';
import BoardSelectionPage from './pages/BoardSelectionPage';
import GamePlayPage from './pages/GamePlayPage';
import './styles/global.css';

// Telegram WebApp SDK helper
const tg = window.Telegram?.WebApp;

function getTelegramUser() {
    if (tg && tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        return {
            userId: String(u.id),
            userName: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
        };
    }
    // Fallback for browser testing (random ID each session)
    const stored = sessionStorage.getItem('bingo_dev_user');
    if (stored) return JSON.parse(stored);
    const dev = { userId: String(Math.floor(Math.random() * 900000) + 100000), userName: 'Player_dev' };
    sessionStorage.setItem('bingo_dev_user', JSON.stringify(dev));
    return dev;
}

export default function App() {
    const [game, setGame] = useState(createInitialState());
    const [connected, setConnected] = useState(false);
    const [minLoadingDone, setMinLoadingDone] = useState(false);
    const userRef = useRef(getTelegramUser());

    useEffect(() => {
        const timer = setTimeout(() => setMinLoadingDone(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    // Merge partial game updates
    const mergeGame = (partial) => setGame(prev => ({ ...prev, ...partial }));

    useEffect(() => {
        tg?.ready?.();
        tg?.expand?.();

        socket.connect();

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join', userRef.current);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Link failed:', err.message);
            // setToast for on-screen debug
        });

        socket.on('disconnect', () => setConnected(false));

        // Full state snapshot on join
        socket.on('gameState', (state) => {
            // Restore marks from server if they exist
            const restoredMarks = {};
            if (state.myMarks) {
                for (const cardId in state.myMarks) {
                    restoredMarks[cardId] = new Set(state.myMarks[cardId]);
                }
            }

            setGame(prev => ({
                ...prev,
                ...state,
                myMarks: Object.keys(restoredMarks).length > 0 ? restoredMarks : prev.myMarks,
            }));
        });

        // Timer ticks
        socket.on('timerTick', ({ timer, phase }) => {
            mergeGame({ timer, phase });
        });

        // Card taken by someone
        socket.on('cardTaken', ({ cardId, userName, totalTaken, winPot }) => {
            setGame(prev => ({
                ...prev,
                totalTaken,
                winPot,
                takenCards: { ...prev.takenCards, [cardId]: { userName } },
            }));
        });

        // Card released
        socket.on('cardReleased', ({ cardId, totalTaken, winPot }) => {
            setGame(prev => {
                const tc = { ...prev.takenCards };
                delete tc[cardId];
                return { ...prev, totalTaken, winPot, takenCards: tc };
            });
        });

        // Game started
        socket.on('gameStarted', ({ takenCards, playerCount, winPot }) => {
            setGame(prev => ({
                ...prev,
                phase: 'playing',
                takenCards,
                playerCount,
                winPot,
            }));
        });

        // Number called
        socket.on('numberCalled', ({ number, calledNumbers, callCount }) => {
            setGame(prev => ({ ...prev, calledNumbers, latestNumber: number }));
        });

        // Card suspended (false bingo)
        socket.on('cardSuspended', ({ cardId }) => {
            setGame(prev => ({
                ...prev,
                suspendedCards: [...prev.suspendedCards, cardId],
            }));
        });

        // Game over
        socket.on('gameOver', (data) => {
            setGame(prev => ({ ...prev, phase: 'ended', winners: data.winners, winPot: data.totalPot }));
        });

        // Stake update
        socket.on('stakeUpdated', ({ stake }) => {
            mergeGame({ stake });
        });

        // Game reset → go back to lobby
        socket.on('gameReset', () => {
            setGame(prev => ({ ...createInitialState(), balance: prev.balance }));
            setConnected(true);
            // Re-join after reset
            socket.emit('join', userRef.current);
        });

        return () => { socket.disconnect(); };
    }, []);

    // Take a card (from Board Selection Page)
    const takeCard = (cardId, cb) => {
        socket.emit('takeCard', { cardId }, (result) => {
            if (result?.ok) {
                setGame(prev => ({
                    ...prev,
                    balance: result.balance,
                    bonusBalance: result.bonusBalance,
                    winPot: result.winPot,
                    totalTaken: result.totalTaken,
                    myCards: [...prev.myCards, cardId],
                    myMarks: { ...prev.myMarks, [cardId]: new Set() },
                }));
            }
            cb?.(result);
        });
    };

    const cancelCard = (cardId, cb) => {
        socket.emit('cancelCard', { cardId }, (result) => {
            if (result?.ok) {
                setGame(prev => ({
                    ...prev,
                    balance: result.balance,
                    bonusBalance: result.bonusBalance,
                    winPot: result.winPot,
                    totalTaken: result.totalTaken,
                    myCards: prev.myCards.filter(id => id !== cardId),
                    myMarks: (() => { const m = { ...prev.myMarks }; delete m[cardId]; return m; })(),
                }));
            }
            cb?.(result);
        });
    };

    const markNumber = (cardId, number) => {
        socket.emit('markNumber', { cardId, number });
        setGame(prev => {
            const marks = { ...prev.myMarks };
            const cardSet = new Set(marks[cardId] || []);
            if (cardSet.has(number)) cardSet.delete(number); else cardSet.add(number);
            marks[cardId] = cardSet;
            return { ...prev, myMarks: marks };
        });
    };

    const claimBingo = (cardId, cb) => {
        socket.emit('claimBingo', { cardId }, (result) => {
            cb?.(result);
        });
    };

    const isSpectator = game.phase !== 'lobby' && game.myCards.length === 0;

    if (game.maintenanceMode) {
        return (
            <div className="maintenance-screen">
                <img src="/logo.png" alt="Ras Bingo" className="logo-pulse" />
                <div className="maintenance-text">The system is under maintenance</div>
            </div>
        );
    }

    if (!connected || !minLoadingDone) {
        return (
            <div className="loading-screen">
                <img src="/logo.png" alt="Ras Bingo" className="logo-pulse" />
                <div className="loading-bar-container">
                    <div className="loading-bar-fill"></div>
                </div>
            </div>
        );
    }

    // Show board selection during lobby, game page otherwise
    if (game.phase === 'lobby') {
        return (
            <BoardSelectionPage
                game={game}
                user={userRef.current}
                connected={connected}
                onTakeCard={takeCard}
                onCancelCard={cancelCard}
            />
        );
    }

    return (
        <GamePlayPage
            game={game}
            user={userRef.current}
            connected={connected}
            isSpectator={isSpectator}
            onMarkNumber={markNumber}
            onClaimBingo={claimBingo}
            socket={socket}
        />
    );
}
