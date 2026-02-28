import { useEffect, useState } from 'react';
import { getWeeklyReport, getMonthlyReport } from '../api/api';
import type { WeeklyReport, MonthlyReport, ReportTraining, ReportNutrition, ReportWeight } from '../api/api';
import {
    Loader2, ChevronLeft, ChevronRight, Dumbbell, Flame, Beef,
    Scale, BarChart3, TrendingUp, TrendingDown, Minus, Calendar,
} from 'lucide-react';
import { useLanguage } from '../i18n';

type Mode = 'weekly' | 'monthly';

export default function ReportsTab() {
    const { t, lang } = useLanguage();
    const [mode, setMode] = useState<Mode>('weekly');
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);

    const [weekData, setWeekData] = useState<{ current: WeeklyReport; previous: WeeklyReport } | null>(null);
    const [monthData, setMonthData] = useState<{ current: MonthlyReport; previous: MonthlyReport } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async (m: Mode, wO: number, mO: number) => {
        setLoading(true);
        setError(null);
        try {
            if (m === 'weekly') {
                const d = await getWeeklyReport(wO);
                setWeekData(d);
            } else {
                const d = await getMonthlyReport(mO);
                setMonthData(d);
            }
        } catch (e: any) {
            setError(e.message || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(mode, weekOffset, monthOffset);
    }, [mode, weekOffset, monthOffset]);

    const handlePrev = () => {
        if (mode === 'weekly') setWeekOffset(o => o + 1);
        else setMonthOffset(o => o + 1);
    };
    const handleNext = () => {
        if (mode === 'weekly') setWeekOffset(o => Math.max(0, o - 1));
        else setMonthOffset(o => Math.max(0, o - 1));
    };
    const isLatest = mode === 'weekly' ? weekOffset === 0 : monthOffset === 0;

    // Get current + previous data
    const current = mode === 'weekly' ? weekData?.current : monthData?.current;
    const previous = mode === 'weekly' ? weekData?.previous : monthData?.previous;

    // Period label
    const periodLabel = (() => {
        if (mode === 'weekly' && weekData?.current) {
            const start = new Date(weekData.current.week_start);
            const end = new Date(weekData.current.week_end);
            const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
            const locale = lang === 'de' ? 'de-DE' : 'en-US';
            return `${start.toLocaleDateString(locale, opts)} – ${end.toLocaleDateString(locale, opts)}`;
        }
        if (mode === 'monthly' && monthData?.current) {
            return monthData.current.month;
        }
        return '';
    })();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-cream-50 flex items-center gap-2.5">
                    <BarChart3 className="w-6 h-6 text-gold-400" />
                    {t('reports.title')}
                </h1>
            </div>

            {/* Mode + Navigation */}
            <div className="flex items-center justify-between">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 bg-dark-700/50 rounded-lg p-1 border border-dark-500/20">
                    <button onClick={() => setMode('weekly')}
                        className={`text-xs px-3 py-1.5 rounded-md transition-all cursor-pointer ${mode === 'weekly' ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30' : 'text-dark-300 hover:text-cream-100'}`}>
                        {t('reports.weekly')}
                    </button>
                    <button onClick={() => setMode('monthly')}
                        className={`text-xs px-3 py-1.5 rounded-md transition-all cursor-pointer ${mode === 'monthly' ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30' : 'text-dark-300 hover:text-cream-100'}`}>
                        {t('reports.monthly')}
                    </button>
                </div>

                {/* Period navigation */}
                <div className="flex items-center gap-2">
                    <button onClick={handlePrev}
                        className="w-8 h-8 rounded-lg bg-dark-700/50 border border-dark-500/20 flex items-center justify-center text-dark-300 hover:text-cream-100 transition-colors cursor-pointer">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-cream-100 min-w-[140px] text-center font-medium">
                        {loading ? '…' : periodLabel}
                    </span>
                    <button onClick={handleNext} disabled={isLatest}
                        className="w-8 h-8 rounded-lg bg-dark-700/50 border border-dark-500/20 flex items-center justify-center text-dark-300 hover:text-cream-100 transition-colors cursor-pointer disabled:opacity-30">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="py-16 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto" />
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="py-16 text-center">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Report content */}
            {!loading && !error && current && previous && (
                <ReportContent
                    current={{ training: current.training, nutrition: current.nutrition, weight: current.weight }}
                    previous={{ training: previous.training, nutrition: previous.nutrition, weight: previous.weight }}
                    mode={mode}
                />
            )}
        </div>
    );
}

/* ── Report Content ───────────────────────────────────── */
function ReportContent({ current, previous, mode }: {
    current: { training: ReportTraining; nutrition: ReportNutrition; weight: ReportWeight };
    previous: { training: ReportTraining; nutrition: ReportNutrition; weight: ReportWeight };
    mode: Mode;
}) {
    const { t, lang } = useLanguage();
    const vsLabel = mode === 'weekly' ? t('reports.vsLastWeek') : t('reports.vsLastMonth');

    return (
        <div className="space-y-4">
            {/* ─── Training Section ──────────────────── */}
            <div className="card-glass p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-blue-500/10 border-blue-500/30 text-blue-400">
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-semibold text-cream-50">Training</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <CompareCard
                        label={t('reports.workouts')}
                        current={current.training.workouts_count}
                        previous={previous.training.workouts_count}
                        vsLabel={vsLabel}
                        format="int"
                    />
                    <CompareCard
                        label={t('reports.totalVolume')}
                        current={current.training.total_volume_kg}
                        previous={previous.training.total_volume_kg}
                        vsLabel={vsLabel}
                        format="kg"
                    />
                    <CompareCard
                        label={t('reports.totalSets')}
                        current={current.training.total_sets}
                        previous={previous.training.total_sets}
                        vsLabel={vsLabel}
                        format="int"
                    />
                    <CompareCard
                        label={t('reports.duration')}
                        current={current.training.total_duration_min}
                        previous={previous.training.total_duration_min}
                        vsLabel={vsLabel}
                        format="min"
                    />
                </div>

                {/* Muscle groups breakdown */}
                {Object.keys(current.training.muscle_groups).length > 0 && (
                    <div className="space-y-2 pt-1">
                        <p className="text-[10px] text-dark-400 uppercase tracking-wider font-semibold">
                            {lang === 'de' ? 'Muskelgruppen' : 'Muscle Groups'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(current.training.muscle_groups)
                                .sort((a, b) => b[1] - a[1])
                                .map(([group, sets]) => (
                                    <span key={group} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                        {group}: {sets} sets
                                    </span>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Nutrition Section ─────────────────── */}
            <div className="card-glass p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-amber-500/10 border-amber-500/30 text-amber-400">
                        <Flame className="w-5 h-5" />
                    </div>
                    <h2 className="text-sm font-semibold text-cream-50">{lang === 'de' ? 'Ernährung' : 'Nutrition'}</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <CompareCard
                        label={t('reports.avgCalories')}
                        current={Math.round(current.nutrition.avg_calories)}
                        previous={Math.round(previous.nutrition.avg_calories)}
                        vsLabel={vsLabel}
                        format="kcal"
                    />
                    <CompareCard
                        label={t('reports.avgProtein')}
                        current={Math.round(current.nutrition.avg_protein)}
                        previous={Math.round(previous.nutrition.avg_protein)}
                        vsLabel={vsLabel}
                        format="g"
                    />
                    <CompareCard
                        label={t('reports.daysTracked')}
                        current={current.nutrition.days_tracked}
                        previous={previous.nutrition.days_tracked}
                        vsLabel={vsLabel}
                        format="int"
                    />
                    {current.nutrition.calorie_goal ? (
                        <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-500/15">
                            <p className="text-[9px] text-dark-400 uppercase tracking-wider">{lang === 'de' ? 'Kcal-Ziel' : 'Kcal Goal'}</p>
                            <p className="text-lg font-bold text-cream-100 mt-1">{Math.round(current.nutrition.calorie_goal)}</p>
                            <p className="text-[10px] text-dark-400 mt-0.5">
                                Ø {Math.round(current.nutrition.avg_calories)} / {Math.round(current.nutrition.calorie_goal)}
                            </p>
                        </div>
                    ) : (
                        <CompareCard label={lang === 'de' ? 'Ø Carbs' : 'Avg Carbs'}
                            current={Math.round(current.nutrition.avg_carbs || 0)}
                            previous={Math.round(previous.nutrition.avg_carbs || 0)}
                            vsLabel={vsLabel} format="g" />
                    )}
                </div>
            </div>

            {/* ─── Weight Section ────────────────────── */}
            {(current.weight.start != null || current.weight.end != null) && (
                <div className="card-glass p-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-purple-500/10 border-purple-500/30 text-purple-400">
                            <Scale className="w-5 h-5" />
                        </div>
                        <h2 className="text-sm font-semibold text-cream-50">{t('reports.weightChange')}</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {current.weight.start != null && (
                            <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-500/15 text-center">
                                <p className="text-[9px] text-dark-400 uppercase tracking-wider">{lang === 'de' ? 'Start' : 'Start'}</p>
                                <p className="text-lg font-bold text-cream-100 mt-1">{current.weight.start.toFixed(1)} kg</p>
                            </div>
                        )}
                        {current.weight.end != null && (
                            <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-500/15 text-center">
                                <p className="text-[9px] text-dark-400 uppercase tracking-wider">{lang === 'de' ? 'Aktuell' : 'Current'}</p>
                                <p className="text-lg font-bold text-cream-100 mt-1">{current.weight.end.toFixed(1)} kg</p>
                            </div>
                        )}
                        {current.weight.change != null && (
                            <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-500/15 text-center">
                                <p className="text-[9px] text-dark-400 uppercase tracking-wider">{t('reports.weightChange')}</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    {current.weight.change > 0.05 ? <TrendingUp size={14} className="text-green-400" /> :
                                        current.weight.change < -0.05 ? <TrendingDown size={14} className="text-blue-400" /> :
                                            <Minus size={14} className="text-dark-300" />}
                                    <span className={`text-lg font-bold ${current.weight.change > 0.05 ? 'text-green-400' : current.weight.change < -0.05 ? 'text-blue-400' : 'text-dark-300'}`}>
                                        {current.weight.change > 0 ? '+' : ''}{current.weight.change.toFixed(1)} kg
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Compare Card ─────────────────────────────────────── */
function CompareCard({ label, current, previous, vsLabel, format }: {
    label: string; current: number; previous: number; vsLabel: string;
    format: 'int' | 'kg' | 'g' | 'kcal' | 'min';
}) {
    const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const hasDiff = previous > 0 && Math.abs(diff) > 0.5;

    const formatVal = (v: number) => {
        switch (format) {
            case 'kg': return `${Math.round(v).toLocaleString()} kg`;
            case 'g': return `${Math.round(v)}g`;
            case 'kcal': return `${Math.round(v)}`;
            case 'min': return `${Math.round(v)} min`;
            default: return String(Math.round(v));
        }
    };

    return (
        <div className="bg-dark-700/30 rounded-xl p-3 border border-dark-500/15">
            <p className="text-[9px] text-dark-400 uppercase tracking-wider">{label}</p>
            <p className="text-lg font-bold text-cream-100 mt-1">{formatVal(current)}</p>
            {hasDiff && (
                <div className="flex items-center gap-1 mt-1">
                    {diff > 0 ? <TrendingUp size={10} className="text-green-400" /> :
                        <TrendingDown size={10} className="text-red-400" />}
                    <span className={`text-[10px] ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                    </span>
                    <span className="text-[9px] text-dark-400">{vsLabel}</span>
                </div>
            )}
        </div>
    );
}
