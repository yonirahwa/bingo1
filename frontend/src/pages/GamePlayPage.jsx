import { useState, useMemo, useEffect, useRef } from 'react';
import BingoCard from '../components/BingoCard';
import WinnerOverlay from '../components/WinnerOverlay';

// ─── Client-side win detection (mirrors backend winDetector.js) ───────────────
function clientCountWinPatterns(card, calledNumbers) {
    const called = new Set(calledNumbers);
    const marked = new Set();
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const val = card.grid[row][col];
            if (val === null || called.has(val)) marked.add(row * 5 + col);
        }
    }
    let count = 0;
    // rows
    for (let r = 0; r < 5; r++) {
        if ([0, 1, 2, 3, 4].every(c => marked.has(r * 5 + c))) count++;
    }
    // cols
    for (let c = 0; c < 5; c++) {
        if ([0, 1, 2, 3, 4].every(r => marked.has(r * 5 + c))) count++;
    }
    // main diagonal
    if ([0, 1, 2, 3, 4].every(i => marked.has(i * 5 + i))) count++;
    // anti-diagonal
    if ([0, 1, 2, 3, 4].every(i => marked.has(i * 5 + (4 - i)))) count++;
    // 4 corners
    if ([0, 4, 20, 24].every(i => marked.has(i))) count++;
    // center cross
    if ([7, 11, 12, 13, 17].every(i => marked.has(i))) count++;
    return count;
}
// ─────────────────────────────────────────────────────────────────────────────

// Determine BINGO column color/class
function getVTClass(n, isCalled) {
    if (!isCalled) return '';
    if (n <= 15) return 'called-B';
    if (n <= 30) return 'called-I';
    if (n <= 45) return 'called-N';
    if (n <= 60) return 'called-G';
    return 'called-O';
}

function VerticalTracker({ calledNumbers }) {
    const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);

    // 5 columns (B I N G O) x 15 rows
    const columns = [
        Array.from({ length: 15 }, (_, i) => i + 1),  // B
        Array.from({ length: 15 }, (_, i) => i + 16), // I
        Array.from({ length: 15 }, (_, i) => i + 31), // N
        Array.from({ length: 15 }, (_, i) => i + 46), // G
        Array.from({ length: 15 }, (_, i) => i + 61), // O
    ];

    return (
        <div className="vertical-tracker">
            <div className="vt-header-row">
                {['B', 'I', 'N', 'G', 'O'].map(h => <div key={h} className={`vt-header vth-${h}`}>{h}</div>)}
            </div>
            <div className="vt-body">
                {/* Render by row: row 0 col 0, row 0 col 1... */}
                {Array.from({ length: 15 }).map((_, rowIdx) => (
                    columns.map((col, colIdx) => {
                        const num = col[rowIdx];
                        const isCalled = called.has(num);
                        return (
                            <div key={num} className={`vt-cell ${getVTClass(num, isCalled)}`}>
                                {num}
                            </div>
                        );
                    })
                ))}
            </div>
        </div>
    );
}

function BallList({ calledNumbers, latestNumber }) {
    const recent = calledNumbers.slice(-4);
    // Separate previous balls from the latest ball
    const prevBalls = recent.filter(n => n !== latestNumber).slice(-3);

    const getColorClass = (n) => {
        if (n <= 15) return 'color-B';
        if (n <= 30) return 'color-I';
        if (n <= 45) return 'color-N';
        if (n <= 60) return 'color-G';
        return 'color-O';
    };

    const formatBall = n => {
        const l = n <= 15 ? 'B' : n <= 30 ? 'I' : n <= 45 ? 'N' : n <= 60 ? 'G' : 'O';
        return l + n;
    };

    return (
        <div className="recent-balls-section">
            <div className="last-called-label">LAST CALLED</div>
            <div className="balls-display-row">
                <div className="prev-balls">
                    {prevBalls.map((n, i) => (
                        <div key={i} className={`prev-ball ${getColorClass(n)}`}>
                            {formatBall(n)}
                        </div>
                    ))}
                </div>
                {latestNumber ? (
                    <div className={`latest-ball ${getColorClass(latestNumber)}`}>
                        {formatBall(latestNumber)}
                    </div>
                ) : (
                    <div className="latest-ball empty"></div>
                )}
            </div>
        </div>
    );
}

export default function GamePlayPage({
    game, user, connected, isSpectator, onMarkNumber, onClaimBingo, socket
}) {
    const [toast, setToast] = useState('');
    const [claimedCards, setClaimedCards] = useState(new Set());
    const [winnerData, setWinnerData] = useState(null);
    const [autoMode, setAutoMode] = useState(() => {
        return localStorage.getItem('bingo_auto_mode') === 'true';
    });
    const [soundEnabled, setSoundEnabled] = useState(() => {
        return localStorage.getItem('bingo_sound_enabled') !== 'false';
    });

    useEffect(() => {
        localStorage.setItem('bingo_auto_mode', autoMode);
        if (socket && connected) {
            socket.emit('setAutoMode', { enabled: autoMode });
        }
    }, [autoMode, socket, connected]);

    useEffect(() => {
        localStorage.setItem('bingo_sound_enabled', soundEnabled);
    }, [soundEnabled]);

    // Audio cache to reuse Audio objects and avoid autoplay blocks
    const audioCacheRef = useRef({});
    const endAudioRef = useRef(null);
    // Ref mirror of soundEnabled so that socket listeners always get the latest value
    const soundEnabledRef = useRef(soundEnabled);
    useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

    // Helper to play sound
    const playSound = (filename) => {
        if (!soundEnabled) return;
        let audio = audioCacheRef.current[filename];
        if (!audio) {
            audio = new Audio(`/sounds/${filename}`);
            audioCacheRef.current[filename] = audio;
        }
        audio.currentTime = 0;
        
        // Browsers require a promise catch to handle play() rejections
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.warn(`Audio play blocked for ${filename}:`, e));
        }
    };

    // Effect to instantly mute any currently playing sounds when toggled off
    useEffect(() => {
        if (!soundEnabled) {
            // Pause all programmatically fired number audios
            Object.values(audioCacheRef.current).forEach(audio => {
                if (audio && !audio.paused) {
                    audio.pause();
                }
            });
            // Pause the HTML5 end audio element
            if (endAudioRef.current && !endAudioRef.current.paused) {
                endAudioRef.current.pause();
            }
        }
    }, [soundEnabled]);

    // Preload important sounds and attempt to unlock audio context on mount/toggle
    useEffect(() => {
        if (soundEnabled) {
            const endAudio = new Audio(`/sounds/End.mp3`);
            endAudio.preload = 'auto';
            audioCacheRef.current['End.mp3'] = endAudio;
            
            // "Unlock" audio context trick: Play a silent/paused audio on explicit user interaction
            endAudio.play().then(() => {
                endAudio.pause();
                endAudio.currentTime = 0;
            }).catch(() => {
                // Ignore, means it requires explicit click first
            });
        }
    }, [soundEnabled]);

    // Track the last length of calledNumbers we processed for auto-mark
    const prevCalledLengthRef = useRef(0);
    const prevLatestNumberRef = useRef(game.latestNumber);

    // Play sound on new number called
    useEffect(() => {
        if (game.latestNumber !== prevLatestNumberRef.current) {
            if (game.latestNumber) playSound(`${game.latestNumber}.mp3`);
            prevLatestNumberRef.current = game.latestNumber;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.latestNumber, soundEnabled]);

    // Listen for gameOver/gameReset to show/hide winner overlay
    useEffect(() => {
        if (!socket) return;
        const handleGameOver = (payload) => {
            setWinnerData(payload);
            // End.mp3 is played in handleBingo when claim is confirmed,
            // so we don't play it again here to avoid double playback.
        };
        const handleGameReset = () => {
            setWinnerData(null);
            setClaimedCards(new Set());
            prevCalledLengthRef.current = 0;
            prevLatestNumberRef.current = null;
        };
        socket.on('gameOver', handleGameOver);
        socket.on('gameReset', handleGameReset);
        return () => {
            socket.off('gameOver', handleGameOver);
            socket.off('gameReset', handleGameReset);
        };
    }, [socket]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2800);
    };

    const handleBingo = (cardId) => {
        if (claimedCards.has(cardId)) return;
        setClaimedCards(prev => new Set([...prev, cardId]));

        onClaimBingo(cardId, (result) => {
            if (result?.pending) {
                showToast('✅ Bingo Claimed! Waiting for results...');
                // Play End.mp3 after 2s so winning number sound finishes first
                setTimeout(() => {
                    if (soundEnabledRef.current && endAudioRef.current) {
                        endAudioRef.current.currentTime = 0;
                        endAudioRef.current.play().catch(() => {});
                    }
                }, 2000);
            }
            else if (result?.lateBingo) {
                showToast();
            }
            else if (result?.suspended) showToast();
            else {
                showToast(result?.error || 'Error');
                if (!result?.suspended) setClaimedCards(prev => { const s = new Set(prev); s.delete(cardId); return s; });
            }
        });
    };

    // ── Auto-mark: retroactive marking when toggle is turned ON ───────────────
    useEffect(() => {
        if (!autoMode || game.phase !== 'playing') return;
        // Mark all called numbers not yet marked, AND UNMARK uncalled numbers
        game.myCards.forEach(cardId => {
            if (game.suspendedCards.includes(cardId)) return;
            const card = game.cards[cardId - 1];
            if (!card) return;
            const marks = game.myMarks[cardId] || new Set();
            const calledSet = new Set(game.calledNumbers);

            // 1. Mark called numbers
            game.calledNumbers.forEach(num => {
                const isOnCard = card.grid.some(row => row.includes(num));
                if (isOnCard && !marks.has(num)) {
                    onMarkNumber(cardId, num);
                }
            });

            // 2. Unmark uncalled numbers (user might have marked manually while auto was OFF)
            marks.forEach(num => {
                if (!calledSet.has(num)) {
                    // This number was marked but never called -> toggle it OFF
                    onMarkNumber(cardId, num);
                }
            });

            // NOTE: We don't call handleBingo here anymore.
            // We wait for a NEW number to be called that completes a line.
        });
        prevCalledLengthRef.current = game.calledNumbers.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoMode]);

    // ── Auto-mark + auto-bingo: runs when a new number is called ─────────────
    useEffect(() => {
        if (!autoMode || game.phase !== 'playing') {
            prevCalledLengthRef.current = game.calledNumbers.length;
            return;
        }

        const newNumbers = game.calledNumbers.slice(prevCalledLengthRef.current);
        const oldNumbers = game.calledNumbers.slice(0, prevCalledLengthRef.current);
        prevCalledLengthRef.current = game.calledNumbers.length;

        if (newNumbers.length === 0) return;

        game.myCards.forEach(cardId => {
            if (game.suspendedCards.includes(cardId)) return;
            if (claimedCards.has(cardId)) return;
            const card = game.cards[cardId - 1];
            if (!card) return;
            const marks = game.myMarks[cardId] || new Set();

            // Auto-mark newly called numbers
            newNumbers.forEach(num => {
                const isOnCard = card.grid.some(row => row.includes(num));
                if (isOnCard && !marks.has(num)) {
                    onMarkNumber(cardId, num);
                }
            });

            // Auto-bingo check: Only trigger if WIN COUNT INCREASES and is >= 2
            // This ensures we claim on the *current* call and avoid late-bingo suspension
            const oldWinCount = clientCountWinPatterns(card, oldNumbers);
            const newWinCount = clientCountWinPatterns(card, game.calledNumbers);
            
            if (newWinCount >= 2 && newWinCount > oldWinCount) {
                handleBingo(cardId);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.calledNumbers]);

    return (
        <div className={`gameplay-page ${isSpectator ? 'spectator-mode' : ''} ${winnerData ? 'blurred' : ''}`}>
            {/* HIDDEN AUDIO ELEMENT FOR GAME OVER SOUND */}
            <audio ref={endAudioRef} src="/sounds/End.mp3" preload="auto" />

            {/* WINNER OVERLAY */}
            {winnerData && (
                <WinnerOverlay
                    winners={winnerData.winners}
                    totalPot={winnerData.totalPot}
                    onDone={() => setWinnerData(null)}
                />
            )}
            {/* HEADER */}
            <div className="header-bar spectator-header">
                <div className="header-cell">
                    <span className="label">WINNER</span>
                    <span className="value win-pot">{game.winPot} ETB</span>
                </div>
                <div className="header-cell">
                    <span className="label">PLAYERS</span>
                    <span className="value">{game.playerCount}</span>
                </div>
                <div className="header-cell">
                    <span className="label">STAKE</span>
                    <span className="value">{game.stake} ETB</span>
                </div>
                <div className="header-cell">
                    <span className="label">CALL</span>
                    <span className="value">{game.calledNumbers.length}/75</span>
                </div>
                <div className="header-cell" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSoundEnabled(p => !p)}>
                    <span className="label">SOUND</span>
                    <span className="value" style={{ fontSize: '1.2rem' }}>{soundEnabled ? '🔊' : '🔇'}</span>
                </div>
                <div className="header-cell conn-cell">
                    <div className={`conn-dot-wrapper${connected ? ' conn-on' : ' conn-off'}`}>
                        <div className="conn-dot-inner" />
                    </div>
                </div>
            </div>

            <div className="gameplay-content">
                {/* LEFT: VERTICAL TRACKER */}
                <VerticalTracker calledNumbers={game.calledNumbers} />

                {/* RIGHT: BALLS + CARDS */}
                <div className="gameplay-main">
                    <BallList calledNumbers={game.calledNumbers} latestNumber={game.latestNumber} />

                    {!isSpectator && (
                        <>
                            {/* AUTO MARK & BINGO TOGGLE */}
                            <div className="auto-toggle-row">
                                <span className="auto-toggle-label">⚡ Auto Mark &amp; Bingo</span>
                                <button
                                    className={`auto-toggle-btn${autoMode ? ' on' : ''}`}
                                    onClick={() => setAutoMode(v => !v)}
                                    aria-label="Toggle auto mark and bingo"
                                >
                                    <div className="auto-toggle-knob" />
                                </button>
                            </div>

                            <div style={{ paddingBottom: 2 }}>
                                {game.myCards.map(cardId => {
                                    const card = game.cards[cardId - 1];
                                    const suspended = game.suspendedCards.includes(cardId);
                                    const marks = game.myMarks[cardId] || new Set();

                                    return (
                                        <div key={cardId} style={{ position: 'relative', marginBottom: 5 }}>
                                            <div className="player-card-title">Card #{cardId}</div>
                                            <div style={{ position: 'relative' }}>
                                                <BingoCard
                                                    card={card}
                                                    calledNumbers={game.calledNumbers}
                                                    markedNumbers={marks}
                                                    interactive={!suspended && !autoMode}
                                                    onCellClick={(n) => onMarkNumber(cardId, n)}
                                                    suspended={suspended}
                                                />
                                                {!suspended && (
                                                    <div style={{ marginTop: '15px' }}>
                                                        <button
                                                            className="btn-bingo-main"
                                                            onClick={() => handleBingo(cardId)}
                                                            disabled={game.phase === 'ended' || autoMode}
                                                        >
                                                            BINGO!
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {suspended && (
                                                <div className="suspended-badge">SUSPENDED</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {isSpectator && (
                        <div className="spectator-waiting-box">
                            <div className="waiting-line">
                                <span className="waiting-line-dash"></span>
                                <span className="waiting-line-text">
                                    WAIT FOR<br />NEXT GAME
                                </span>
                                <span className="waiting-line-dash"></span>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
