import { useEffect, useState } from 'react';
import {
    getProgressiveOverload, getMacroPerformance, getStreaks,
} from '../api/api';
import type { ExerciseProgress, MacroPerformanceData, StreaksData } from '../api/api';
import {
    Loader2, TrendingUp, TrendingDown, Minus, Flame, Beef, Wheat,
    ChevronDown, ChevronUp, Dumbbell, Zap, BarChart3, Brain, Filter,
} from 'lucide-react';
import { useLanguage } from '../i18n';

/* ── All distinct muscle groups for the filter ─────── */
const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
    'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms',
];

export default function ProgressTab() {
    const { t, lang } = useLanguage();

    const [exercises, setExercises] = useState<ExerciseProgress[]>([]);
    const [macro, setMacro] = useState<MacroPerformanceData | null>(null);
    const [streaks, setStreaks] = useState<StreaksData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'change' | 'e1rm' | 'sessions'>('change');
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [ex, mp, st] = await Promise.all([
                    getProgressiveOverload(),
                    getMacroPerformance(),
                    getStreaks(),
                ]);
                setExercises(ex);
                setMacro(mp);
                setStreaks(st);
            } catch (e: any) {
                setError(e.message || 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filtered = exercises
        .filter(e => !muscleFilter || e.muscle_group === muscleFilter)
        .sort((a, b) => {
            if (sortBy === 'change') return Math.abs(b.change_percent) - Math.abs(a.change_percent);
            if (sortBy === 'e1rm') return b.peak_e1rm - a.peak_e1rm;
            return b.sessions_count - a.sessions_count;
        });

    const availableGroups = [...new Set(exercises.map(e => e.muscle_group))].filter(Boolean);

    if (loading) return (
        <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto" />
            <p className="text-dark-300 text-sm">Loading progress data…</p>
        </div>
    );

    if (error) return (
        <div className="max-w-2xl mx-auto py-16 text-center">
            <p className="text-red-400 text-sm">{error}</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Page title */}
            <div>
                <h1 className="text-2xl font-bold text-cream-50 flex items-center gap-2.5">
                    <TrendingUp className="w-6 h-6 text-indigo-400" />
                    {t('progress.title')}
                </h1>
                <p className="text-dark-300 text-sm mt-1">{t('progress.subtitle')}</p>
            </div>

            {/* ─── Streaks Row ─────────────────────────── */}
            {streaks && (
                <div className="grid grid-cols-3 gap-3">
                    <StreakCard
                        label={t('streaks.training')}
                        icon={<Dumbbell size={14} />}
                        current={streaks.training.current_streak}
                        longest={streaks.training.longest_streak}
                        color="text-blue-400"
                        bg="bg-blue-500/10 border-blue-500/20"
                    />
                    <StreakCard
                        label={t('streaks.nutrition')}
                        icon={<Flame size={14} />}
                        current={streaks.nutrition.current_streak}
                        longest={streaks.nutrition.longest_streak}
                        color="text-amber-400"
                        bg="bg-amber-500/10 border-amber-500/20"
                    />
                    <StreakCard
                        label={t('streaks.combined')}
                        icon={<Zap size={14} />}
                        current={streaks.combined.current_streak}
                        longest={streaks.combined.longest_streak}
                        color="text-emerald-400"
                        bg="bg-emerald-500/10 border-emerald-500/20"
                    />
                </div>
            )}

            {/* ─── Macro-Performance Insights ──────────── */}
            {macro && macro.has_enough_data && macro.insights.length > 0 && (
                <div className="card-glass p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-purple-500/10 border-purple-500/30 text-purple-400">
                            <Brain className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-cream-50">{t('macro.title')}</h2>
                            <p className="text-xs text-dark-300">
                                {t('macro.workoutsAnalyzed').replace('{n}', String(macro.total_correlated_workouts))}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {macro.insights.map((ins, i) => (
                            <div key={i} className="bg-dark-700/40 rounded-lg p-3 flex items-start gap-3 border border-dark-500/20">
                                <div className="mt-0.5">
                                    {ins.type.includes('calorie') ? <Flame size={14} className="text-orange-400" /> :
                                        ins.type.includes('protein') ? <Beef size={14} className="text-red-400" /> :
                                            <Wheat size={14} className="text-yellow-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-cream-200 text-xs leading-relaxed">
                                        {lang === 'de' ? ins.message_de : ins.message_en}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {ins.diff_percent > 0
                                            ? <TrendingUp size={10} className="text-green-400" />
                                            : <TrendingDown size={10} className="text-red-400" />}
                                        <span className={`text-[10px] font-medium ${ins.diff_percent > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {ins.diff_percent > 0 ? '+' : ''}{ins.diff_percent.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Exercise Filter + Sort ──────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-dark-700/50 rounded-lg p-1 border border-dark-500/20">
                    <Filter size={12} className="text-dark-400 ml-2" />
                    <button
                        onClick={() => setMuscleFilter(null)}
                        className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer ${!muscleFilter ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-dark-300 hover:text-cream-100'}`}
                    >
                        {lang === 'de' ? 'Alle' : 'All'}
                    </button>
                    {availableGroups.sort().map(g => (
                        <button key={g}
                            onClick={() => setMuscleFilter(g === muscleFilter ? null : g)}
                            className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer ${muscleFilter === g ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-dark-300 hover:text-cream-100'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 bg-dark-700/50 rounded-lg p-1 border border-dark-500/20 ml-auto">
                    <BarChart3 size={12} className="text-dark-400 ml-2" />
                    {[
                        { key: 'change' as const, label: lang === 'de' ? 'Veränd.' : 'Change' },
                        { key: 'e1rm' as const, label: 'e1RM' },
                        { key: 'sessions' as const, label: 'Sessions' },
                    ].map(s => (
                        <button key={s.key}
                            onClick={() => setSortBy(s.key)}
                            className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer ${sortBy === s.key ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-dark-300 hover:text-cream-100'}`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Exercise Cards ──────────────────────── */}
            {filtered.length === 0 ? (
                <div className="card-glass p-8 text-center">
                    <p className="text-dark-300 text-sm">{t('progress.noData')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ex => (
                        <ExerciseProgressCard
                            key={ex.name}
                            exercise={ex}
                            isExpanded={expandedExercise === ex.name}
                            onToggle={() => setExpandedExercise(expandedExercise === ex.name ? null : ex.name)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Streak Mini Card ─────────────────────────────────── */
function StreakCard({ label, icon, current, longest, color, bg }: {
    label: string; icon: React.ReactNode; current: number; longest: number;
    color: string; bg: string;
}) {
    const { t } = useLanguage();
    return (
        <div className={`rounded-xl border p-3.5 ${bg}`}>
            <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
                {icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${color}`}>{current}</span>
                <span className="text-[10px] text-dark-300">{t('streaks.weeks')}</span>
            </div>
            <p className="text-[10px] text-dark-400 mt-1">
                {t('streaks.longest')}: {longest} {t('streaks.weeks')}
            </p>
        </div>
    );
}

/* ── Exercise Progress Card ───────────────────────────── */
function ExerciseProgressCard({ exercise, isExpanded, onToggle }: {
    exercise: ExerciseProgress; isExpanded: boolean; onToggle: () => void;
}) {
    const { t, lang } = useLanguage();
    const changeColor = exercise.change_percent > 5 ? 'text-green-400' :
        exercise.change_percent < -5 ? 'text-red-400' : 'text-dark-300';
    const ChangeIcon = exercise.change_percent > 2 ? TrendingUp :
        exercise.change_percent < -2 ? TrendingDown : Minus;

    return (
        <div className="card-glass overflow-hidden">
            <button onClick={onToggle}
                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-dark-700/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Dumbbell size={14} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0 text-left">
                        <h3 className="text-sm font-medium text-cream-50 truncate">{exercise.name}</h3>
                        <p className="text-[10px] text-dark-400">{exercise.muscle_group} · {t('progress.sessions').replace('{n}', String(exercise.sessions_count))}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {/* Stats preview */}
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-cream-100 font-semibold">{Math.round(exercise.latest_e1rm)} kg</p>
                        <div className={`flex items-center gap-1 justify-end ${changeColor}`}>
                            <ChangeIcon size={10} />
                            <span className="text-[10px] font-medium">
                                {exercise.change_percent > 0 ? '+' : ''}{exercise.change_percent.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-dark-400" /> : <ChevronDown size={14} className="text-dark-400" />}
                </div>
            </button>

            {isExpanded && exercise.data_points.length > 0 && (
                <div className="px-4 pb-4 space-y-3 border-t border-dark-500/20">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 pt-3">
                        <MiniStat label={t('progress.e1rm')} value={`${Math.round(exercise.latest_e1rm)} kg`} />
                        <MiniStat label={t('progress.peak')} value={`${Math.round(exercise.peak_e1rm)} kg`} />
                        <MiniStat label={t('progress.change')} value={`${exercise.change_percent > 0 ? '+' : ''}${exercise.change_percent.toFixed(1)}%`}
                            color={changeColor} />
                        <MiniStat label={t('progress.volume')} value={`${Math.round(exercise.data_points[exercise.data_points.length - 1].volume)} kg`} />
                    </div>

                    {/* Chart */}
                    <ProgressionChart data={exercise.data_points} />

                    {/* History list */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {[...exercise.data_points].reverse().map((dp, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg hover:bg-dark-700/30">
                                <span className="text-dark-300">
                                    {new Date(dp.date).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-dark-400">{dp.best_set}</span>
                                    <span className="text-cream-100 font-medium">{Math.round(dp.e1rm)} kg</span>
                                    <span className="text-dark-400">{Math.round(dp.volume)} kg vol</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="bg-dark-700/30 rounded-lg p-2 text-center border border-dark-500/15">
            <p className="text-[9px] text-dark-400 uppercase tracking-wider">{label}</p>
            <p className={`text-xs font-bold mt-0.5 ${color || 'text-cream-100'}`}>{value}</p>
        </div>
    );
}

/* ── Progression Chart (SVG) ──────────────────────────── */
function ProgressionChart({ data }: { data: ExerciseProgress['data_points'] }) {
    if (data.length < 2) return null;

    const W = 400;
    const H = 100;
    const PAD_X = 12;
    const PAD_Y = 14;
    const PAD_BOTTOM = 20;
    const chartW = W - PAD_X * 2;
    const chartH = H - PAD_Y - PAD_BOTTOM;

    const e1rms = data.map(d => d.e1rm);
    const min = Math.min(...e1rms) - 2;
    const max = Math.max(...e1rms) + 2;
    const range = max - min || 1;

    const points = data.map((d, i) => ({
        x: PAD_X + (i / (data.length - 1 || 1)) * chartW,
        y: PAD_Y + chartH - ((d.e1rm - min) / range) * chartH,
        val: d.e1rm,
    }));

    // Smooth curve
    const buildPath = (pts: typeof points) => {
        if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
        let p = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) * 0.4;
            const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) * 0.4;
            p += ` C ${cp1x} ${pts[i].y}, ${cp2x} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
        }
        return p;
    };

    const curve = buildPath(points);
    const area = `${curve} L ${points[points.length - 1].x} ${H - PAD_BOTTOM} L ${points[0].x} ${H - PAD_BOTTOM} Z`;

    const isGrowing = data[data.length - 1].e1rm >= data[0].e1rm;
    const color = isGrowing ? '#818CF8' : '#F87171';

    return (
        <div className="bg-dark-600/20 rounded-lg p-2 border border-dark-500/15">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
                <defs>
                    <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.5, 1].map((frac, i) => {
                    const y = PAD_Y + chartH - frac * chartH;
                    const val = min + frac * range;
                    return (
                        <g key={i}>
                            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y}
                                stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={W - PAD_X + 4} y={y + 3} fill="#444" fontSize="7" fontFamily="monospace">
                                {Math.round(val)}
                            </text>
                        </g>
                    );
                })}

                <path d={area} fill="url(#progGrad)" />
                <path d={curve} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

                {/* Dots */}
                {points.map((p, i) => {
                    const isLast = i === points.length - 1;
                    return (
                        <g key={i}>
                            {isLast && <circle cx={p.x} cy={p.y} r={8} fill={`${color}22`} />}
                            <circle cx={p.x} cy={p.y} r={isLast ? 4 : 2.5}
                                fill={isLast ? color : `${color}99`}
                                stroke={isLast ? '#fff' : 'none'} strokeWidth={isLast ? 1.5 : 0} />
                        </g>
                    );
                })}

                {/* First + last labels */}
                <text x={points[0].x} y={points[0].y - 8} fill="#666" fontSize="8" textAnchor="middle" fontFamily="monospace">
                    {Math.round(points[0].val)}
                </text>
                <text x={points[points.length - 1].x} y={points[points.length - 1].y - 8}
                    fill={color} fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    {Math.round(points[points.length - 1].val)}
                </text>
            </svg>
        </div>
    );
}
