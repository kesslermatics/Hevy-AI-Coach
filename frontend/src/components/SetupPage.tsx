import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { saveApiKey, saveYazioCredentials } from '../api/api';
import type { UserInfo } from '../api/api';
import { Key, UtensilsCrossed, Eye, EyeOff, ArrowRight, Dumbbell, CheckCircle } from 'lucide-react';
import { useLanguage } from '../i18n';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

type Step = 'hevy' | 'yazio';

function getInitialStep(user: UserInfo | null): Step {
    if (!user?.has_hevy_key) return 'hevy';
    return 'yazio';
}

export default function SetupPage() {
    const navigate = useNavigate();
    const { user, refreshUser } = useOutletContext<LayoutContext>();
    const { t } = useLanguage();

    const [step, setStep] = useState<Step>(getInitialStep(user));

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

    const handleSaveHevy = async (e: React.FormEvent) => {
        e.preventDefault();
        setKeyMsg(null); setSavingKey(true);
        try {
            await saveApiKey(apiKey);
            setKeyMsg({ type: 'success', text: t('setup.hevySaved') });
            await refreshUser();
            setApiKey('');
            setTimeout(() => setStep('yazio'), 800);
        } catch (err: any) { setKeyMsg({ type: 'error', text: err.message }); }
        finally { setSavingKey(false); }
    };

    const handleSaveYazio = async (e: React.FormEvent) => {
        e.preventDefault();
        setYazioMsg(null); setSavingYazio(true);
        try {
            await saveYazioCredentials(yazioEmail, yazioPassword);
            setYazioMsg({ type: 'success', text: t('setup.yazioConnected') });
            await refreshUser();
            setYazioEmail(''); setYazioPassword('');
            setTimeout(() => navigate('/dashboard'), 800);
        } catch (err: any) { setYazioMsg({ type: 'error', text: err.message }); }
        finally { setSavingYazio(false); }
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            {/* Welcome header */}
            <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-700 mb-4">
                    <Dumbbell className="w-8 h-8 text-dark-900" />
                </div>
                <h1 className="text-2xl font-bold text-cream-50">{t('setup.title')}</h1>
                <p className="text-dark-300 mt-1 text-sm">{t('setup.subtitle')}</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3 mb-2">
                <StepDot active={step === 'hevy'} done={!!user?.has_hevy_key} label="1" />
                <div className="w-8 h-px bg-dark-400" />
                <StepDot active={step === 'yazio'} done={!!user?.has_yazio} label="2" />
            </div>

            {/* ── Step 1: Hevy ─────────────────────────── */}
            {step === 'hevy' && (
                <div className="card-glass p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-cream-50">{t('setup.hevyTitle')}</h3>
                    </div>
                    <p className="text-dark-300 text-sm">
                        {t('setup.hevyDesc')}{' '}
                        <a href="https://api.hevyapp.com/account" target="_blank" rel="noopener noreferrer"
                            className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
                            {t('setup.hevyLink')}
                        </a>.
                        {' '}{t('setup.hevyEncrypted')}.
                    </p>
                    <form onSubmit={handleSaveHevy} className="space-y-4">
                        <input type="password" className="input-dark font-mono text-sm"
                            placeholder="hvy_xxxxxxxxxxxxxxxxxxxx" value={apiKey}
                            onChange={e => setApiKey(e.target.value)} required />
                        <Msg msg={keyMsg} />
                        <button type="submit" disabled={savingKey}
                            className="btn-gold w-full flex items-center justify-center gap-2">
                            {savingKey ? t('settings.saving') : <><span>{t('setup.saveAndContinue')}</span><ArrowRight size={16} /></>}
                        </button>
                    </form>
                    {user?.has_hevy_key && (
                        <button onClick={() => setStep('yazio')}
                            className="w-full text-center text-sm text-gold-400 hover:text-gold-300 transition-colors cursor-pointer">
                            {t('setup.skipToYazio')}
                        </button>
                    )}
                </div>
            )}

            {/* ── Step 2: Yazio ────────────────────────── */}
            {step === 'yazio' && (
                <div className="card-glass p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <UtensilsCrossed className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-cream-50">{t('setup.yazioTitle')}</h3>
                    </div>
                    <p className="text-dark-300 text-sm">
                        {t('setup.yazioDesc')}{' '}
                        <span className="text-cream-200">{t('setup.hevyEncrypted')}</span>.
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
                        <button type="submit" disabled={savingYazio}
                            className="btn-gold w-full flex items-center justify-center gap-2">
                            {savingYazio ? t('settings.saving') : <><span>{t('setup.connectAndStart')}</span><ArrowRight size={16} /></>}
                        </button>
                    </form>
                    <button onClick={() => setStep('hevy')}
                        className="w-full text-center text-sm text-dark-300 hover:text-cream-100 transition-colors cursor-pointer">
                        {t('setup.backToHevy')}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
    return (
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${done
            ? 'bg-green-500/20 border-green-500 text-green-400'
            : active
                ? 'bg-gold-500/20 border-gold-500 text-gold-400'
                : 'bg-dark-700 border-dark-400 text-dark-300'
            }`}>
            {done ? <CheckCircle size={16} /> : label}
        </div>
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
