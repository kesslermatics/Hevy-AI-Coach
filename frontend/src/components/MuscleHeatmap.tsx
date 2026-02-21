/**
 * Visual Muscle Recovery Heatmap 🔴🟡🟢
 *
 * Renders a front + back body SVG with muscle groups colored by recovery %.
 * 0% = red (just trained), 50% = yellow (recovering), 100% = green (ready).
 */

interface MuscleHeatmapProps {
    recovery: Record<string, number>;
}

function getColor(pct: number): string {
    const p = Math.max(0, Math.min(100, pct));
    if (p <= 50) {
        // Red (0%) → Yellow (50%)
        const r = 239;
        const g = Math.round(68 + (p / 50) * (188 - 68));
        const b = Math.round(68 + (p / 50) * (0 - 68));
        return `rgb(${r}, ${g}, ${b})`;
    }
    // Yellow (50%) → Green (100%)
    const r = Math.round(239 - ((p - 50) / 50) * (239 - 34));
    const g = Math.round(188 + ((p - 50) / 50) * (197 - 188));
    const b = Math.round(0 + ((p - 50) / 50) * (94 - 0));
    return `rgb(${r}, ${g}, ${b})`;
}

function getLabel(pct: number): string {
    if (pct <= 20) return 'Destroyed';
    if (pct <= 40) return 'Sore';
    if (pct <= 60) return 'Recovering';
    if (pct <= 80) return 'Almost Ready';
    return 'Ready';
}

export default function MuscleHeatmap({ recovery }: MuscleHeatmapProps) {
    const muscles = [
        { key: 'chest', label: 'Chest' },
        { key: 'back', label: 'Back' },
        { key: 'shoulders', label: 'Shoulders' },
        { key: 'biceps', label: 'Biceps' },
        { key: 'triceps', label: 'Triceps' },
        { key: 'forearms', label: 'Forearms' },
        { key: 'abs', label: 'Abs' },
        { key: 'quads', label: 'Quads' },
        { key: 'hamstrings', label: 'Hamstrings' },
        { key: 'glutes', label: 'Glutes' },
        { key: 'calves', label: 'Calves' },
    ];

    const get = (key: string) => recovery[key] ?? 100;

    return (
        <div className="space-y-4">
            {/* Body SVGs */}
            <div className="flex items-start justify-center gap-6">
                {/* Front view */}
                <div className="text-center">
                    <p className="text-[10px] text-dark-300 uppercase tracking-wider mb-2">Front</p>
                    <svg viewBox="0 0 200 400" className="w-28 h-auto">
                        {/* Body outline */}
                        <g opacity="0.15" stroke="#666" strokeWidth="1" fill="none">
                            {/* Head */}
                            <ellipse cx="100" cy="35" rx="22" ry="28" />
                            {/* Neck */}
                            <rect x="90" y="60" width="20" height="15" rx="4" />
                        </g>

                        {/* Shoulders (front) */}
                        <ellipse cx="58" cy="95" rx="18" ry="14" fill={getColor(get('shoulders'))} opacity="0.85" rx-name="shoulders-l" />
                        <ellipse cx="142" cy="95" rx="18" ry="14" fill={getColor(get('shoulders'))} opacity="0.85" />

                        {/* Chest */}
                        <path d="M68 85 Q100 78 132 85 L130 120 Q100 130 70 120 Z"
                            fill={getColor(get('chest'))} opacity="0.85" />

                        {/* Abs */}
                        <rect x="80" y="125" width="40" height="55" rx="8" fill={getColor(get('abs'))} opacity="0.85" />

                        {/* Biceps */}
                        <ellipse cx="48" cy="135" rx="12" ry="25" fill={getColor(get('biceps'))} opacity="0.85" />
                        <ellipse cx="152" cy="135" rx="12" ry="25" fill={getColor(get('biceps'))} opacity="0.85" />

                        {/* Forearms */}
                        <ellipse cx="42" cy="185" rx="10" ry="22" fill={getColor(get('forearms'))} opacity="0.85" />
                        <ellipse cx="158" cy="185" rx="10" ry="22" fill={getColor(get('forearms'))} opacity="0.85" />

                        {/* Quads */}
                        <ellipse cx="82" cy="230" rx="18" ry="40" fill={getColor(get('quads'))} opacity="0.85" />
                        <ellipse cx="118" cy="230" rx="18" ry="40" fill={getColor(get('quads'))} opacity="0.85" />

                        {/* Calves (front) */}
                        <ellipse cx="80" cy="320" rx="12" ry="35" fill={getColor(get('calves'))} opacity="0.85" />
                        <ellipse cx="120" cy="320" rx="12" ry="35" fill={getColor(get('calves'))} opacity="0.85" />

                        {/* Subtle body outline overlay */}
                        <g opacity="0.3" stroke="#888" strokeWidth="0.75" fill="none">
                            <ellipse cx="100" cy="35" rx="22" ry="28" />
                            <line x1="90" y1="63" x2="90" y2="75" />
                            <line x1="110" y1="63" x2="110" y2="75" />
                            <path d="M68 85 Q100 78 132 85" />
                            <line x1="65" y1="182" x2="65" y2="275" strokeWidth="0.5" />
                            <line x1="135" y1="182" x2="135" y2="275" strokeWidth="0.5" />
                        </g>
                    </svg>
                </div>

                {/* Back view */}
                <div className="text-center">
                    <p className="text-[10px] text-dark-300 uppercase tracking-wider mb-2">Back</p>
                    <svg viewBox="0 0 200 400" className="w-28 h-auto">
                        {/* Body outline */}
                        <g opacity="0.15" stroke="#666" strokeWidth="1" fill="none">
                            <ellipse cx="100" cy="35" rx="22" ry="28" />
                            <rect x="90" y="60" width="20" height="15" rx="4" />
                        </g>

                        {/* Shoulders (back) */}
                        <ellipse cx="58" cy="95" rx="18" ry="14" fill={getColor(get('shoulders'))} opacity="0.85" />
                        <ellipse cx="142" cy="95" rx="18" ry="14" fill={getColor(get('shoulders'))} opacity="0.85" />

                        {/* Back (upper + lower) */}
                        <path d="M68 85 Q100 78 132 85 L128 175 Q100 185 72 175 Z"
                            fill={getColor(get('back'))} opacity="0.85" />

                        {/* Triceps */}
                        <ellipse cx="48" cy="135" rx="12" ry="25" fill={getColor(get('triceps'))} opacity="0.85" />
                        <ellipse cx="152" cy="135" rx="12" ry="25" fill={getColor(get('triceps'))} opacity="0.85" />

                        {/* Forearms (back) */}
                        <ellipse cx="42" cy="185" rx="10" ry="22" fill={getColor(get('forearms'))} opacity="0.85" />
                        <ellipse cx="158" cy="185" rx="10" ry="22" fill={getColor(get('forearms'))} opacity="0.85" />

                        {/* Glutes */}
                        <ellipse cx="85" cy="195" rx="18" ry="16" fill={getColor(get('glutes'))} opacity="0.85" />
                        <ellipse cx="115" cy="195" rx="18" ry="16" fill={getColor(get('glutes'))} opacity="0.85" />

                        {/* Hamstrings */}
                        <ellipse cx="82" cy="245" rx="17" ry="35" fill={getColor(get('hamstrings'))} opacity="0.85" />
                        <ellipse cx="118" cy="245" rx="17" ry="35" fill={getColor(get('hamstrings'))} opacity="0.85" />

                        {/* Calves (back) */}
                        <ellipse cx="80" cy="320" rx="12" ry="35" fill={getColor(get('calves'))} opacity="0.85" />
                        <ellipse cx="120" cy="320" rx="12" ry="35" fill={getColor(get('calves'))} opacity="0.85" />

                        {/* Subtle outline */}
                        <g opacity="0.3" stroke="#888" strokeWidth="0.75" fill="none">
                            <ellipse cx="100" cy="35" rx="22" ry="28" />
                            <line x1="90" y1="63" x2="90" y2="75" />
                            <line x1="110" y1="63" x2="110" y2="75" />
                        </g>
                    </svg>
                </div>
            </div>

            {/* Legend bars */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                {muscles.map(({ key, label }) => {
                    const pct = get(key);
                    return (
                        <div key={key} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: getColor(pct) }} />
                            <span className="text-[11px] text-cream-200 flex-1 truncate">{label}</span>
                            <span className="text-[10px] font-mono tabular-nums" style={{ color: getColor(pct) }}>
                                {pct}%
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Color scale legend */}
            <div className="flex items-center justify-center gap-3 pt-1">
                {[0, 25, 50, 75, 100].map(v => (
                    <div key={v} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: getColor(v) }} />
                        <span className="text-[9px] text-dark-400">{getLabel(v)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
