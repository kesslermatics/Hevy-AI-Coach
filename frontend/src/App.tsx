import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';
import ProgressTab from './components/ProgressTab';
import AchievementsTab from './components/AchievementsTab';
import ReportsTab from './components/ReportsTab';
import SetupPage from './components/SetupPage';
import SettingsPage from './components/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        {/* Protected routes (AppLayout checks auth + redirects to /setup if needed) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/progress" element={<ProgressTab />} />
          <Route path="/achievements" element={<AchievementsTab />} />
          <Route path="/reports" element={<ReportsTab />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
