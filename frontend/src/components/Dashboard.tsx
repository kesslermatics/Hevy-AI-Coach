import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTodayBriefing, regenerateBriefing } from '../api/api';
import type { UserInfo, Briefing } from '../api/api';
import { Brain, Dumbbell, UtensilsCrossed, Target, RefreshCw, Loader2, Sunrise, Zap } from 'lucide-react';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

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
    const score = data?.readiness_score ?? 0;

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
                    {/* Readiness Score */}
                    <div className="card-glass p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-700/20 border border-gold-500/30 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-gold-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-cream-50">Readiness Score</h2>
                                    <p className="text-xs text-dark-300">Based on recovery & nutrition</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-3xl font-bold ${score >= 75 ? 'text-green-400' : score >= 50 ? 'text-gold-400' : 'text-red-400'}`}>
                                    {score}
                                </span>
                                <span className="text-dark-300 text-sm">/100</span>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-2 rounded-full bg-dark-600 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-gold-500' : 'bg-red-500'}`}
                                style={{ width: `${score}%` }}
                            />
                        </div>
                    </div>

                    {/* Nutrition Review */}
                    <BriefingCard
                        icon={<UtensilsCrossed className="w-5 h-5" />}
                        title="Nutrition Review"
                        subtitle="Yesterday's nutrition"
                        content={data.nutrition_review}
                        accentColor="text-amber-400"
                        bgColor="bg-amber-500/10 border-amber-500/30"
                    />

                    {/* Workout Suggestion */}
                    <BriefingCard
                        icon={<Dumbbell className="w-5 h-5" />}
                        title="Workout Suggestion"
                        subtitle="Today's training focus"
                        content={data.workout_suggestion}
                        accentColor="text-blue-400"
                        bgColor="bg-blue-500/10 border-blue-500/30"
                    />

                    {/* Daily Mission */}
                    <div className="card-glass p-6 border-l-4 border-gold-500">
                        <div className="flex items-center gap-3 mb-3">
                            <Target className="w-5 h-5 text-gold-400" />
                            <h3 className="text-sm font-semibold text-cream-50">Daily Mission</h3>
                        </div>
                        <p className="text-cream-100 text-sm leading-relaxed italic">
                            "{data.daily_mission}"
                        </p>
                    </div>

                    {/* Current Goal pill */}
                    {user?.current_goal && (
                        <div className="text-center">
                            <span className="inline-flex items-center gap-2 bg-dark-700/60 border border-dark-500/50 text-dark-300 text-xs font-medium px-4 py-2 rounded-full">
                                <Brain size={12} />
                                Goal: {user.current_goal.replace(/_/g, ' ')}
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

function BriefingCard({ icon, title, subtitle, content, accentColor, bgColor }: {
    icon: React.ReactNode; title: string; subtitle: string; content: string;
    accentColor: string; bgColor: string;
}) {
    return (
        <div className="card-glass p-6">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bgColor} ${accentColor}`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-cream-50">{title}</h3>
                    <p className="text-xs text-dark-300">{subtitle}</p>
                </div>
            </div>
            <p className="text-cream-200 text-sm leading-relaxed">{content}</p>
        </div>
    );
}
