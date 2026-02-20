import { useState } from 'react';
import { login } from '../api/api';

interface LoginFormProps {
    onLoginSuccess: () => void;
    onSwitchToRegister: () => void;
}

const LoginForm = ({ onLoginSuccess, onSwitchToRegister }: LoginFormProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login({ username, password });
            onLoginSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gradient-gold mb-2">HevyCoach AI</h1>
                    <p className="text-base-400">Your intelligent fitness companion</p>
                </div>

                {/* Form Card */}
                <div className="card glow-gold">
                    <h2 className="text-2xl font-semibold text-base-100 mb-6 text-center">
                        Welcome Back
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="username" className="label">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                className="input-field"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="input-field"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-error-500/10 border border-error-500/30 rounded-lg text-error-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="divider-gold my-6" />

                    <p className="text-center text-base-400 text-sm">
                        Don't have an account?{' '}
                        <button onClick={onSwitchToRegister} className="link-gold font-medium">
                            Create one
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;
