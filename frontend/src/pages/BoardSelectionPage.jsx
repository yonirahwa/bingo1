import { useState, useCallback } from 'react';
import BingoCard from '../components/BingoCard';

// STAKE and PRIZE_PER_CARD are now dynamic (passed via the game prop)

function Toast({ msg }) {
    if (!msg) return null;
    return <div className="toast">{msg}</div>;
}

export default function BoardSelectionPage({ game, user, connected, onTakeCard, onCancelCard }) {
    const [toast, setToast] = useState('');
    const [pendingIds, setPendingIds] = useState(new Set());

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2600);
    };

    const handleCellClick = (cardId) => {
        // If already mine — remove it (get back money)
        if (game.myCards.includes(cardId)) {
            handleRemoveCard(cardId);
            return;
        }

        // Taken by another player
        if (game.takenCards[cardId]) {
            showToast('🚫 Card already taken');
            return;
        }

        // Max cards (check both confirmed and pending)
        const totalSelected = game.myCards.length + pendingIds.size;
        if (totalSelected >= 2) {
            showToast('⚠️ You can only take 2 cards');
            return;
        }

        // Optimistic check
        if (pendingIds.has(cardId)) return;

        // Check balance (Main + Bonus)
        const totalBalance = (game.balance || 0) + (game.bonusBalance || 0);
        if (totalBalance < game.stake) {
            showToast(`❌ Not enough balance`);
            return;
        }

        // Optimistic update
        setPendingIds(prev => new Set(prev).add(cardId));

        // Direct take
        onTakeCard(cardId, (result) => {
            // Remove from pending once server responds
            setPendingIds(prev => {
                const next = new Set(prev);
                next.delete(cardId);
                return next;
            });

            if (!result?.ok) {
                showToast(`❌ ${result?.error || 'Failed'}`);
            } else {
                showToast();
            }
        });
    };


    const handleRemoveCard = (cardId) => {
        onCancelCard(cardId, (result) => {
            if (!result?.ok) showToast(`❌ ${result?.error || 'Failed'}`);
            else showToast();
        });
    };

    const winPot = game.winPot;
    const timerWarn = game.timer <= 10;

    return (
        <div className="page">
            {/* PAGE TITLE */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800 }}>🎱 Ras Bingo</h1>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span className={`conn-dot${connected ? '' : ' off'}`} />
                    {connected ? 'Connected' : 'Connecting…'}
                </span>
            </div>

            {/* HEADER BAR */}
            <div className="header-bar">
                <div className="header-cell">
                    <span className="label">Balance</span>
                    <span className="value">{((game.balance || 0) + (game.bonusBalance || 0)).toLocaleString()}</span>
                    <span className="unit">ETB</span>
                </div>
                <div className="header-cell">
                    <span className="label">Stake</span>
                    <span className="value">{game.stake}</span>
                    <span className="unit">ETB</span>
                </div>
                <div className="header-cell">
                    <span className="label">Board</span>
                    <span className="value">{game.totalTaken}/400</span>
                </div>
                <div className="header-cell">
                    <span className="label">Timer</span>
                    <span className={`value${timerWarn ? ' timer-warn' : ''}`}>
                        {game.timer === 'WAITING' ? 'WAITING' : `${Math.floor(game.timer / 60)}:${String(game.timer % 60).padStart(2, '0')}`}
                    </span>
                </div>
                <div className="header-cell">
                    <span className="label">Winner</span>
                    <span className="value win-pot">{winPot.toLocaleString()}</span>
                    <span className="unit">ETB</span>
                </div>
            </div>

            {/* SUB LABEL */}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, flexShrink: 0, textAlign: 'center' }}>
                Select Your Cards — {game.myCards.length}/2 selected
            </p>

            {/* 400-CARD GRID */}
            <div className="board-grid-wrapper">
                <div className="board-grid">
                    {Array.from({ length: 400 }, (_, i) => {
                        const cid = i + 1;
                        const isMine = game.myCards.includes(cid);
                        const isPending = pendingIds.has(cid);
                        const isTaken = !isMine && !isPending && !!game.takenCards[cid];

                        let cls = 'board-cell';
                        if (isMine || isPending) cls += ' mine';
                        if (isTaken) cls += ' taken';
                        return (
                            <button
                                key={cid}
                                className={cls}
                                onClick={() => handleCellClick(cid)}
                                disabled={isTaken || isPending}
                            >
                                {cid}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* SELECTED CARDS PANEL (bottom) */}
            <div className="selected-panel">
                {game.myCards.length === 0 ? (
                    <div className="selected-panel-label">No cards selected</div>
                ) : (
                    <>
                        <div className="selected-panel-label">Your selected cards</div>
                        <div className="selected-cards-row">
                            {game.myCards.map(cardId => {
                                const card = game.cards[cardId - 1];
                                return (
                                    <div key={cardId} className="selected-card-item">
                                        <div className="card-label">Card #{cardId}</div>
                                        <button className="remove-btn" onClick={() => handleRemoveCard(cardId)}>✕</button>
                                        {card && (
                                            <BingoCard card={card} compact />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>


            <Toast msg={toast} />
        </div>
    );
}
