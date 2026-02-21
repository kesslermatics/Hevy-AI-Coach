/**
 * Internationalization (i18n) — German + English
 *
 * Usage:
 *   import { useLanguage } from './i18n';
 *   const { t } = useLanguage();
 *   <p>{t('dashboard.goodMorning')}</p>
 */
import { createContext, useContext } from 'react';

export type Lang = 'de' | 'en';

const translations = {
    /* ── Login / Register ─────────────────────────────── */
    'login.subtitle': { de: 'Melde dich an', en: 'Sign in to your account' },
    'login.username': { de: 'Benutzername', en: 'Username' },
    'login.usernamePlaceholder': { de: 'Dein Benutzername', en: 'Enter your username' },
    'login.password': { de: 'Passwort', en: 'Password' },
    'login.passwordPlaceholder': { de: 'Dein Passwort', en: 'Enter your password' },
    'login.submit': { de: 'Anmelden', en: 'Sign In' },
    'login.submitting': { de: 'Wird angemeldet…', en: 'Signing in…' },
    'login.noAccount': { de: 'Noch kein Konto?', en: "Don't have an account?" },
    'login.createOne': { de: 'Registrieren', en: 'Create one' },
    'login.justRegistered': { de: 'Konto erstellt! Bitte melde dich an.', en: 'Account created! Please sign in.' },

    'register.subtitle': { de: 'Erstelle dein Konto', en: 'Create your account' },
    'register.username': { de: 'Benutzername', en: 'Username' },
    'register.usernamePlaceholder': { de: 'Wähle einen Benutzernamen', en: 'Choose a username' },
    'register.password': { de: 'Passwort', en: 'Password' },
    'register.passwordPlaceholder': { de: 'Mind. 8 Zeichen', en: 'Min. 8 characters' },
    'register.confirm': { de: 'Passwort bestätigen', en: 'Confirm Password' },
    'register.confirmPlaceholder': { de: 'Passwort wiederholen', en: 'Repeat password' },
    'register.submit': { de: 'Konto erstellen', en: 'Create Account' },
    'register.submitting': { de: 'Wird erstellt…', en: 'Creating account…' },
    'register.hasAccount': { de: 'Schon ein Konto?', en: 'Already have an account?' },
    'register.signIn': { de: 'Anmelden', en: 'Sign in' },
    'register.passwordMismatch': { de: 'Passwörter stimmen nicht überein', en: 'Passwords do not match' },
    'register.passwordTooShort': { de: 'Passwort muss mindestens 8 Zeichen lang sein', en: 'Password must be at least 8 characters' },

    /* ── App Layout / Nav ─────────────────────────────── */
    'nav.home': { de: 'Home', en: 'Home' },
    'nav.settings': { de: 'Einstellungen', en: 'Settings' },
    'nav.logout': { de: 'Abmelden', en: 'Logout' },

    /* ── Setup Page ───────────────────────────────────── */
    'setup.title': { de: "Los geht's!", en: "Let's get you set up" },
    'setup.subtitle': { de: 'Verbinde deine Accounts für KI-Coaching', en: 'Connect your accounts to unlock AI coaching' },
    'setup.hevyTitle': { de: 'Hevy API Key', en: 'Hevy API Key' },
    'setup.hevyDesc': { de: 'Gib deinen Hevy API Key ein, um deine Trainingsdaten zu verbinden. Finde ihn in deinen', en: 'Enter your Hevy API key to connect your workout data. Find it in your' },
    'setup.hevyLink': { de: 'Hevy Entwickler-Einstellungen', en: 'Hevy Developer Settings' },
    'setup.hevyEncrypted': { de: 'verschlüsselt', en: 'encrypted' },
    'setup.hevySaved': { de: 'Hevy API Key gespeichert!', en: 'Hevy API Key saved!' },
    'setup.saveAndContinue': { de: 'Speichern & Weiter', en: 'Save & Continue' },
    'setup.skipToYazio': { de: 'Bereits eingerichtet — weiter zu Yazio →', en: 'Already set — skip to Yazio →' },
    'setup.yazioTitle': { de: 'Yazio Account', en: 'Yazio Account' },
    'setup.yazioDesc': { de: 'Gib deine Yazio-Zugangsdaten ein, um deine täglichen Ernährungsdaten zu laden. Dein Ziel, Gewicht und Körperdaten werden automatisch von Yazio importiert. Zugangsdaten werden', en: 'Enter your Yazio login so we can fetch your daily nutrition data. Your goal, weight, and body stats will be imported automatically from Yazio. Credentials are' },
    'setup.yazioConnected': { de: 'Yazio verbunden!', en: 'Yazio connected!' },
    'setup.connectAndStart': { de: 'Verbinden & Coaching starten', en: 'Connect & Start Coaching' },
    'setup.backToHevy': { de: '← Zurück zu Hevy', en: '← Back to Hevy' },

    /* ── Settings Page ────────────────────────────────── */
    'settings.title': { de: 'Einstellungen', en: 'Settings' },
    'settings.subtitle': { de: 'Verwalte deine verbundenen Accounts und Zugangsdaten', en: 'Manage your connected accounts and credentials' },
    'settings.account': { de: 'Account', en: 'Account' },
    'settings.username': { de: 'Benutzername', en: 'Username' },
    'settings.userId': { de: 'Benutzer-ID', en: 'User ID' },
    'settings.hevyTitle': { de: 'Hevy API Key', en: 'Hevy API Key' },
    'settings.hevyDesc': { de: 'Dein Key wird vor der Speicherung verschlüsselt. Finde ihn in deinen', en: 'Your key is encrypted before storage. Find it in your' },
    'settings.hevyLink': { de: 'Hevy Entwickler-Einstellungen', en: 'Hevy Developer Settings' },
    'settings.hevyUpdated': { de: 'Hevy API Key aktualisiert!', en: 'Hevy API Key updated!' },
    'settings.hevyPlaceholder': { de: '••••••••  (neuen Key eingeben)', en: '••••••••  (enter new key to update)' },
    'settings.updateKey': { de: 'Key aktualisieren', en: 'Update API Key' },
    'settings.saveKey': { de: 'Key speichern', en: 'Save API Key' },
    'settings.yazioTitle': { de: 'Yazio Account', en: 'Yazio Account' },
    'settings.yazioDesc': { de: 'Deine Yazio-Zugangsdaten werden verschlüsselt und nur zum Abrufen deiner Ernährungsdaten verwendet.', en: 'Your Yazio credentials are encrypted and only used to fetch your nutrition data.' },
    'settings.yazioUpdated': { de: 'Yazio-Zugangsdaten aktualisiert!', en: 'Yazio credentials updated!' },
    'settings.yazioEmailPlaceholder': { de: '••••••••  (neue E-Mail eingeben)', en: '••••••••  (enter new email to update)' },
    'settings.yazioPasswordPlaceholder': { de: '••••••••  (neues Passwort eingeben)', en: '••••••••  (enter new password to update)' },
    'settings.updateYazio': { de: 'Yazio aktualisieren', en: 'Update Yazio Login' },
    'settings.saveYazio': { de: 'Yazio speichern', en: 'Save Yazio Login' },
    'settings.connected': { de: 'Verbunden', en: 'Connected' },
    'settings.notSet': { de: 'Nicht gesetzt', en: 'Not set' },
    'settings.saving': { de: 'Speichern…', en: 'Saving…' },
    'settings.languageTitle': { de: 'Sprache', en: 'Language' },
    'settings.languageDesc': { de: 'Ändere die Sprache der App und aller KI-Ausgaben.', en: 'Change the language of the app and all AI outputs.' },
    'settings.languageDe': { de: 'Deutsch', en: 'German' },
    'settings.languageEn': { de: 'Englisch', en: 'English' },
    'settings.languageUpdated': { de: 'Sprache geändert!', en: 'Language updated!' },

    /* ── Dashboard ────────────────────────────────────── */
    'dashboard.goodMorning': { de: 'Guten Morgen,', en: 'Good morning,' },
    'dashboard.generating': { de: 'Dein Morning Briefing wird erstellt…', en: 'Generating your morning briefing…' },
    'dashboard.analyzing': { de: 'Workouts & Ernährung werden analysiert', en: 'Analyzing workouts & nutrition' },
    'dashboard.tryAgain': { de: 'Nochmal versuchen', en: 'Try Again' },
    'dashboard.refresh': { de: 'Aktualisieren', en: 'Refresh' },
    'dashboard.refreshing': { de: 'Wird generiert…', en: 'Generating…' },

    'dashboard.nutritionTitle': { de: 'Ernährungsübersicht', en: 'Nutrition Review' },
    'dashboard.nutritionSubtitle': { de: 'Ernährung von gestern', en: "Yesterday's nutrition breakdown" },
    'dashboard.calories': { de: 'Kalorien', en: 'Calories' },
    'dashboard.protein': { de: 'Protein', en: 'Protein' },
    'dashboard.carbs': { de: 'Kohlenhydrate', en: 'Carbs' },
    'dashboard.fat': { de: 'Fett', en: 'Fat' },

    'dashboard.workoutTitle': { de: 'Trainingsvorschlag', en: 'Workout Suggestion' },
    'dashboard.workoutSubtitle': { de: 'Heutiger Trainingsfokus', en: "Today's training focus" },

    'dashboard.recoveryTitle': { de: 'Muskel-Erholung', en: 'Muscle Recovery' },
    'dashboard.recoverySubtitle': { de: 'Basierend auf deinen letzten Workouts', en: 'Based on your recent workouts' },

    'dashboard.weightTitle': { de: 'Gewichtstrend', en: 'Weight Trend' },
    'dashboard.weightSubtitle': { de: 'Dein Fortschritt', en: 'Your journey progress' },

    'dashboard.lastSession': { de: 'Letzte Session', en: 'Last Session' },
    'dashboard.lastSessionDesc': { de: 'Review, Rankings & Progression', en: 'Review, rankings & progression' },
    'dashboard.workoutTips': { de: 'Workout-Tipps', en: 'Workout Tips' },
    'dashboard.workoutTipsDesc': { de: 'Wähle eine Session für KI-Coaching', en: 'Pick a session for AI coaching' },

    'dashboard.dailyMission': { de: 'Tages-Mission', en: 'Daily Mission' },

    /* ── Session Modal ────────────────────────────────── */
    'modal.analyzingSession': { de: 'Deine letzte Session wird analysiert…', en: 'Analyzing your last session…' },
    'modal.generatingTips': { de: 'Tipps werden generiert…', en: 'Generating tips for this workout…' },
    'modal.loadingWorkouts': { de: 'Workouts werden geladen…', en: 'Loading your workouts…' },
    'modal.mayTakeSeconds': { de: 'Das kann ein paar Sekunden dauern', en: 'This may take a few seconds' },
    'modal.retry': { de: 'Erneut versuchen', en: 'Retry' },
    'modal.noSessionData': { de: 'Keine aktuellen Session-Daten verfügbar.', en: 'No recent session data available.' },

    /* ── Workout Picker ───────────────────────────────── */
    'picker.title': { de: 'Wähle ein Workout', en: 'Pick a workout' },
    'picker.subtitle': { de: 'Wähle eine Session für KI-Tipps & Vorschläge', en: 'Select a session to get AI-powered tips & suggestions' },
    'picker.noWorkouts': { de: 'Keine Workouts gefunden.', en: 'No workouts found.' },

    /* ── Workout Tips Content ─────────────────────────── */
    'tips.backToWorkouts': { de: '← Zurück zu den Workouts', en: '← Back to workouts' },  // note: using ← char
    'tips.nutritionPhase': { de: 'Ernährungsphase', en: 'Nutrition Phase' },
    'tips.exerciseBreakdown': { de: 'Übungsanalyse', en: 'Exercise Breakdown' },
    'tips.tryNextTime': { de: 'Nächstes Mal ausprobieren', en: 'Try next time' },

    /* ── Exercise Card ────────────────────────────────── */
    'exercise.breakthrough': { de: 'Durchbruch!', en: 'Breakthrough!' },
    'exercise.recoveryPhase': { de: 'Erholungsphase', en: 'Recovery Phase' },
    'exercise.firstTime': { de: 'Erstes Mal!', en: 'First time!' },
    'exercise.holdingGround': { de: 'Stabil gehalten', en: 'Holding Ground' },
    'exercise.nextTarget': { de: 'Nächstes Ziel', en: 'Next Target' },
    'exercise.maxRank': { de: '🏆 Maximaler Rang erreicht!', en: '🏆 Maximum rank achieved!' },
    'exercise.e1rmProgression': { de: 'Geschätzte 1RM Progression', en: 'Estimated 1RM Progression' },
    'exercise.1rmPr': { de: '1RM PR', en: '1RM PR' },
    'exercise.volPr': { de: 'Volumen PR', en: 'Volume PR' },
    'exercise.bothPr': { de: '1RM + Vol PR', en: '1RM + Vol PR' },

    /* ── Muscle Heatmap ───────────────────────────────── */
    'muscle.front': { de: 'Vorne', en: 'Front' },
    'muscle.back': { de: 'Hinten', en: 'Back' },
    'muscle.chest': { de: 'Brust', en: 'Chest' },
    'muscle.backMuscle': { de: 'Rücken', en: 'Back' },
    'muscle.shoulders': { de: 'Schultern', en: 'Shoulders' },
    'muscle.biceps': { de: 'Bizeps', en: 'Biceps' },
    'muscle.triceps': { de: 'Trizeps', en: 'Triceps' },
    'muscle.forearms': { de: 'Unterarme', en: 'Forearms' },
    'muscle.abs': { de: 'Bauch', en: 'Abs' },
    'muscle.quads': { de: 'Quads', en: 'Quads' },
    'muscle.hamstrings': { de: 'Beinbeuger', en: 'Hamstrings' },
    'muscle.glutes': { de: 'Gesäß', en: 'Glutes' },
    'muscle.calves': { de: 'Waden', en: 'Calves' },
    'muscle.destroyed': { de: 'Zerstört', en: 'Destroyed' },
    'muscle.sore': { de: 'Muskelkater', en: 'Sore' },
    'muscle.recovering': { de: 'Erholung', en: 'Recovering' },
    'muscle.almostReady': { de: 'Fast bereit', en: 'Almost Ready' },
    'muscle.ready': { de: 'Bereit', en: 'Ready' },

    /* ── Activity Heatmap ─────────────────────────────── */
    'activity.title': { de: 'Aktivitäts-Heatmap', en: 'Activity Heatmap' },
    'activity.loading': { de: 'Dein Verlauf wird geladen…', en: 'Loading your history…' },
    'activity.subtitle': { de: 'Letzte {weeks} Wochen: Workouts & Ernährungstracking', en: 'Last {weeks} weeks of workouts & nutrition tracking' },
    'activity.workouts': { de: '{n} Workouts', en: '{n} workouts' },
    'activity.daysTracked': { de: '{n} Tage getrackt', en: '{n} days tracked' },
    'activity.both': { de: '{n} beides', en: '{n} both' },
    'activity.workout': { de: 'Workout', en: 'Workout' },
    'activity.nutrition': { de: 'Ernährung', en: 'Nutrition' },
    'activity.bothLabel': { de: 'Beides', en: 'Both' },
    'activity.lessMore': { de: 'Weniger → Mehr', en: 'Less → More' },
    'activity.noActivity': { de: 'Keine Aktivität', en: 'No activity' },
    'activity.kcalTracked': { de: '{n} kcal getrackt', en: '{n} kcal tracked' },

    /* ── Date formatting ──────────────────────────────── */
    'date.locale': { de: 'de-DE', en: 'en-US' },
} as const;

export type TranslationKey = keyof typeof translations;

export const LanguageContext = createContext<Lang>('de');

export function useLanguage() {
    const lang = useContext(LanguageContext);

    function t(key: TranslationKey, params?: Record<string, string | number>): string {
        const entry = translations[key];
        if (!entry) return key;
        let text: string = entry[lang] ?? entry['en'] ?? key;
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                text = text.replace(`{${k}}`, String(v));
            }
        }
        return text;
    }

    return { t, lang };
}
