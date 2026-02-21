import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveApiKey, saveYazioCredentials, updateLanguage } from '../api/api';
import type { UserInfo } from '../api/api';
import { Key, UtensilsCrossed, Eye, EyeOff, CheckCircle, AlertCircle, Shield, Globe } from 'lucide-react';
import { useLanguage } from '../i18n';
import type { Lang } from '../i18n';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

export default function SettingsPage() {
    const { user, refreshUser } = useOutletContext<LayoutContext>();
    const { t, lang } = useLanguage();

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

    // Language
    const [langMsg, setLangMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setKeyMsg(null); setSavingKey(true);
        try {
            await saveApiKey(apiKey);
            setKeyMsg({ type: 'success', text: t('settings.hevyUpdated') });
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
            setYazioMsg({ type: 'success', text: t('settings.yazioUpdated') });
            await refreshUser();
            setYazioEmail(''); setYazioPassword('');
        } catch (err: any) { setYazioMsg({ type: 'error', text: err.message }); }
        finally { setSavingYazio(false); }
    };

    const handleLanguageChange = async (newLang: Lang) => {
        setLangMsg(null);
        try {
            await updateLanguage(newLang);
            localStorage.setItem('lang', newLang);
            setLangMsg({ type: 'success', text: t('settings.languageUpdated') });
            await refreshUser();
        } catch (err: any) { setLangMsg({ type: 'error', text: err.message }); }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-cream-50">{t('settings.title')}</h1>
                <p className="text-dark-300 text-sm mt-1">{t('settings.subtitle')}</p>
            </div>

            {/* Account Info */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">{t('settings.account')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-dark-300">{t('settings.username')}</span>
                        <p className="text-cream-100 font-medium">{user?.username}</p>
                    </div>
                    <div>
                        <span className="text-dark-300">{t('settings.userId')}</span>
                        <p className="text-cream-100 font-mono text-xs mt-0.5">{user?.id}</p>
                    </div>
                </div>
            </div>

            {/* Language Picker */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Globe className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">{t('settings.languageTitle')}</h3>
                </div>
                <p className="text-dark-300 text-sm mb-4">{t('settings.languageDesc')}</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleLanguageChange('de')}
                        className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all cursor-pointer ${lang === 'de'
                            ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                            : 'bg-dark-700/40 border-dark-500/30 text-dark-300 hover:border-dark-400'
                            }`}>
                        🇩🇪 {t('settings.languageDe')}
                    </button>
                    <button
                        onClick={() => handleLanguageChange('en')}
                        className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all cursor-pointer ${lang === 'en'
                            ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                            : 'bg-dark-700/40 border-dark-500/30 text-dark-300 hover:border-dark-400'
                            }`}>
                        🇬🇧 {t('settings.languageEn')}
                    </button>
                </div>
                <Msg msg={langMsg} />
            </div>

            {/* Hevy API Key */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Key className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">{t('settings.hevyTitle')}</h3>
                    <StatusBadge connected={!!user?.has_hevy_key} />
                </div>
                <p className="text-dark-300 text-sm mb-4">
                    {t('settings.hevyDesc')}{' '}
                    <a href="https://api.hevyapp.com/account" target="_blank" rel="noopener noreferrer"
                        className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                        {t('settings.hevyLink')}
                    </a>.
                </p>
                <form onSubmit={handleSaveKey} className="space-y-4">
                    <input type="password" className="input-dark font-mono text-sm"
                        placeholder={user?.has_hevy_key ? t('settings.hevyPlaceholder') : 'hvy_xxxxxxxxxxxxxxxxxxxx'}
                        value={apiKey} onChange={e => setApiKey(e.target.value)} required />
                    <Msg msg={keyMsg} />
                    <button type="submit" disabled={savingKey}
                        className="btn-gold w-full flex items-center justify-center gap-2">
                        <Key size={16} />
                        {savingKey ? t('settings.saving') : user?.has_hevy_key ? t('settings.updateKey') : t('settings.saveKey')}
                    </button>
                </form>
            </div>

            {/* Yazio Credentials */}
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <UtensilsCrossed className="w-5 h-5 text-gold-400" />
                    <h3 className="text-lg font-semibold text-cream-50">{t('settings.yazioTitle')}</h3>
                    <StatusBadge connected={!!user?.has_yazio} />
                </div>
                <p className="text-dark-300 text-sm mb-4">
                    {t('settings.yazioDesc')}
                </p>
                <form onSubmit={handleSaveYazio} className="space-y-4">
                    <input type="email" className="input-dark text-sm"
                        placeholder={user?.has_yazio ? t('settings.yazioEmailPlaceholder') : 'your-yazio@email.com'}
                        value={yazioEmail} onChange={e => setYazioEmail(e.target.value)} required />
                    <div className="relative">
                        <input type={showYazioPw ? 'text' : 'password'} className="input-dark text-sm pr-12"
                            placeholder={user?.has_yazio ? t('settings.yazioPasswordPlaceholder') : 'Yazio password'}
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
                        {savingYazio ? t('settings.saving') : user?.has_yazio ? t('settings.updateYazio') : t('settings.saveYazio')}
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

function StatusBadge({ connected }: { connected: boolean }) {
    const { t } = useLanguage();
    return (
        <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${connected
            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
            }`}>
            {connected ? <><CheckCircle size={12} /> {t('settings.connected')}</> : <><AlertCircle size={12} /> {t('settings.notSet')}</>}
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
