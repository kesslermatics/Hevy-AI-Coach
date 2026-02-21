/**
 * API utility for communicating with the FastAPI backend.
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://hevy-ai-coach-production.up.railway.app';

/* ── Token helpers ──────────────────────────────────────── */

export const getToken  = (): string | null => localStorage.getItem('token');
export const setToken  = (t: string): void => { localStorage.setItem('token', t); };
export const removeToken = (): void        => { localStorage.removeItem('token'); };
export const isAuthenticated = (): boolean => getToken() !== null;

/* ── Generic request ────────────────────────────────────── */

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `Error ${res.status}`);
  }

  return res.json();
}

/* ── Auth endpoints ─────────────────────────────────────── */

export const registerUser = (username: string, password: string) =>
  apiRequest<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const loginUser = async (username: string, password: string) => {
  const data = await apiRequest<{ access_token: string; token_type: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  return data;
};

export const logoutUser = () => { removeToken(); };

/* ── User endpoints ─────────────────────────────────────── */

export interface UserInfo {
  id: string;
  username: string;
  has_hevy_key: boolean;
  has_yazio: boolean;
  current_goal: string | null;
  target_weight: number | null;
}

export const getMe = () => apiRequest<UserInfo>('/user/me');

export const saveApiKey = (hevy_api_key: string) =>
  apiRequest<{ message: string; has_api_key: boolean }>('/user/api-key', {
    method: 'POST',
    body: JSON.stringify({ hevy_api_key }),
  });

export const saveYazioCredentials = (yazio_email: string, yazio_password: string) =>
  apiRequest<{ message: string; has_yazio: boolean }>('/user/yazio', {
    method: 'POST',
    body: JSON.stringify({ yazio_email, yazio_password }),
  });

/* ── Goal endpoints ─────────────────────────────────────── */

export const saveGoal = (current_goal: string, target_weight?: number | null) =>
  apiRequest<{ message: string; current_goal: string; target_weight: number | null }>('/user/goal', {
    method: 'POST',
    body: JSON.stringify({ current_goal, target_weight: target_weight ?? null }),
  });

/* ── Briefing endpoints ─────────────────────────────────── */

export interface NutritionReview {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export interface ExerciseHistory {
  date: string;
  best_set: string;
  volume_kg: number;
}

export interface ExerciseReview {
  name: string;
  muscle_group: string;
  best_set: string;
  total_volume_kg: number;
  rank: string;
  rank_index: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  history: ExerciseHistory[];
  feedback: string;
}

export interface LastSession {
  title: string;
  date: string;
  duration_min: number | null;
  overall_feedback: string;
  exercises: ExerciseReview[];
}

export interface NextSession {
  title: string;
  reasoning: string;
  focus_muscles: string[];
  suggested_exercises: string[];
}

export interface BriefingData {
  nutrition_review: NutritionReview;
  workout_suggestion: string;
  daily_mission: string;
}

export interface SessionReviewData {
  last_session: LastSession | null;
  next_session: NextSession | null;
}

export interface Briefing {
  id: string;
  date: string;
  briefing_data: BriefingData;
  created_at: string;
}

export const getTodayBriefing = () =>
  apiRequest<Briefing>('/api/briefing/today');

export const regenerateBriefing = () =>
  apiRequest<Briefing>('/api/briefing/regenerate', { method: 'POST' });

export const getSessionReview = () =>
  apiRequest<SessionReviewData>('/api/briefing/session-review', { method: 'POST' });

/* ── Workout picker + tips ──────────────────────────────── */

export interface WorkoutListItem {
  index: number;
  title: string;
  date: string;
  duration_min: number | null;
  exercise_names: string[];
}

export interface ExerciseTip {
  name: string;
  sets_reps_done: string;
  progression_note: string;
  recommendation: string;
}

export interface NewExerciseSuggestion {
  name: string;
  why: string;
  suggested_sets_reps: string;
}

export interface WorkoutTips {
  workout_title: string;
  workout_date: string;
  nutrition_context: string;
  exercise_tips: ExerciseTip[];
  new_exercises_to_try: NewExerciseSuggestion[];
  general_advice: string;
}

export const getWorkoutList = () =>
  apiRequest<WorkoutListItem[]>('/api/briefing/workouts');

export const getWorkoutTips = (workout_index: number) =>
  apiRequest<WorkoutTips>('/api/briefing/workout-tips', {
    method: 'POST',
    body: JSON.stringify({ workout_index }),
  });
