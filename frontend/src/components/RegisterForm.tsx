import { useState } from 'react';
import { register } from '../api/api';

interface RegisterFormProps {
    onRegisterSuccess: () => void;
    onSwitchToLogin: () => void;
}

const RegisterForm = ({ onRegisterSuccess, onSwitchToLogin }: RegisterFormProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            await register({ username, password });
            setSuccess('Registration successful! You can now log in.');
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => onRegisterSuccess(), 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
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
                        Create Account
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
                                minLength={3}
                                maxLength={50}
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
                                minLength={8}
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="label">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                className="input-field"
                                required
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
                                    Creating Account...
                                </span>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="divider-gold my-6" />

                    <p className="text-center text-base-400 text-sm">
                        Already have an account?{' '}
                        <button onClick={onSwitchToLogin} className="link-gold font-medium">
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterForm;
