import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/api';
import { UserPlus, Dumbbell, Eye, EyeOff } from 'lucide-react';

export default function RegisterForm() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            await registerUser(username, password);
            navigate('/login', { state: { registered: true } });
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
                    <p className="text-dark-300 mt-1 text-sm">Create your account</p>
                </div>

                {/* Card */}
                <form onSubmit={handleSubmit} className="card-glass p-6 sm:p-8 space-y-5">
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
                            placeholder="Choose a username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            minLength={3}
                            maxLength={50}
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-cream-200 mb-1.5">Password</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="input-dark pr-12"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={8}
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

                    <div>
                        <label className="block text-sm text-cream-200 mb-1.5">Confirm Password</label>
                        <input
                            type="password"
                            className="input-dark"
                            placeholder="Repeat password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2">
                        <UserPlus size={18} />
                        {loading ? 'Creating account…' : 'Create Account'}
                    </button>

                    <p className="text-center text-sm text-dark-300">
                        Already have an account?{' '}
                        <Link to="/login" className="text-gold-400 hover:text-gold-300 transition-colors font-medium">
                            Sign in
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
