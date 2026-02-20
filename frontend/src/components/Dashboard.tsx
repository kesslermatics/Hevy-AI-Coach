import { useState, useEffect } from 'react';
import { getCurrentUser, updateApiKey, deleteApiKey, logout } from '../api/api';
import type { UserResponse } from '../api/api';

interface DashboardProps {
    onLogout: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
    const [user, setUser] = useState<UserResponse | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const userData = await getCurrentUser();
            setUser(userData);
        } catch (err) {
            setError('Failed to load user data');
            if (err instanceof Error && err.message.includes('401')) {
                handleLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveApiKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!apiKey.trim()) {
            setError('Please enter an API key');
            return;
        }

        setSaving(true);

        try {
            await updateApiKey(apiKey);
            setSuccess('API key saved successfully!');
            setApiKey('');
            await fetchUserData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save API key');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteApiKey = async () => {
        setError('');
        setSuccess('');

        if (!confirm('Are you sure you want to remove your API key?')) {
            return;
        }

        setSaving(true);

        try {
            await deleteApiKey();
            setSuccess('API key removed successfully');
            await fetchUserData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove API key');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        onLogout();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-gold-500 mx-auto mb-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-base-400">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-base-800 bg-base-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-xl font-bold text-gradient-gold">HevyCoach AI</h1>
                        <div className="flex items-center gap-4">
                            <span className="text-base-400 text-sm hidden sm:block">
                                Welcome, <span className="text-gold-400 font-medium">{user?.username}</span>
                            </span>
                            <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-base-100 mb-2">Dashboard</h2>
                    <p className="text-base-400">Manage your account and Hevy API connection</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Account Status Card */}
                    <div className="card-elevated">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-base-100">Account Status</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-3 border-b border-base-800">
                                <span className="text-base-400">Username</span>
                                <span className="text-base-100 font-medium">{user?.username}</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="text-base-400">Hevy API</span>
                                {user?.has_api_key ? (
                                    <span className="flex items-center gap-2 text-success-400">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Connected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-base-500">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Not Connected
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* API Key Card */}
                    <div className="card-elevated">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center">
                                <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-base-100">Hevy API Key</h3>
                        </div>

                        <p className="text-base-400 text-sm mb-4">
                            Connect your Hevy account to enable workout sync and AI coaching features.
                        </p>

                        <form onSubmit={handleSaveApiKey} className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={user?.has_api_key ? "Enter new API key to update" : "Enter your Hevy API key"}
                                    className="input-field"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-error-500/10 border border-error-500/30 rounded-lg text-error-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-success-500/10 border border-success-500/30 rounded-lg text-success-400 text-sm">
                                    {success}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary flex-1"
                                >
                                    {saving ? 'Saving...' : 'Save Key'}
                                </button>

                                {user?.has_api_key && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteApiKey}
                                        disabled={saving}
                                        className="px-4 py-3 bg-error-500/10 text-error-400 font-medium rounded-lg border border-error-500/30 transition-all hover:bg-error-500/20 disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Coming Soon Section */}
                <div className="mt-8 card border-gold-500/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-base-100">Coming Soon</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { icon: '📊', title: 'Workout Sync', desc: 'Auto-sync from Hevy' },
                            { icon: '🤖', title: 'AI Analysis', desc: 'Smart training insights' },
                            { icon: '💡', title: 'Coaching', desc: 'Personalized advice' },
                            { icon: '📈', title: 'Progress', desc: 'Track your gains' },
                        ].map((feature) => (
                            <div key={feature.title} className="p-4 bg-base-800/50 rounded-xl border border-base-700/50">
                                <span className="text-2xl mb-2 block">{feature.icon}</span>
                                <h4 className="font-medium text-base-200 mb-1">{feature.title}</h4>
                                <p className="text-sm text-base-500">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
