import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTodayBriefing, regenerateBriefing, getSessionReview, getWorkoutList, getWorkoutTips, getWeather } from '../api/api';
import type { UserInfo, Briefing, SessionReviewData, ExerciseReview, WorkoutListItem, WorkoutTips, WeatherData } from '../api/api';
import {
    Dumbbell, UtensilsCrossed, Target, RefreshCw, Loader2, Sunrise,
    Flame, Beef, Wheat, Droplets, TrendingUp, TrendingDown, Minus, Sparkles,
    Trophy, Crosshair, Star, X, ArrowLeft, Clock, Plus, Scale, MapPin, Activity
} from 'lucide-react';
import MuscleHeatmap from './MuscleHeatmap';
import ActivityHeatmap from './ActivityHeatmap';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

/* ── CS2 Rank Colors ────────────────────────────────── */
const RANK_COLORS: Record<number, string> = {
    0: '#8C8C8C', 1: '#8C8C8C', 2: '#8C8C8C', 3: '#8C8C8C',
    4: '#D4A017', 5: '#D4A017', 6: '#D4A017', 7: '#D4A017',
    8: '#3B82F6', 9: '#3B82F6', 10: '#3B82F6',
    11: '#8B5CF6', 12: '#A855F7', 13: '#A855F7',
    14: '#EF4444', 15: '#FFD700',
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

    // Location + weather
    const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [weather, setWeather] = useState<WeatherData | null>(null);

    // Session review modal state
    const [modalOpen, setModalOpen] = useState<'last' | 'next' | null>(null);
    const [sessionReview, setSessionReview] = useState<SessionReviewData | null>(null);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);

    // Next Session (workout picker) state
    const [workoutList, setWorkoutList] = useState<WorkoutListItem[] | null>(null);
    const [workoutsLoading, setWorkoutsLoading] = useState(false);
    const [selectedWorkoutTips, setSelectedWorkoutTips] = useState<WorkoutTips | null>(null);
    const [tipsLoading, setTipsLoading] = useState(false);
    const [tipsError, setTipsError] = useState<string | null>(null);

    // Get user location on mount, then fetch briefing
    useEffect(() => {
        let locationResolved = false;

        const loadWithLocation = (loc: { lat: number; lon: number } | null) => {
            if (locationResolved) return;
            locationResolved = true;
            if (loc) {
                setLocation(loc);
                getWeather(loc.lat, loc.lon).then(setWeather).catch(() => { });
            }
            // Fetch briefing (with or without location)
            setError(null);
            getTodayBriefing(loc?.lat, loc?.lon)
                .then(setBriefing)
                .catch((err: any) => setError(err.message || 'Failed to load briefing'))
                .finally(() => setLoading(false));
        };

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => loadWithLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                () => loadWithLocation(null),
                { timeout: 5000, enableHighAccuracy: false }
            );
            // Fallback if geolocation is very slow
            setTimeout(() => loadWithLocation(null), 6000);
        } else {
            loadWithLocation(null);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRegenerate = async () => {
        setRegenerating(true); setError(null);
        try {
            const b = await regenerateBriefing(location?.lat, location?.lon);
            setBriefing(b);
        } catch (err: any) {
            setError(err.message || 'Failed to regenerate');
        } finally {
            setRegenerating(false);
        }
    };

    const openSessionModal = async (tab: 'last' | 'next') => {
        setModalOpen(tab);
        if (tab === 'last' && !sessionReview) {
            setSessionLoading(true);
            setSessionError(null);
            try {
                const data = await getSessionReview();
                setSessionReview(data);
            } catch (err: any) {
                setSessionError(err.message || 'Failed to load session review');
            } finally {
                setSessionLoading(false);
            }
        }
        if (tab === 'next' && !workoutList) {
            setWorkoutsLoading(true);
            try {
                const list = await getWorkoutList();
                setWorkoutList(list);
            } catch {
                // silently fail — empty list shown
            } finally {
                setWorkoutsLoading(false);
            }
        }
    };

    const handleSelectWorkout = async (index: number) => {
        setTipsLoading(true);
        setTipsError(null);
        setSelectedWorkoutTips(null);
        try {
            const tips = await getWorkoutTips(index);
            setSelectedWorkoutTips(tips);
        } catch (err: any) {
            setTipsError(err.message || 'Failed to load tips');
        } finally {
            setTipsLoading(false);
        }
    };

    const closeModal = () => {
        setModalOpen(null);
        setSelectedWorkoutTips(null);
        setTipsError(null);
    };

    const retryBriefing = () => {
        setLoading(true);
        setError(null);
        getTodayBriefing(location?.lat, location?.lon)
            .then(setBriefing)
            .catch((err: any) => setError(err.message || 'Failed to load briefing'))
            .finally(() => setLoading(false));
    };

    const data = briefing?.briefing_data;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Welcome header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cream-50">
                        Good morning, <span className="text-gradient-gold">{user?.username}</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-dark-300 text-sm flex items-center gap-1.5">
                            <Sunrise size={14} />
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        {weather && weather.temperature_c != null && (
                            <p className="text-dark-300 text-sm flex items-center gap-1.5">
                                <MapPin size={12} />
                                <span>{weather.emoji} {Math.round(weather.temperature_c)}°C · {weather.condition}{weather.temp_min_c != null && weather.temp_max_c != null && ` · ↓${Math.round(weather.temp_min_c)}° ↑${Math.round(weather.temp_max_c)}°`}</span>
                            </p>
                        )}
                    </div>
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
                    <button onClick={retryBriefing}
                        className="btn-gold text-sm px-6 py-2 mx-auto">Try Again</button>
                </div>
            )}

            {/* Briefing content */}
            {data && !loading && (
                <>
                    {/* ─── Weather Note ─────────────────── */}
                    {data.weather_note && (
                        <div className="card-glass p-4 flex items-center gap-3">
                            <span className="text-2xl">{weather?.emoji || '🌤️'}</span>
                            <p className="text-cream-200 text-sm leading-relaxed">{data.weather_note}</p>
                        </div>
                    )}

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

                    {/* ─── Workout Suggestion ──────────────── */}
                    <div className="card-glass p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-blue-500/10 border-blue-500/30 text-blue-400">
                                <Dumbbell className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-cream-50">Workout Suggestion</h3>
                                <p className="text-xs text-dark-300">Today's training focus</p>
                            </div>
                        </div>
                        <p className="text-cream-200 text-sm leading-relaxed">{data.workout_suggestion}</p>
                    </div>

                    {/* ─── Muscle Recovery Heatmap ─────────── */}
                    {data.muscle_recovery && Object.keys(data.muscle_recovery).length > 0 && (
                        <div className="card-glass p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-rose-500/10 border-rose-500/30 text-rose-400">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-cream-50">Muscle Recovery</h3>
                                    <p className="text-xs text-dark-300">Based on your recent workouts</p>
                                </div>
                            </div>
                            <MuscleHeatmap recovery={data.muscle_recovery} />
                        </div>
                    )}

                    {/* ─── Weight Trend ─────────────────────── */}
                    {data.weight_trend && (
                        <div className="card-glass p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-purple-500/10 border-purple-500/30 text-purple-400">
                                    <Scale className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-cream-50">Weight Trend</h3>
                                    <p className="text-xs text-dark-300">Your journey progress</p>
                                </div>
                            </div>
                            <p className="text-cream-200 text-sm leading-relaxed">{data.weight_trend}</p>
                        </div>
                    )}

                    {/* ─── Session Tiles (clickable) ───────── */}
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => openSessionModal('last')}
                            className="card-glass p-5 text-left hover:border-purple-500/40 transition-all duration-200 group cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                <Trophy className="w-5 h-5 text-purple-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-cream-50 mb-1">Last Session</h3>
                            <p className="text-xs text-dark-300">Review, rankings & progression</p>
                        </button>

                        <button onClick={() => openSessionModal('next')}
                            className="card-glass p-5 text-left hover:border-blue-500/40 transition-all duration-200 group cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                <Crosshair className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-cream-50 mb-1">Workout Tips</h3>
                            <p className="text-xs text-dark-300">Pick a session for AI coaching</p>
                        </button>
                    </div>

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

                    {/* ─── Activity Heatmap ────────────────── */}
                    <ActivityHeatmap />
                </>
            )}

            {/* ─── Session Review Modal ──────────────── */}
            {modalOpen && (
                <SessionModal
                    tab={modalOpen}
                    onTabChange={(t) => { setSelectedWorkoutTips(null); setTipsError(null); openSessionModal(t); }}
                    onClose={closeModal}
                    sessionData={sessionReview}
                    sessionLoading={sessionLoading}
                    sessionError={sessionError}
                    workoutList={workoutList}
                    workoutsLoading={workoutsLoading}
                    selectedWorkoutTips={selectedWorkoutTips}
                    tipsLoading={tipsLoading}
                    tipsError={tipsError}
                    onSelectWorkout={handleSelectWorkout}
                    onBackToList={() => { setSelectedWorkoutTips(null); setTipsError(null); }}
                    onRetrySession={() => {
                        setSessionReview(null);
                        openSessionModal('last');
                    }}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   SESSION REVIEW MODAL
   ═══════════════════════════════════════════════════════ */

function SessionModal({ tab, onTabChange, onClose, sessionData, sessionLoading, sessionError,
    workoutList, workoutsLoading, selectedWorkoutTips, tipsLoading, tipsError,
    onSelectWorkout, onBackToList, onRetrySession }: {
        tab: 'last' | 'next';
        onTabChange: (t: 'last' | 'next') => void;
        onClose: () => void;
        sessionData: SessionReviewData | null;
        sessionLoading: boolean;
        sessionError: string | null;
        workoutList: WorkoutListItem[] | null;
        workoutsLoading: boolean;
        selectedWorkoutTips: WorkoutTips | null;
        tipsLoading: boolean;
        tipsError: string | null;
        onSelectWorkout: (index: number) => void;
        onBackToList: () => void;
        onRetrySession: () => void;
    }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-lg max-h-[85vh] bg-dark-800/95 backdrop-blur-xl border border-dark-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-dark-500/30">
                    <div className="flex gap-1 bg-dark-700/50 rounded-lg p-0.5">
                        <button
                            onClick={() => onTabChange('last')}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${tab === 'last'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'text-dark-300 hover:text-cream-100'
                                }`}>
                            <Trophy size={12} className="inline mr-1.5" />Last Session
                        </button>
                        <button
                            onClick={() => onTabChange('next')}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${tab === 'next'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'text-dark-300 hover:text-cream-100'
                                }`}>
                            <Crosshair size={12} className="inline mr-1.5" />Workout Tips
                        </button>
                    </div>
                    <button onClick={onClose}
                        className="text-dark-300 hover:text-cream-100 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'last' && (
                        <>
                            {sessionLoading && <ModalLoader text="Analyzing your last session…" />}
                            {sessionError && !sessionLoading && (
                                <ModalError message={sessionError} onRetry={onRetrySession} />
                            )}
                            {sessionData && !sessionLoading && !sessionError && (
                                <LastSessionContent session={sessionData.last_session} />
                            )}
                        </>
                    )}
                    {tab === 'next' && (
                        <>
                            {selectedWorkoutTips ? (
                                <WorkoutTipsContent tips={selectedWorkoutTips} onBack={onBackToList} />
                            ) : tipsLoading ? (
                                <ModalLoader text="Generating tips for this workout…" />
                            ) : tipsError ? (
                                <ModalError message={tipsError} onRetry={onBackToList} />
                            ) : workoutsLoading ? (
                                <ModalLoader text="Loading your workouts…" />
                            ) : (
                                <WorkoutPicker workouts={workoutList || []} onSelect={onSelectWorkout} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ModalLoader({ text }: { text: string }) {
    return (
        <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto" />
            <p className="text-dark-300 text-sm">{text}</p>
            <p className="text-dark-400 text-xs">This may take a few seconds</p>
        </div>
    );
}

function ModalError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="py-16 text-center space-y-3">
            <p className="text-red-400 text-sm">{message}</p>
            <button onClick={onRetry} className="btn-gold text-sm px-6 py-2">Retry</button>
        </div>
    );
}

/* ── Last Session Content ───────────────────────────── */

function LastSessionContent({ session }: { session: SessionReviewData['last_session'] }) {
    if (!session) {
        return <p className="text-dark-300 text-sm text-center py-8">No recent session data available.</p>;
    }

    return (
        <div className="space-y-4">
            {/* Session header */}
            <div>
                <h3 className="text-lg font-semibold text-cream-50">{session.title}</h3>
                <p className="text-xs text-dark-300 mt-0.5">
                    {session.date}{session.duration_min ? ` • ${session.duration_min} min` : ''}
                </p>
            </div>
            <p className="text-cream-200 text-sm leading-relaxed">{session.overall_feedback}</p>

            {/* Exercise cards */}
            <div className="space-y-3">
                {session.exercises.map((ex, i) => (
                    <ExerciseCard key={i} exercise={ex} />
                ))}
            </div>
        </div>
    );
}

/* ── Exercise Card with Rank + SVG Chart ────────────── */

function ExerciseCard({ exercise }: { exercise: ExerciseReview }) {
    const rankColor = RANK_COLORS[exercise.rank_index] ?? '#8C8C8C';
    const rankBg = RANK_BG[exercise.rank_index] ?? 'bg-gray-500/10 border-gray-500/30';

    const TrendIcon = exercise.trend === 'up' ? TrendingUp
        : exercise.trend === 'down' ? TrendingDown
            : exercise.trend === 'new' ? Sparkles : Minus;

    const trendColor = exercise.trend === 'up' ? 'text-green-400'
        : exercise.trend === 'down' ? 'text-red-400'
            : exercise.trend === 'new' ? 'text-blue-400' : 'text-dark-300';

    return (
        <div className="bg-dark-700/40 backdrop-blur-sm rounded-xl border border-dark-500/30 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <Dumbbell size={14} className="text-dark-300 shrink-0" />
                    <span className="text-sm font-medium text-cream-50 truncate">{exercise.name}</span>
                    <span className="text-[10px] text-dark-400 shrink-0 uppercase">{exercise.muscle_group}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <TrendIcon size={14} className={trendColor} />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${rankBg}`}
                        style={{ color: rankColor }}>
                        {exercise.rank}
                    </span>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-dark-300">
                <span>Best: <span className="text-cream-100 font-medium">{exercise.best_set}</span></span>
                <span>Volume: <span className="text-cream-100 font-medium">{Math.round(exercise.total_volume_kg)} kg</span></span>
            </div>

            {/* Rank progress bar */}
            <div className="w-full h-1.5 rounded-full bg-dark-600 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${((exercise.rank_index + 1) / 16) * 100}%`, backgroundColor: rankColor }} />
            </div>

            {/* Feedback */}
            <p className="text-cream-200 text-xs leading-relaxed">{exercise.feedback}</p>

            {/* Progression Chart (SVG) */}
            {exercise.history.length > 0 && (
                <ProgressionChart history={exercise.history} currentVolume={exercise.total_volume_kg} />
            )}
        </div>
    );
}

/* ── SVG Progression Chart ──────────────────────────── */

function ProgressionChart({ history, currentVolume }: {
    history: { date: string; best_set: string; volume_kg: number }[];
    currentVolume: number;
}) {
    const allPoints = [...history.map(h => h.volume_kg), currentVolume];
    const maxVol = Math.max(...allPoints, 1);
    const minVol = Math.min(...allPoints);
    const range = maxVol - minVol || 1;

    const W = 280;
    const H = 80;
    const padX = 8;
    const padY = 8;
    const chartW = W - padX * 2;
    const chartH = H - padY * 2;

    const points = allPoints.map((v, i) => ({
        x: padX + (i / (allPoints.length - 1 || 1)) * chartW,
        y: padY + chartH - ((v - minVol) / range) * chartH,
    }));

    // Build SVG path
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`;

    return (
        <div className="mt-1">
            <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-1.5">Volume Progression</p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`grad-${history[0]?.date}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <path d={areaPath} fill={`url(#grad-${history[0]?.date})`} />
                {/* Line */}
                <path d={linePath} fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Data dots */}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5}
                        fill={i === points.length - 1 ? '#F59E0B' : '#A855F7'}
                        stroke={i === points.length - 1 ? '#F59E0B' : 'none'} strokeWidth="1" />
                ))}
            </svg>
            {/* Labels */}
            <div className="flex justify-between text-[9px] text-dark-400 mt-0.5 px-1">
                {allPoints.map((v, i) => (
                    <span key={i} className={i === allPoints.length - 1 ? 'text-gold-400 font-bold' : ''}>
                        {Math.round(v)}kg
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ── Workout Picker (list of workouts to choose from) ── */

function WorkoutPicker({ workouts, onSelect }: {
    workouts: WorkoutListItem[];
    onSelect: (index: number) => void;
}) {
    if (workouts.length === 0) {
        return <p className="text-dark-300 text-sm text-center py-8">No workouts found.</p>;
    }

    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-lg font-semibold text-cream-50">Pick a workout</h3>
                <p className="text-xs text-dark-300 mt-0.5">Select a session to get AI-powered tips & suggestions</p>
            </div>
            <div className="space-y-2">
                {workouts.map((w) => (
                    <button key={w.index} onClick={() => onSelect(w.index)}
                        className="w-full text-left bg-dark-700/40 hover:bg-dark-700/60 backdrop-blur-sm rounded-xl border border-dark-500/30 hover:border-blue-500/30 p-4 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-cream-50 group-hover:text-blue-300 transition-colors">{w.title}</span>
                            <div className="flex items-center gap-2 text-[11px] text-dark-400">
                                {w.duration_min && (
                                    <span className="flex items-center gap-1"><Clock size={10} />{w.duration_min}m</span>
                                )}
                                <span>{w.date}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {w.exercise_names.slice(0, 5).map((name, i) => (
                                <span key={i} className="text-[10px] text-dark-300 bg-dark-600/50 px-2 py-0.5 rounded-full">
                                    {name}
                                </span>
                            ))}
                            {w.exercise_names.length > 5 && (
                                <span className="text-[10px] text-dark-400 px-2 py-0.5">+{w.exercise_names.length - 5} more</span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ── Workout Tips Content (AI result) ───────────────── */

function WorkoutTipsContent({ tips, onBack }: {
    tips: WorkoutTips;
    onBack: () => void;
}) {
    return (
        <div className="space-y-4">
            {/* Back button + header */}
            <div>
                <button onClick={onBack}
                    className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-cream-100 transition-colors mb-2 cursor-pointer">
                    <ArrowLeft size={12} />Back to workouts
                </button>
                <h3 className="text-lg font-semibold text-cream-50">{tips.workout_title}</h3>
                {tips.workout_date && (
                    <p className="text-xs text-dark-300 mt-0.5">{tips.workout_date}</p>
                )}
            </div>

            {/* Nutrition Context */}
            {tips.nutrition_context && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                    <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-semibold">
                        <Flame size={10} />Nutrition Phase
                    </p>
                    <p className="text-cream-200 text-xs leading-relaxed">{tips.nutrition_context}</p>
                </div>
            )}

            {/* Exercise Tips */}
            {tips.exercise_tips.length > 0 && (
                <div>
                    <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Dumbbell size={10} />Exercise Breakdown
                    </p>
                    <div className="space-y-2.5">
                        {tips.exercise_tips.map((et, i) => (
                            <div key={i} className="bg-dark-700/40 rounded-xl border border-dark-500/20 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-cream-50">{et.name}</span>
                                    <span className="text-[10px] text-dark-300 bg-dark-600/60 px-2 py-0.5 rounded-full font-mono">
                                        {et.sets_reps_done}
                                    </span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                    <TrendingUp size={11} className="text-purple-400 shrink-0 mt-0.5" />
                                    <p className="text-cream-300 text-[11px] leading-relaxed">{et.progression_note}</p>
                                </div>
                                <div className="bg-blue-500/8 border border-blue-500/15 rounded-lg p-2.5">
                                    <p className="text-blue-300 text-[11px] leading-relaxed font-medium">
                                        → {et.recommendation}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New exercises to try */}
            {tips.new_exercises_to_try.length > 0 && (
                <div>
                    <p className="text-[10px] text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Plus size={10} />Try next time
                    </p>
                    <div className="space-y-2">
                        {tips.new_exercises_to_try.map((ne, i) => (
                            <div key={i} className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-3.5">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Star size={12} className="text-emerald-400 shrink-0" />
                                        <span className="text-xs font-semibold text-emerald-300">{ne.name}</span>
                                    </div>
                                    <span className="text-[10px] text-dark-300 bg-dark-600/60 px-2 py-0.5 rounded-full font-mono">
                                        {ne.suggested_sets_reps}
                                    </span>
                                </div>
                                <p className="text-cream-200 text-[11px] leading-relaxed pl-5">{ne.why}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* General advice */}
            {tips.general_advice && (
                <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-3.5">
                    <p className="text-cream-100 text-xs leading-relaxed italic">💡 {tips.general_advice}</p>
                </div>
            )}
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
