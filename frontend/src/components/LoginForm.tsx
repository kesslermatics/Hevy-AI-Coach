import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { loginUser } from '../api/api';
import { LogIn, Dumbbell, Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const justRegistered = (location.state as any)?.registered;

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await loginUser(username, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-700 mb-4">
                        <Dumbbell className="w-8 h-8 text-dark-900" />
                    </div>
                    <h1 className="text-2xl font-bold text-gradient-gold">HevyCoach AI</h1>
                    <p className="text-dark-300 mt-1 text-sm">Sign in to your account</p>
                </div>

                {/* Card */}
                <form onSubmit={handleSubmit} className="card-glass p-6 sm:p-8 space-y-5">
                    {justRegistered && (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 text-sm">
                            Account created! Please sign in.
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-cream-200 mb-1.5">Username</label>
                        <input
                            type="text"
                            className="input-dark"
                            placeholder="Enter your username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-cream-200 mb-1.5">Password</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="input-dark pr-12"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-300 hover:text-gold-400 transition-colors"
                            >
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2">
                        <LogIn size={18} />
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>

                    <p className="text-center text-sm text-dark-300">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-gold-400 hover:text-gold-300 transition-colors font-medium">
                            Create one
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
