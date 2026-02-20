import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, saveApiKey, saveYazioCredentials, logoutUser, isAuthenticated } from '../api/api';
import type { UserInfo } from '../api/api';
import { Dumbbell, Key, LogOut, CheckCircle, AlertCircle, Loader2, Shield, UtensilsCrossed, Eye, EyeOff } from 'lucide-react';

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // Hevy API Key
    const [apiKey, setApiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);
    const [keyMsg, setKeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Yazio Credentials
    const [yazioEmail, setYazioEmail] = useState('');
    const [yazioPassword, setYazioPassword] = useState('');
    const [showYazioPw, setShowYazioPw] = useState(false);
    const [savingYazio, setSavingYazio] = useState(false);
    const [yazioMsg, setYazioMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (!isAuthenticated()) { navigate('/login'); return; }
        getMe()
            .then(setUser)
            .catch(() => { logoutUser(); navigate('/login'); })
            .finally(() => setLoadingUser(false));
    }, [navigate]);

    const handleSaveKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setKeyMsg(null); setSavingKey(true);
        try {
            await saveApiKey(apiKey);
            setKeyMsg({ type: 'success', text: 'Hevy API Key saved!' });
            setUser(await getMe());
            setApiKey('');
        } catch (err: any) { setKeyMsg({ type: 'error', text: err.message }); }
        finally { setSavingKey(false); }
    };

    const handleSaveYazio = async (e: React.FormEvent) => {
        e.preventDefault();
        setYazioMsg(null); setSavingYazio(true);
        try {
            await saveYazioCredentials(yazioEmail, yazioPassword);
            setYazioMsg({ type: 'success', text: 'Yazio credentials saved!' });
            setUser(await getMe());
            setYazioEmail(''); setYazioPassword('');
        } catch (err: any) { setYazioMsg({ type: 'error', text: err.message }); }
        finally { setSavingYazio(false); }
    };

    const handleLogout = () => { logoutUser(); navigate('/login'); };

    if (loadingUser) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex flex-col">
            {/* Header */}
            <header className="border-b border-dark-500/50 bg-dark-800/60 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-dark-900" />
                        </div>
                        <span className="text-lg font-bold text-gradient-gold hidden sm:inline">HevyCoach AI</span>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-dark-300 hover:text-red-400 transition-colors cursor-pointer">
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-6">

                {/* Welcome */}
                <div className="card-glass p-6">
                    <div className="flex items-center gap-3 mb-1">
                        <Shield className="w-5 h-5 text-gold-400" />
                        <h2 className="text-lg font-semibold text-cream-50">
                            Welcome, <span className="text-gold-400">{user?.username}</span>
                        </h2>
                    </div>
                    <p className="text-dark-300 text-sm ml-8">
                        Connect your Hevy and Yazio accounts below to get AI coaching.
                    </p>
                </div>

                {/* ── Hevy API Key ────────────────────────── */}
                <div className="card-glass p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Key className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-cream-50">Hevy API Key</h3>
                        <StatusBadge connected={!!user?.has_hevy_key} />
                    </div>
                    <p className="text-dark-300 text-sm mb-4">
                        Your key is <span className="text-cream-200">encrypted</span> before storage.
                        Find it in your{' '}
                        <a href="https://api.hevyapp.com/account" target="_blank" rel="noopener noreferrer"
                            className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                            Hevy Developer Settings
                        </a>.
                    </p>
                    <form onSubmit={handleSaveKey} className="space-y-4">
                        <input type="password" className="input-dark font-mono text-sm"
                            placeholder="hvy_xxxxxxxxxxxxxxxxxxxx" value={apiKey}
                            onChange={e => setApiKey(e.target.value)} required />
                        <Msg msg={keyMsg} />
                        <button type="submit" disabled={savingKey} className="btn-gold w-full flex items-center justify-center gap-2">
                            <Key size={16} />
                            {savingKey ? 'Saving…' : user?.has_hevy_key ? 'Update API Key' : 'Save API Key'}
                        </button>
                    </form>
                </div>

                {/* ── Yazio Credentials ──────────────────── */}
                <div className="card-glass p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <UtensilsCrossed className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-cream-50">Yazio Account</h3>
                        <StatusBadge connected={!!user?.has_yazio} />
                    </div>
                    <p className="text-dark-300 text-sm mb-4">
                        Your Yazio login is <span className="text-cream-200">encrypted</span> and only used to fetch your nutrition data.
                    </p>
                    <form onSubmit={handleSaveYazio} className="space-y-4">
                        <input type="email" className="input-dark text-sm"
                            placeholder="your-yazio@email.com" value={yazioEmail}
                            onChange={e => setYazioEmail(e.target.value)} required />
                        <div className="relative">
                            <input type={showYazioPw ? 'text' : 'password'} className="input-dark text-sm pr-12"
                                placeholder="Yazio password" value={yazioPassword}
                                onChange={e => setYazioPassword(e.target.value)} required />
                            <button type="button" onClick={() => setShowYazioPw(!showYazioPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-gold-400 transition-colors">
                                {showYazioPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <Msg msg={yazioMsg} />
                        <button type="submit" disabled={savingYazio} className="btn-gold w-full flex items-center justify-center gap-2">
                            <UtensilsCrossed size={16} />
                            {savingYazio ? 'Saving…' : user?.has_yazio ? 'Update Yazio Login' : 'Save Yazio Login'}
                        </button>
                    </form>
                </div>

                {/* Coming soon */}
                <div className="card-glass p-6 text-center">
                    <p className="text-dark-300 text-sm">
                        🚀 <span className="text-cream-200">AI Coaching</span> features coming soon…
                    </p>
                </div>
            </main>
        </div>
    );
}

/* ── Small helper components ─────────────────────────── */

function StatusBadge({ connected }: { connected: boolean }) {
    return (
        <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${connected
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
            }`}>
            {connected ? <><CheckCircle size={12} /> Connected</> : <><AlertCircle size={12} /> Not set</>}
        </span>
    );
}

function Msg({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
    if (!msg) return null;
    return (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
            {msg.text}
        </div>
    );
}
