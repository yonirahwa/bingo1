/**
 * BingoCard.jsx
 * Reusable 5×5 BINGO card display.
 *
 * Props:
 *   card        — { id, grid: number[][] } (null center = FREE)
 *   calledNumbers — Set or array of called numbers
 *   markedNumbers — Set of numbers the player has manually marked
 *   winningCells  — array of {row,col} for highlighting win line
 *   onCellClick   — (number) => void (game mode, toggle mark)
 *   interactive   — bool
 *   suspended     — bool
 *   compact       — bool (small size)
 */

const HEADERS = ['B', 'I', 'N', 'G', 'O'];

export default function BingoCard({
    card,
    calledNumbers = [],
    markedNumbers = new Set(),
    winningCells = [],
    onCellClick,
    interactive = false,
    suspended = false,
    compact = false,
}) {
    if (!card) return null;
    const called = new Set(calledNumbers);
    const marked = markedNumbers instanceof Set ? markedNumbers : new Set(markedNumbers);
    const winSet = new Set(winningCells.map(c => `${c.row},${c.col}`));

    const cellScale = {};
    const headerScale = {};

    return (
        <div className={`bingo-card-container${suspended ? ' opacity-50' : ''}${compact ? ' compact' : ''}`}>
            <div className="bingo-card">
                {/* B I N G O header */}
                <div className="bingo-header-row">
                    {HEADERS.map((h, i) => (
                        <div key={h} className={`bingo-header-cell card-header-${i}`}>
                            {h}
                        </div>
                    ))}
                </div>

                {/* 5×5 grid — iterate by row */}
                <div className="bingo-grid-rows">
                    {[0, 1, 2, 3, 4].map(row =>
                        [0, 1, 2, 3, 4].map(col => {
                            const val = card.grid[row][col];
                            const free = val === null;
                            const isWin = winSet.has(`${row},${col}`);
                            const isMarked = !free && marked.has(val);

                            let cls = 'bingo-cell';
                            if (free) cls += ' free';
                            if (isWin) cls += ' win-cell';
                            else if (isMarked) cls += ' marked';

                            return (
                                <div
                                    key={`${row}-${col}`}
                                    className={cls}
                                    onClick={() => {
                                        if (interactive && !free) {
                                            onCellClick?.(val);
                                        }
                                    }}
                                >
                                    {free ? (
                                        <div className="free-star">⭐</div>
                                    ) : val}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
