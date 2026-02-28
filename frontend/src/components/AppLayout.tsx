import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getMe, logoutUser, isAuthenticated } from '../api/api';
import type { UserInfo } from '../api/api';
import { Dumbbell, LogOut, Home, Settings, Loader2, TrendingUp, Trophy, BarChart3 } from 'lucide-react';
import { LanguageContext } from '../i18n';
import { useLanguage } from '../i18n';
import type { Lang } from '../i18n';

export default function AppLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useState<Lang>('de');

    const refreshUser = async () => {
        const u = await getMe();
        setUser(u);
        setLang(u.language || 'de');
        return u;
    };

    useEffect(() => {
        if (!isAuthenticated()) { navigate('/login'); return; }
        refreshUser()
            .then(u => {
                // If credentials or goal are missing and not already on setup page → redirect
                const needsSetup = !u.has_hevy_key || !u.has_yazio;
                if (needsSetup && location.pathname !== '/setup') {
                    navigate('/setup');
                }
            })
            .catch(() => { logoutUser(); navigate('/login'); })
            .finally(() => setLoading(false));
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = () => { logoutUser(); navigate('/login'); };

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            </div>
        );
    }

    return (
        <LanguageContext.Provider value={lang}>
            <div className="min-h-dvh flex flex-col">
                {/* Header */}
                <header className="border-b border-dark-500/50 bg-dark-800/60 backdrop-blur-md sticky top-0 z-50">
                    <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-dark-900" />
                            </div>
                            <span className="text-lg font-bold text-gradient-gold hidden sm:inline">AI Coach</span>
                        </div>

                        <NavItems onLogout={handleLogout} />
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-10">
                    <Outlet context={{ user, refreshUser }} />
                </main>
            </div>
        </LanguageContext.Provider>
    );
}

function NavItems({ onLogout }: { onLogout: () => void }) {
    const { t } = useLanguage();
    return (
        <div className="flex items-center gap-1">
            <NavLink to="/dashboard"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'text-gold-400 bg-dark-700' : 'text-dark-300 hover:text-cream-100'}`
                }>
                <Home size={16} />
                <span className="hidden sm:inline">{t('nav.home')}</span>
            </NavLink>
            <NavLink to="/progress"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'text-gold-400 bg-dark-700' : 'text-dark-300 hover:text-cream-100'}`
                }>
                <TrendingUp size={16} />
                <span className="hidden sm:inline">{t('tabs.progress')}</span>
            </NavLink>
            <NavLink to="/achievements"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'text-gold-400 bg-dark-700' : 'text-dark-300 hover:text-cream-100'}`
                }>
                <Trophy size={16} />
                <span className="hidden sm:inline">{t('tabs.achievements')}</span>
            </NavLink>
            <NavLink to="/reports"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'text-gold-400 bg-dark-700' : 'text-dark-300 hover:text-cream-100'}`
                }>
                <BarChart3 size={16} />
                <span className="hidden sm:inline">{t('tabs.reports')}</span>
            </NavLink>
            <NavLink to="/settings"
                className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'text-gold-400 bg-dark-700' : 'text-dark-300 hover:text-cream-100'}`
                }>
                <Settings size={16} />
                <span className="hidden sm:inline">{t('nav.settings')}</span>
            </NavLink>
            <button onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-dark-300 hover:text-red-400 transition-colors cursor-pointer ml-1">
                <LogOut size={16} />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
        </div>
    );
}
