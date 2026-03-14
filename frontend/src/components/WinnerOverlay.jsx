import { useState, useEffect } from 'react';

/**
 * WinnerOverlay
 * Displayed after the game ends. Blurs the game page and shows all winners
 * with their name, masked phone, winning card preview, prize, and a countdown.
 *
 * Props:
 *   winners  — array of winner objects from gameOver event
 *   totalPot — total prize pool
 *   onDone   — called when countdown reaches 0
 */
export default function WinnerOverlay({ winners, totalPot, onDone }) {
    const [countdown, setCountdown] = useState(7);

    useEffect(() => {
        const t = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { clearInterval(t); onDone?.(); return 0; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [onDone]);

    return (
        <div className={`winner-overlay${winners.length === 1 ? ' single-winner' : ''}`}>
            <div className="winner-overlay-inner">
                {/* Trophy header */}
                <div className="winner-overlay-header">
                    <span className="winner-trophy">🏆</span>
                    <h2 className="winner-title">
                        {winners.length === 1 ? 'WINNER!' : `${winners.length} WINNERS!`}
                    </h2>
                </div>

                {/* Winner cards */}
                <div className="winner-list">
                    {winners.map((w, idx) => (
                        <WinnerCard key={idx} winner={w} />
                    ))}
                </div>

                {/* Footer: countdown */}
                <div className="winner-overlay-footer">
                    <div className="countdown-label">Next game in</div>
                    <div className="countdown-number">{countdown}</div>
                    <div className="countdown-bar-track">
                        <div
                            className="countdown-bar-fill"
                            style={{ width: `${(countdown / 7) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function WinnerCard({ winner }) {
    const { displayName, maskedPhone, card, winningLines, calledNumbers, prize, cardId } = winner;

    const calledSet = new Set(calledNumbers);
    const winSet = new Set();
    (winningLines || []).forEach(line => {
        line.forEach(({ row, col }) => winSet.add(row * 5 + col));
    });

    const getColumnClass = (n) => {
        if (n === null) return 'free';
        if (n <= 15) return 'col-B';
        if (n <= 30) return 'col-I';
        if (n <= 45) return 'col-N';
        if (n <= 60) return 'col-G';
        return 'col-O';
    };

    return (
        <div className="winner-card-block">
            {/* Winner identity */}
            <div className="winner-identity">
                <span className="winner-name">{displayName}</span>
                {maskedPhone && (
                    <span className="winner-phone">{maskedPhone}</span>
                )}
                <span className="winner-prize">+{prize} ETB</span>
            </div>

            {/* Card number */}
            <div className="winner-card-number">Card #{cardId}</div>

            {/* Mini card preview */}
            <div className="winner-card-preview">
                <div className="wcp-header">
                    {['B', 'I', 'N', 'G', 'O'].map(h => (
                        <div key={h} className={`wcp-header-cell wcp-${h}`}>{h}</div>
                    ))}
                </div>
                <div className="wcp-body">
                    {card?.grid?.map((row, rIdx) =>
                        row.map((val, cIdx) => {
                            const cellKey = rIdx * 5 + cIdx;
                            const isFree = val === null;
                            const isCalled = isFree || calledSet.has(val);
                            const isWinning = winSet.has(cellKey);
                            return (
                                <div
                                    key={cellKey}
                                    className={[
                                        'wcp-cell',
                                        isFree ? 'wcp-free' : '',
                                        isWinning ? 'wcp-winning' : isCalled ? `wcp-called ${getColumnClass(val)}` : 'wcp-uncalled',
                                    ].join(' ')}
                                >
                                    {isFree ? '★' : val}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
