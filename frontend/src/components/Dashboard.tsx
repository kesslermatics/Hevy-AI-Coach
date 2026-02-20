import { useOutletContext } from 'react-router-dom';
import type { UserInfo } from '../api/api';
import { Dumbbell, TrendingUp, UtensilsCrossed, Brain, CheckCircle } from 'lucide-react';

type LayoutContext = { user: UserInfo | null; refreshUser: () => Promise<UserInfo> };

export default function Dashboard() {
    const { user } = useOutletContext<LayoutContext>();

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-cream-50">
                    Welcome back, <span className="text-gradient-gold">{user?.username}</span>
                </h1>
                <p className="text-dark-300 text-sm mt-1">Here's your coaching overview</p>
            </div>

            {/* Status overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatusCard
                    icon={<Dumbbell className="w-5 h-5" />}
                    title="Hevy Workouts"
                    connected={!!user?.has_hevy_key}
                    description={user?.has_hevy_key ? 'Connected & tracking' : 'Connect in Settings'}
                />
                <StatusCard
                    icon={<UtensilsCrossed className="w-5 h-5" />}
                    title="Yazio Nutrition"
                    connected={!!user?.has_yazio}
                    description={user?.has_yazio ? 'Connected & tracking' : 'Connect in Settings'}
                />
            </div>

            {/* AI Coaching placeholder */}
            <div className="card-glass p-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-700/20 border border-gold-500/30">
                    <Brain className="w-8 h-8 text-gold-400" />
                </div>
                <h2 className="text-xl font-bold text-cream-50">AI Coach</h2>
                <p className="text-dark-300 text-sm max-w-md mx-auto">
                    Your personal AI coach will analyze your workouts and nutrition
                    to give you live advice and optimize your training.
                </p>
                <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 text-gold-400 text-sm font-medium px-4 py-2 rounded-full">
                    <TrendingUp size={14} />
                    Coming soon
                </div>
            </div>

            {/* Quick stats placeholder */}
            <div className="grid grid-cols-3 gap-3">
                <QuickStat label="Workouts" value="—" />
                <QuickStat label="Calories" value="—" />
                <QuickStat label="Streak" value="—" />
            </div>
        </div>
    );
}

/* ── Helpers ─────────────────────────────────────────── */

function StatusCard({ icon, title, connected, description }: {
    icon: React.ReactNode; title: string; connected: boolean; description: string;
}) {
    return (
        <div className="card-glass p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? 'bg-green-500/10 text-green-400' : 'bg-dark-600 text-dark-300'
                }`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-cream-50">{title}</h3>
                    {connected && <CheckCircle size={14} className="text-green-400" />}
                </div>
                <p className="text-xs text-dark-300 mt-0.5">{description}</p>
            </div>
        </div>
    );
}

function QuickStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="card-glass p-4 text-center">
            <p className="text-xl font-bold text-cream-50">{value}</p>
            <p className="text-xs text-dark-300 mt-1">{label}</p>
        </div>
    );
}
