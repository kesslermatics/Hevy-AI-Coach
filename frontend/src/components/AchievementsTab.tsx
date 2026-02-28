import { useEffect, useState } from 'react';
import { getAchievements } from '../api/api';
import type { Achievement } from '../api/api';
import { Loader2, Trophy, Lock, Filter, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n';

const CATEGORY_ICONS: Record<string, string> = {
    training: '🏋️',
    strength: '💪',
    nutrition: '🥗',
    consistency: '🔥',
    body: '⚖️',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    training: { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400' },
    strength: { bg: 'bg-purple-500/10', border: 'border-purple-500/25', text: 'text-purple-400' },
    nutrition: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400' },
    consistency: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400' },
    body: { bg: 'bg-rose-500/10', border: 'border-rose-500/25', text: 'text-rose-400' },
};

export default function AchievementsTab() {
    const { t, lang } = useLanguage();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [catFilter, setCatFilter] = useState<string | null>(null);
    const [showLocked, setShowLocked] = useState(true);

    useEffect(() => {
        getAchievements()
            .then(setAchievements)
            .catch((e: any) => setError(e.message || 'Failed'))
            .finally(() => setLoading(false));
    }, []);

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const categories = [...new Set(achievements.map(a => a.category))];

    const filtered = achievements
        .filter(a => !catFilter || a.category === catFilter)
        .filter(a => showLocked || a.unlocked)
        .sort((a, b) => {
            // Unlocked first, then by progress desc
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            return (b.progress / b.target) - (a.progress / a.target);
        });

    if (loading) return (
        <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin mx-auto" />
            <p className="text-dark-300 text-sm">Loading achievements…</p>
        </div>
    );

    if (error) return (
        <div className="max-w-2xl mx-auto py-16 text-center">
            <p className="text-red-400 text-sm">{error}</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-cream-50 flex items-center gap-2.5">
                        <Trophy className="w-6 h-6 text-gold-400" />
                        {t('achievements.title')}
                    </h1>
                    <p className="text-dark-300 text-sm mt-1">
                        {t('achievements.unlocked').replace('{n}', String(unlockedCount))} / {achievements.length}
                    </p>
                </div>

                {/* Progress circle */}
                <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                        <circle cx="28" cy="28" r="22" fill="none" stroke="#D4A017" strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${(unlockedCount / Math.max(achievements.length, 1)) * 138.2} 138.2`}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gold-400">
                        {Math.round((unlockedCount / Math.max(achievements.length, 1)) * 100)}%
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-dark-700/50 rounded-lg p-1 border border-dark-500/20">
                    <Filter size={12} className="text-dark-400 ml-2" />
                    <button onClick={() => setCatFilter(null)}
                        className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer ${!catFilter ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30' : 'text-dark-300 hover:text-cream-100'}`}>
                        {lang === 'de' ? 'Alle' : 'All'}
                    </button>
                    {categories.map(c => (
                        <button key={c} onClick={() => setCatFilter(c === catFilter ? null : c)}
                            className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${catFilter === c
                                ? `${CATEGORY_COLORS[c]?.bg || ''} ${CATEGORY_COLORS[c]?.text || 'text-cream-100'} border ${CATEGORY_COLORS[c]?.border || ''}`
                                : 'text-dark-300 hover:text-cream-100'}`}>
                            <span>{CATEGORY_ICONS[c] || '🏅'}</span>
                            {t(`achievements.${c}` as any) || c}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowLocked(!showLocked)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ml-auto ${showLocked
                        ? 'bg-dark-700/50 border-dark-500/20 text-dark-300'
                        : 'bg-gold-500/15 border-gold-500/30 text-gold-300'}`}>
                    {showLocked ? (lang === 'de' ? 'Gesperrte ausblenden' : 'Hide locked') : (lang === 'de' ? 'Alle zeigen' : 'Show all')}
                </button>
            </div>

            {/* Achievements grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(a => (
                    <AchievementCard key={a.id} achievement={a} lang={lang} />
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="card-glass p-8 text-center">
                    <p className="text-dark-300 text-sm">{lang === 'de' ? 'Keine Achievements in dieser Kategorie.' : 'No achievements in this category.'}</p>
                </div>
            )}
        </div>
    );
}

/* ── Achievement Card ─────────────────────────────────── */
function AchievementCard({ achievement: a, lang }: { achievement: Achievement; lang: string }) {
    const colors = CATEGORY_COLORS[a.category] || CATEGORY_COLORS.training;
    const progress = Math.min(a.progress / Math.max(a.target, 1), 1);

    return (
        <div className={`rounded-xl border p-4 transition-all ${a.unlocked
            ? `${colors.bg} ${colors.border} shadow-lg`
            : 'bg-dark-800/40 border-dark-500/20 opacity-60'}`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${a.unlocked
                    ? `${colors.bg} border ${colors.border}`
                    : 'bg-dark-700/50 border border-dark-500/30'}`}>
                    {a.unlocked ? a.icon : <Lock size={16} className="text-dark-400" />}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Name */}
                    <div className="flex items-center gap-1.5">
                        <h3 className={`text-sm font-semibold truncate ${a.unlocked ? 'text-cream-50' : 'text-dark-300'}`}>
                            {lang === 'de' ? a.name_de : a.name_en}
                        </h3>
                        {a.unlocked && <Sparkles size={12} className={colors.text} />}
                    </div>

                    {/* Description */}
                    <p className={`text-[11px] leading-relaxed mt-0.5 ${a.unlocked ? 'text-cream-300' : 'text-dark-400'}`}>
                        {lang === 'de' ? a.desc_de : a.desc_en}
                    </p>

                    {/* Progress bar */}
                    {!a.unlocked && (
                        <div className="mt-2 space-y-1">
                            <div className="w-full h-1.5 rounded-full bg-dark-700 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-dark-400 to-dark-300"
                                    style={{ width: `${progress * 100}%` }} />
                            </div>
                            <p className="text-[9px] text-dark-400">
                                {a.progress} / {a.target}
                            </p>
                        </div>
                    )}

                    {/* Unlocked date */}
                    {a.unlocked && a.unlocked_date && (
                        <p className="text-[10px] text-dark-400 mt-1.5">
                            {new Date(a.unlocked_date).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
