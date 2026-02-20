import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveApiKey, saveYazioCredentials } from '../api/api';
import type { UserInfo } from '../api/api';
import { Key, UtensilsCrossed, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from 'lucide-react';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

export default function SettingsPage() {
    const { user, refreshUser } = useOutletContext<LayoutContext>();

    // Hevy
    const [apiKey, setApiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);
    const [keyMsg, setKeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Yazio
    const [yazioEmail, setYazioEmail] = useState('');
    const [yazioPassword, setYazioPassword] = useState('');
    const [showYazioPw, setShowYazioPw] = useState(false);
    const [savingYazio, setSavingYazio] = useState(false);
    const [yazioMsg, setYazioMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setKeyMsg(null); setSavingKey(true);
        try {
            await saveApiKey(apiKey);
            setKeyMsg({ type: 'success', text: 'Hevy API Key updated!' });
            await refreshUser();
            setApiKey('');
        } catch (err: any) { setKeyMsg({ type: 'error', text: err.message }); }
        finally { setSavingKey(false); }
    };

    const handleSaveYazio = async (e: React.FormEvent) => {
        e.preventDefault();
        setYazioMsg(null); setSavingYazio(true);
        try {
            await saveYazioCredentials(yazioEmail, yazioPassword);
            setYazioMsg({ type: 'success', text: 'Yazio credentials updated!' });
            await refreshUser();
            setYazioEmail(''); setYazioPassword('');
        } catch (err: any) { setYazioMsg({ type: 'error', text: err.message }); }
        finally { setSavingYazio(false); }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-cream-50">Settings</h1>
                <p className="text-dark-300 text-sm mt-1">Manage your connected accounts and credentials</p>
            </div>

            {/* Account Info */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">Account</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-dark-300">Username</span>
                        <p className="text-cream-100 font-medium">{user?.username}</p>
                    </div>
                    <div>
                        <span className="text-dark-300">User ID</span>
                        <p className="text-cream-100 font-mono text-xs mt-0.5">{user?.id}</p>
                    </div>
                </div>
            </div>

            {/* Hevy API Key */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Key className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">Hevy API Key</h3>
                    <StatusBadge connected={!!user?.has_hevy_key} />
                </div>
                <p className="text-dark-300 text-sm mb-4">
                    Your key is encrypted before storage. Find it in your{' '}
                    <a href="https://api.hevyapp.com/account" target="_blank" rel="noopener noreferrer"
                        className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                        Hevy Developer Settings
                    </a>.
                </p>
                <form onSubmit={handleSaveKey} className="space-y-4">
                    <input type="password" className="input-dark font-mono text-sm"
                        placeholder={user?.has_hevy_key ? '••••••••  (enter new key to update)' : 'hvy_xxxxxxxxxxxxxxxxxxxx'}
                        value={apiKey} onChange={e => setApiKey(e.target.value)} required />
                    <Msg msg={keyMsg} />
                    <button type="submit" disabled={savingKey}
                        className="btn-gold w-full flex items-center justify-center gap-2">
                        <Key size={16} />
                        {savingKey ? 'Saving…' : user?.has_hevy_key ? 'Update API Key' : 'Save API Key'}
                    </button>
                </form>
            </div>

            {/* Yazio Credentials */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <UtensilsCrossed className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">Yazio Account</h3>
                    <StatusBadge connected={!!user?.has_yazio} />
                </div>
                <p className="text-dark-300 text-sm mb-4">
                    Your Yazio credentials are encrypted and only used to fetch your nutrition data.
                </p>
                <form onSubmit={handleSaveYazio} className="space-y-4">
                    <input type="email" className="input-dark text-sm"
                        placeholder={user?.has_yazio ? '••••••••  (enter new email to update)' : 'your-yazio@email.com'}
                        value={yazioEmail} onChange={e => setYazioEmail(e.target.value)} required />
                    <div className="relative">
                        <input type={showYazioPw ? 'text' : 'password'} className="input-dark text-sm pr-12"
                            placeholder={user?.has_yazio ? '••••••••  (enter new password to update)' : 'Yazio password'}
                            value={yazioPassword} onChange={e => setYazioPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowYazioPw(!showYazioPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-gold-400 transition-colors">
                            {showYazioPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <Msg msg={yazioMsg} />
                    <button type="submit" disabled={savingYazio}
                        className="btn-gold w-full flex items-center justify-center gap-2">
                        <UtensilsCrossed size={16} />
                        {savingYazio ? 'Saving…' : user?.has_yazio ? 'Update Yazio Login' : 'Save Yazio Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

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
