import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    getTodayNutrition, getNutritionHistory, getFoodStatistics, getNutritionAnalysis
} from '../api/api';
import type {
    UserInfo, TodayNutrition, NutritionHistoryData, FoodStatisticsData, NutritionAnalysis, FoodItem
} from '../api/api';
import {
    UtensilsCrossed, Loader2, Sparkles, ChevronDown, ChevronUp,
    Flame, Beef, TrendingUp, Award
} from 'lucide-react';
import { useLanguage } from '../i18n';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

type LayoutContext = { user: UserInfo | null };

/* ── Color Palette ──────────────────────────────────── */
const COLORS = {
    calories: '#f97316', // orange
    protein: '#ef4444',  // red
    carbs: '#eab308',    // yellow
    fat: '#22c55e',      // green
    sugar: '#ec4899',    // pink
    fiber: '#84cc16',    // lime
    saturated: '#8b5cf6', // violet
    salt: '#0ea5e9',     // sky
};

const MEAL_COLORS: Record<string, string> = {
    breakfast: '#f97316',
    lunch: '#22c55e',
    dinner: '#3b82f6',
    snack: '#a855f7',
};

export default function NutritionPage() {
    useOutletContext<LayoutContext>();
    const { t, lang } = useLanguage();

    // Data states
    const [todayNutrition, setTodayNutrition] = useState<TodayNutrition | null>(null);
    const [history, setHistory] = useState<NutritionHistoryData | null>(null);
    const [stats, setStats] = useState<FoodStatisticsData | null>(null);
    const [analysis, setAnalysis] = useState<NutritionAnalysis | null>(null);

    // Loading states
    const [loadingToday, setLoadingToday] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    // UI states
    const [historyDays, setHistoryDays] = useState(7);
    const [statsDays, setStatsDays] = useState(30);
    const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

    // Fetch today + yesterday
    useEffect(() => {
        const fetchData = async () => {
            setLoadingToday(true);
            try {
                const data = await getTodayNutrition();
                setTodayNutrition(data);
            } catch (e) {
                console.error('Failed to fetch today nutrition:', e);
            }
            setLoadingToday(false);
        };
        fetchData();
    }, []);

    // Fetch history
    useEffect(() => {
        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const data = await getNutritionHistory(historyDays);
                setHistory(data);
            } catch (e) {
                console.error('Failed to fetch nutrition history:', e);
            }
            setLoadingHistory(false);
        };
        fetchHistory();
    }, [historyDays]);

    // Fetch food statistics
    useEffect(() => {
        const fetchStats = async () => {
            setLoadingStats(true);
            try {
                const data = await getFoodStatistics(statsDays);
                setStats(data);
            } catch (e) {
                console.error('Failed to fetch food statistics:', e);
            }
            setLoadingStats(false);
        };
        fetchStats();
    }, [statsDays]);

    // Fetch AI analysis
    const fetchAnalysis = async () => {
        setLoadingAnalysis(true);
        try {
            const data = await getNutritionAnalysis();
            setAnalysis(data);
        } catch (e) {
            console.error('Failed to fetch nutrition analysis:', e);
        }
        setLoadingAnalysis(false);
    };

    // Prepare chart data
    const chartData = history?.days?.map(d => ({
        date: new Date(d.date).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short', day: 'numeric' }),
        fullDate: d.date,
        calories: d.totals.calories,
        protein: d.totals.protein,
        carbs: d.totals.carbs,
        fat: d.totals.fat,
        calorieGoal: d.goals.calories,
        proteinGoal: d.goals.protein,
    })) || [];

    // Pie chart data for calories by meal
    const mealPieData = todayNutrition?.meals ? Object.entries(todayNutrition.meals)
        .filter(([, m]) => m.calories > 0)
        .map(([key, m]) => ({
            name: t(`nutrition.${key}` as any) || key,
            value: m.calories,
            key,
        })) : [];

    // Stacked bar data for macros by meal
    const mealBarData = todayNutrition?.meals ? Object.entries(todayNutrition.meals)
        .filter(([, m]) => m.calories > 0)
        .map(([key, m]) => ({
            name: t(`nutrition.${key}` as any) || key,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
        })) : [];

    const toggleMeal = (meal: string) => {
        setExpandedMeals(prev => ({ ...prev, [meal]: !prev[meal] }));
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cream-50">{t('nutrition.title')}</h1>
                    <p className="text-dark-300 text-sm">{t('nutrition.subtitle')}</p>
                </div>
            </div>

            {/* ═══ Calorie Trend Chart ════════════════════════════════ */}
            <div className="card-glass p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-orange-500/10 border-orange-500/30 text-orange-400">
                            <Flame className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-cream-50">{lang === 'de' ? 'Kalorien Trend' : 'Calorie Trend'}</h2>
                    </div>
                    <div className="flex gap-2">
                        {[7, 14, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setHistoryDays(d)}
                                className={`px-3 py-1 text-xs rounded-lg transition-colors ${historyDays === d
                                    ? 'bg-gold-500 text-dark-900 font-semibold'
                                    : 'bg-dark-700 text-dark-300 hover:text-cream-100'
                                    }`}
                            >
                                {t(`nutrition.period${d}` as any)}
                            </button>
                        ))}
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#666" fontSize={11} />
                            <YAxis stroke="#666" fontSize={11} unit=" kcal" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                labelStyle={{ color: '#fafaf5' }}
                                formatter={(value: number) => [`${Math.round(value)} kcal`, '']}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="calories" name={t('dashboard.calories')} stroke={COLORS.calories} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="calorieGoal" name={lang === 'de' ? 'Ziel' : 'Goal'} stroke="#666" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-dark-400 text-center py-12">{t('nutrition.noData')}</p>
                )}
            </div>

            {/* ═══ Macro Trend Chart (Protein/Carbs/Fat) ═══════════════════ */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-red-500/10 border-red-500/30 text-red-400">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.macroTrend')}</h2>
                </div>

                {loadingHistory ? (
                    <div className="h-48 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#666" fontSize={11} />
                            <YAxis stroke="#666" fontSize={11} unit="g" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                labelStyle={{ color: '#fafaf5' }}
                                formatter={(value: number) => [`${Math.round(value)}g`, '']}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="protein" name={t('dashboard.protein')} stroke={COLORS.protein} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="carbs" name={t('dashboard.carbs')} stroke={COLORS.carbs} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="fat" name={t('dashboard.fat')} stroke={COLORS.fat} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-dark-400 text-center py-12">{t('nutrition.noData')}</p>
                )}
            </div>

            {/* ═══ Today Overview Row ═══════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calories by Meal Pie Chart */}
                <div className="card-glass p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-amber-500/10 border-amber-500/30 text-amber-400">
                            <Flame className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.caloriesByMeal')}</h2>
                    </div>

                    {loadingToday ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                        </div>
                    ) : mealPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={mealPieData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={45}
                                    outerRadius={75}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {mealPieData.map((entry) => (
                                        <Cell key={entry.key} fill={MEAL_COLORS[entry.key] || '#666'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value) => [`${Math.round(Number(value ?? 0))} kcal`, '']}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={50}
                                    formatter={(value) => {
                                        const item = mealPieData.find(d => d.name === value);
                                        return `${value}: ${item ? Math.round(item.value) : 0} kcal`;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-dark-400 text-center py-12">{t('nutrition.noData')}</p>
                    )}
                </div>

                {/* Macros by Meal Stacked Bar */}
                <div className="card-glass p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                            <Beef className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.macrosByMeal')}</h2>
                    </div>

                    {loadingToday ? (
                        <div className="h-48 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                        </div>
                    ) : mealBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={mealBarData} layout="vertical" margin={{ left: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" stroke="#666" fontSize={11} />
                                <YAxis type="category" dataKey="name" stroke="#666" fontSize={11} width={60} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                                    formatter={(value: number) => [`${Math.round(value)}g`, '']}
                                />
                                <Legend />
                                <Bar dataKey="protein" name={t('dashboard.protein')} stackId="a" fill={COLORS.protein} />
                                <Bar dataKey="carbs" name={t('dashboard.carbs')} stackId="a" fill={COLORS.carbs} />
                                <Bar dataKey="fat" name={t('dashboard.fat')} stackId="a" fill={COLORS.fat} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-dark-400 text-center py-12">{t('nutrition.noData')}</p>
                    )}
                </div>
            </div>

            {/* ═══ Food Items List ══════════════════════════════════ */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-violet-500/10 border-violet-500/30 text-violet-400">
                        <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.foodItems')}</h2>
                </div>

                {loadingToday ? (
                    <div className="h-32 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                    </div>
                ) : todayNutrition?.food_items ? (
                    <div className="space-y-2">
                        {['breakfast', 'lunch', 'dinner', 'snack'].map(mealKey => {
                            const items = todayNutrition.food_items?.[mealKey] || [];
                            if (items.length === 0) return null;
                            const isExpanded = expandedMeals[mealKey];
                            const mealTotals = todayNutrition.meals[mealKey];

                            return (
                                <div key={mealKey} className="bg-dark-700/50 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => toggleMeal(mealKey)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/70 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: MEAL_COLORS[mealKey] }}
                                            />
                                            <span className="font-medium text-cream-100">
                                                {t(`nutrition.${mealKey}` as any)}
                                            </span>
                                            <span className="text-dark-300 text-sm">
                                                ({items.length} {lang === 'de' ? 'Artikel' : 'items'})
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-orange-400">{Math.round(mealTotals?.calories || 0)} kcal</span>
                                            <span className="text-sm text-red-400">P: {Math.round(mealTotals?.protein || 0)}g</span>
                                            {isExpanded ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {items.map((item: FoodItem, i: number) => (
                                                <div key={i} className="flex items-center justify-between py-2 px-3 bg-dark-800/50 rounded-lg text-sm">
                                                    <div>
                                                        <span className="text-cream-100">{item.name}</span>
                                                        {item.brand && <span className="text-dark-400 ml-2">({item.brand})</span>}
                                                        <span className="text-dark-400 ml-2">{item.amount}g</span>
                                                    </div>
                                                    <div className="flex gap-3 text-xs">
                                                        <span className="text-orange-400">{Math.round(item.calories)} kcal</span>
                                                        <span className="text-red-400">P: {item.protein}g</span>
                                                        <span className="text-yellow-400">C: {item.carbs}g</span>
                                                        <span className="text-emerald-400">F: {item.fat}g</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-dark-400 text-center py-8">{t('nutrition.noData')}</p>
                )}
            </div>

            {/* ═══ AI Analysis Section ══════════════════════════════ */}
            <div className="card-glass p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-purple-500/10 border-purple-500/30 text-purple-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.aiAnalysis')}</h2>
                    </div>
                    {!analysis && (
                        <button
                            onClick={fetchAnalysis}
                            disabled={loadingAnalysis}
                            className="btn-gold px-4 py-2 text-sm flex items-center gap-2"
                        >
                            {loadingAnalysis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {lang === 'de' ? 'Analyse starten' : 'Start Analysis'}
                        </button>
                    )}
                </div>

                {analysis ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <h3 className="text-amber-400 font-semibold text-sm mb-2">{t('nutrition.yesterdayTips')}</h3>
                            <p className="text-cream-200 text-sm leading-relaxed">{analysis.yesterday_analysis}</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                            <h3 className="text-emerald-400 font-semibold text-sm mb-2">{t('nutrition.todayTips')}</h3>
                            <p className="text-cream-200 text-sm leading-relaxed">{analysis.today_tips}</p>
                        </div>
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                            <h3 className="text-violet-400 font-semibold text-sm mb-2">{t('nutrition.overallAnalysis')}</h3>
                            <p className="text-cream-200 text-sm leading-relaxed">{analysis.overall_patterns}</p>
                        </div>
                    </div>
                ) : loadingAnalysis ? (
                    <div className="h-32 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                    </div>
                ) : (
                    <p className="text-dark-400 text-center py-8">
                        {lang === 'de' ? 'Klicke auf "Analyse starten" für KI-basierte Ernährungstipps' : 'Click "Start Analysis" for AI-powered nutrition tips'}
                    </p>
                )}
            </div>

            {/* ═══ Food Statistics ══════════════════════════════════ */}
            <div className="card-glass p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-blue-500/10 border-blue-500/30 text-blue-400">
                            <Award className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-cream-50">{t('nutrition.topFoods')}</h2>
                    </div>
                    <div className="flex gap-2">
                        {[7, 14, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setStatsDays(d)}
                                className={`px-3 py-1 text-xs rounded-lg transition-colors ${statsDays === d
                                    ? 'bg-gold-500 text-dark-900 font-semibold'
                                    : 'bg-dark-700 text-dark-300 hover:text-cream-100'
                                    }`}
                            >
                                {t(`nutrition.period${d}` as any)}
                            </button>
                        ))}
                    </div>
                </div>

                {loadingStats ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Top 10 Foods Bar Chart */}
                        <div>
                            <h3 className="text-sm font-medium text-cream-100 mb-3 flex items-center gap-2">
                                <UtensilsCrossed size={14} /> {t('nutrition.topFoods')}
                            </h3>
                            {stats.top_foods.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={stats.top_foods.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                                        <XAxis type="number" stroke="#666" fontSize={10} />
                                        <YAxis type="category" dataKey="name" stroke="#666" fontSize={10} width={80} tick={{ fontSize: 9 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: 12 }}
                                            formatter={(value) => [`${Number(value ?? 0)}x`, t('nutrition.times')]}
                                        />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-dark-400 text-sm">{t('nutrition.noData')}</p>}
                        </div>

                        {/* Top Protein Sources */}
                        <div>
                            <h3 className="text-sm font-medium text-cream-100 mb-3 flex items-center gap-2">
                                <Beef size={14} /> {t('nutrition.topProtein')}
                            </h3>
                            {stats.top_protein.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={stats.top_protein.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                                        <XAxis type="number" stroke="#666" fontSize={10} />
                                        <YAxis type="category" dataKey="name" stroke="#666" fontSize={10} width={80} tick={{ fontSize: 9 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: 12 }}
                                            formatter={(value: number) => [`${Math.round(value)}g`, t('dashboard.protein')]}
                                        />
                                        <Bar dataKey="protein_g" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-dark-400 text-sm">{t('nutrition.noData')}</p>}
                        </div>

                        {/* Top Calorie Items */}
                        <div>
                            <h3 className="text-sm font-medium text-cream-100 mb-3 flex items-center gap-2">
                                <Flame size={14} /> {t('nutrition.topCalories')}
                            </h3>
                            {stats.top_calories.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={stats.top_calories.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                                        <XAxis type="number" stroke="#666" fontSize={10} />
                                        <YAxis type="category" dataKey="name" stroke="#666" fontSize={10} width={80} tick={{ fontSize: 9 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: 12 }}
                                            formatter={(value: number) => [`${Math.round(value)} kcal`, t('dashboard.calories')]}
                                        />
                                        <Bar dataKey="calories" fill="#f97316" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-dark-400 text-sm">{t('nutrition.noData')}</p>}
                        </div>
                    </div>
                ) : (
                    <p className="text-dark-400 text-center py-12">{t('nutrition.noData')}</p>
                )}
            </div>

        </div>
    );
}
