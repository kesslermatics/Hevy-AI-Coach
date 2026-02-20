import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTodayBriefing, regenerateBriefing } from '../api/api';
import type { UserInfo, Briefing, ExerciseReview } from '../api/api';
import {
    Dumbbell, UtensilsCrossed, Target, RefreshCw, Loader2, Sunrise,
    Flame, Beef, Wheat, Droplets, TrendingUp, TrendingDown, Minus, Sparkles,
    ChevronDown, ChevronUp, Trophy, Crosshair, Star
} from 'lucide-react';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

/* ── CS2 Rank Colors ────────────────────────────────── */
const RANK_COLORS: Record<number, string> = {
    0: '#8C8C8C', 1: '#8C8C8C', 2: '#8C8C8C', 3: '#8C8C8C',        // Silver
    4: '#D4A017', 5: '#D4A017', 6: '#D4A017', 7: '#D4A017',          // Gold Nova
    8: '#3B82F6', 9: '#3B82F6', 10: '#3B82F6',                       // MG
    11: '#8B5CF6', 12: '#A855F7', 13: '#A855F7',                     // DMG/LE
    14: '#EF4444', 15: '#FFD700',                                     // Supreme/Global
};

const RANK_BG: Record<number, string> = {
    0: 'bg-gray-500/10 border-gray-500/30', 1: 'bg-gray-500/10 border-gray-500/30',
    2: 'bg-gray-500/10 border-gray-500/30', 3: 'bg-gray-500/10 border-gray-500/30',
    4: 'bg-yellow-600/10 border-yellow-600/30', 5: 'bg-yellow-600/10 border-yellow-600/30',
    6: 'bg-yellow-600/10 border-yellow-600/30', 7: 'bg-yellow-600/10 border-yellow-600/30',
    8: 'bg-blue-500/10 border-blue-500/30', 9: 'bg-blue-500/10 border-blue-500/30',
    10: 'bg-blue-500/10 border-blue-500/30',
    11: 'bg-purple-500/10 border-purple-500/30', 12: 'bg-purple-500/10 border-purple-500/30',
    13: 'bg-purple-500/10 border-purple-500/30',
    14: 'bg-red-500/10 border-red-500/30', 15: 'bg-yellow-400/10 border-yellow-400/30',
};

export default function Dashboard() {
    const { user } = useOutletContext<LayoutContext>();
    const [briefing, setBriefing] = useState<Briefing | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBriefing = async () => {
        setError(null);
        try {
            const b = await getTodayBriefing();
            setBriefing(b);
        } catch (err: any) {
            setError(err.message || 'Failed to load briefing');
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true); setError(null);
        try {
            const b = await regenerateBriefing();
            setBriefing(b);
        } catch (err: any) {
            setError(err.message || 'Failed to regenerate');
        } finally {
            setRegenerating(false);
        }
    };

    useEffect(() => { fetchBriefing(); }, []);

    const data = briefing?.briefing_data;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Welcome header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cream-50">
                        Good morning, <span className="text-gradient-gold">{user?.username}</span>
                    </h1>
                    <p className="text-dark-300 text-sm mt-1 flex items-center gap-1.5">
                        <Sunrise size={14} />
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {briefing && (
                    <button onClick={handleRegenerate} disabled={regenerating}
                        className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-gold-400 transition-colors cursor-pointer mt-1">
                        <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                        {regenerating ? 'Generating…' : 'Refresh'}
                    </button>
                )}
            </div>

            {/* Loading state */}
            {loading && (
                <div className="card-glass p-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto" />
                    <p className="text-dark-300 text-sm">Generating your morning briefing…</p>
                    <p className="text-dark-400 text-xs">Analyzing workouts & nutrition</p>
                </div>
            )}

            {/* Error state */}
            {error && !loading && (
                <div className="card-glass p-6 text-center space-y-3">
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={fetchBriefing}
                        className="btn-gold text-sm px-6 py-2 mx-auto">
                        Try Again
                    </button>
                </div>
            )}

            {/* Briefing content */}
            {data && !loading && (
                <>
                    {/* ─── Nutrition Review ─────────────────── */}
                    <div className="card-glass p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-amber-500/10 border-amber-500/30 text-amber-400">
                                <UtensilsCrossed className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-cream-50">Nutrition Review</h2>
                                <p className="text-xs text-dark-300">Yesterday's nutrition breakdown</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <MacroCard icon={<Flame className="w-4 h-4" />} label="Calories"
                                text={data.nutrition_review.calories}
                                color="text-orange-400" bg="bg-orange-500/10 border-orange-500/20" />
                            <MacroCard icon={<Beef className="w-4 h-4" />} label="Protein"
                                text={data.nutrition_review.protein}
                                color="text-red-400" bg="bg-red-500/10 border-red-500/20" />
                            <MacroCard icon={<Wheat className="w-4 h-4" />} label="Carbs"
                                text={data.nutrition_review.carbs}
                                color="text-yellow-400" bg="bg-yellow-500/10 border-yellow-500/20" />
                            <MacroCard icon={<Droplets className="w-4 h-4" />} label="Fat"
                                text={data.nutrition_review.fat}
                                color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/20" />
                        </div>
                    </div>

                    {/* ─── Last Session Review ─────────────── */}
                    {data.last_session && (
                        <LastSessionCard session={data.last_session} />
                    )}

                    {/* ─── Next Session ────────────────────── */}
                    {data.next_session && (
                        <NextSessionCard session={data.next_session} />
                    )}

                    {/* ─── Daily Mission ───────────────────── */}
                    <div className="card-glass p-6 border-l-4 border-gold-500">
                        <div className="flex items-center gap-3 mb-3">
                            <Target className="w-5 h-5 text-gold-400" />
                            <h3 className="text-sm font-semibold text-cream-50">Daily Mission</h3>
                        </div>
                        <p className="text-cream-100 text-sm leading-relaxed italic">
                            "{data.daily_mission}"
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   LAST SESSION CARD
   ═══════════════════════════════════════════════════════ */

function LastSessionCard({ session }: { session: NonNullable<Briefing['briefing_data']['last_session']> }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="relative rounded-2xl overflow-hidden border border-dark-500/50">
            {/* Background image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=70&auto=format"
                    alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-dark-900/85 backdrop-blur-sm" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-cream-50">Last Session Review</h2>
                            <p className="text-xs text-dark-300">{session.title} • {session.date}
                                {session.duration_min && ` • ${session.duration_min} min`}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setExpanded(!expanded)}
                        className="text-dark-300 hover:text-cream-100 transition-colors cursor-pointer">
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>

                {/* Overall feedback */}
                <p className="text-cream-200 text-sm leading-relaxed mb-4">{session.overall_feedback}</p>

                {expanded && (
                    <div className="space-y-3">
                        {session.exercises.map((ex, i) => (
                            <ExerciseCard key={i} exercise={ex} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Exercise Card with Rank + Chart ────────────────── */

function ExerciseCard({ exercise }: { exercise: ExerciseReview }) {
    const [showHistory, setShowHistory] = useState(false);
    const rankColor = RANK_COLORS[exercise.rank_index] ?? '#8C8C8C';
    const rankBg = RANK_BG[exercise.rank_index] ?? 'bg-gray-500/10 border-gray-500/30';

    const TrendIcon = exercise.trend === 'up' ? TrendingUp
        : exercise.trend === 'down' ? TrendingDown
        : exercise.trend === 'new' ? Sparkles
        : Minus;

    const trendColor = exercise.trend === 'up' ? 'text-green-400'
        : exercise.trend === 'down' ? 'text-red-400'
        : exercise.trend === 'new' ? 'text-blue-400'
        : 'text-dark-300';

    // Compute max volume for chart scaling
    const historyVolumes = exercise.history.map(h => h.volume_kg);
    const allVolumes = [...historyVolumes, exercise.total_volume_kg];
    const maxVol = Math.max(...allVolumes, 1);

    return (
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-dark-500/40 p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Dumbbell size={14} className="text-dark-300 shrink-0" />
                    <span className="text-sm font-medium text-cream-50 truncate">{exercise.name}</span>
                    <span className="text-xs text-dark-400 shrink-0">{exercise.muscle_group}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <TrendIcon size={14} className={trendColor} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rankBg}`}
                        style={{ color: rankColor }}>
                        {exercise.rank}
                    </span>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-dark-300 mb-2">
                <span>Best: <span className="text-cream-100 font-medium">{exercise.best_set}</span></span>
                <span>Volume: <span className="text-cream-100 font-medium">{Math.round(exercise.total_volume_kg)} kg</span></span>
            </div>

            {/* Rank progress bar */}
            <div className="w-full h-1.5 rounded-full bg-dark-600 overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${((exercise.rank_index + 1) / 16) * 100}%`, backgroundColor: rankColor }} />
            </div>

            {/* Feedback */}
            <p className="text-cream-200 text-xs leading-relaxed mb-2">{exercise.feedback}</p>

            {/* History toggle */}
            {exercise.history.length > 0 && (
                <>
                    <button onClick={() => setShowHistory(!showHistory)}
                        className="text-xs text-gold-400 hover:text-gold-300 transition-colors flex items-center gap-1 cursor-pointer">
                        {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {showHistory ? 'Hide' : 'Show'} progression ({exercise.history.length} sessions)
                    </button>

                    {showHistory && (
                        <div className="mt-3 space-y-1">
                            {/* Mini bar chart */}
                            <div className="flex items-end gap-1 h-16">
                                {exercise.history.map((h, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                        <div className="w-full rounded-t-sm overflow-hidden relative"
                                            style={{ height: `${(h.volume_kg / maxVol) * 100}%`, minHeight: '4px' }}>
                                            <div className="absolute inset-0 bg-purple-500/40 rounded-t-sm" />
                                        </div>
                                    </div>
                                ))}
                                {/* Current session bar (highlighted) */}
                                <div className="flex-1 flex flex-col items-center gap-0.5">
                                    <div className="w-full rounded-t-sm overflow-hidden relative"
                                        style={{ height: `${(exercise.total_volume_kg / maxVol) * 100}%`, minHeight: '4px' }}>
                                        <div className="absolute inset-0 bg-gold-500/60 rounded-t-sm" />
                                    </div>
                                </div>
                            </div>
                            {/* Date labels */}
                            <div className="flex gap-1 text-center">
                                {exercise.history.map((h, i) => (
                                    <div key={i} className="flex-1 text-[9px] text-dark-400 truncate">
                                        {h.date.slice(5)}
                                    </div>
                                ))}
                                <div className="flex-1 text-[9px] text-gold-400 font-bold">Now</div>
                            </div>
                            {/* Detail list */}
                            <div className="mt-2 space-y-1">
                                {exercise.history.map((h, i) => (
                                    <div key={i} className="flex justify-between text-xs text-dark-300">
                                        <span>{h.date}</span>
                                        <span>{h.best_set} • {Math.round(h.volume_kg)} kg vol</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   NEXT SESSION CARD
   ═══════════════════════════════════════════════════════ */

function NextSessionCard({ session }: { session: NonNullable<Briefing['briefing_data']['next_session']> }) {
    return (
        <div className="relative rounded-2xl overflow-hidden border border-dark-500/50">
            {/* Background image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&q=70&auto=format"
                    alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-dark-900/85 backdrop-blur-sm" />
            </div>

            {/* Content */}
            <div className="relative z-10 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Crosshair className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-cream-50">Next Session</h2>
                        <p className="text-xs text-dark-300">{session.title}</p>
                    </div>
                </div>

                <p className="text-cream-200 text-sm leading-relaxed mb-4">{session.reasoning}</p>

                {/* Focus muscles */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {session.focus_muscles.map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                            <Star size={10} />
                            {m}
                        </span>
                    ))}
                </div>

                {/* Suggested exercises */}
                <div className="space-y-1.5">
                    {session.suggested_exercises.map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-cream-200">
                            <Dumbbell size={12} className="text-dark-300 shrink-0" />
                            {ex}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════ */

function MacroCard({ icon, label, text, color, bg }: {
    icon: React.ReactNode; label: string; text: string;
    color: string; bg: string;
}) {
    return (
        <div className={`rounded-xl border p-3 ${bg}`}>
            <div className={`flex items-center gap-2 mb-1.5 ${color}`}>
                {icon}
                <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-cream-200 text-xs leading-relaxed">{text}</p>
        </div>
    );
}
