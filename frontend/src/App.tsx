import { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';
import { isAuthenticated } from './api/api';
import './App.css';

type View = 'login' | 'register' | 'dashboard';

function App() {
    const [view, setView] = useState<View>('login');

    useEffect(() => {
        if (isAuthenticated()) {
            setView('dashboard');
        }
    }, []);

    const handleLoginSuccess = () => {
        setView('dashboard');
    };

    const handleRegisterSuccess = () => {
        setView('login');
    };

    const handleLogout = () => {
        setView('login');
    };

    return (
        <>
            {view === 'login' && (
                <LoginForm
                    onLoginSuccess={handleLoginSuccess}
                    onSwitchToRegister={() => setView('register')}
                />
            )}

            {view === 'register' && (
                <RegisterForm
                    onRegisterSuccess={handleRegisterSuccess}
                    onSwitchToLogin={() => setView('login')}
                />
            )}

            {view === 'dashboard' && (
                <Dashboard onLogout={handleLogout} />
            )}
        </>
    );
}

export default App;
