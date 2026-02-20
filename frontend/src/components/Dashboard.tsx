import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTodayBriefing, regenerateBriefing } from '../api/api';
import type { UserInfo, Briefing } from '../api/api';
import { Dumbbell, UtensilsCrossed, Target, RefreshCw, Loader2, Sunrise, Flame, Beef, Wheat, Droplets } from 'lucide-react';

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
                    {/* Nutrition Review — Macro Breakdown */}
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
                            <MacroCard
                                icon={<Flame className="w-4 h-4" />}
                                label="Calories"
                                text={data.nutrition_review.calories}
                                color="text-orange-400"
                                bg="bg-orange-500/10 border-orange-500/20"
                            />
                            <MacroCard
                                icon={<Beef className="w-4 h-4" />}
                                label="Protein"
                                text={data.nutrition_review.protein}
                                color="text-red-400"
                                bg="bg-red-500/10 border-red-500/20"
                            />
                            <MacroCard
                                icon={<Wheat className="w-4 h-4" />}
                                label="Carbs"
                                text={data.nutrition_review.carbs}
                                color="text-yellow-400"
                                bg="bg-yellow-500/10 border-yellow-500/20"
                            />
                            <MacroCard
                                icon={<Droplets className="w-4 h-4" />}
                                label="Fat"
                                text={data.nutrition_review.fat}
                                color="text-emerald-400"
                                bg="bg-emerald-500/10 border-emerald-500/20"
                            />
                        </div>
                    </div>

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
                </>
            )}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

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
