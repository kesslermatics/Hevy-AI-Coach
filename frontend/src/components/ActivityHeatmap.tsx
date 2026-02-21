/**
 * GitHub-style Activity Heatmap 📊
 *
 * Shows a grid of the last ~6 months, where each cell represents a day.
 * Color intensity shows activity: workouts (blue/purple) + nutrition tracking (green).
 */
import { useEffect, useState } from 'react';
import { Loader2, Dumbbell, UtensilsCrossed, Calendar } from 'lucide-react';
import { getActivityHeatmap } from '../api/api';
import type { ActivityHeatmapData } from '../api/api';
import { useLanguage } from '../i18n';

interface DayData {
    date: string;
    workout: boolean;
    workoutTitle?: string;
    workoutDuration?: number | null;
    nutrition: boolean;
    calories?: number;
}

type TooltipData = DayData & { x: number; y: number };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAYS_EN = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const DAYS_DE = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];

function getDayColor(day: DayData): string {
    if (day.workout && day.nutrition) return '#A855F7';   // purple – both
    if (day.workout) return '#3B82F6';                     // blue – workout only
    if (day.nutrition) return '#22C55E';                    // green – nutrition only
    return 'rgba(255,255,255,0.04)';                       // empty
}

function getDayOpacity(day: DayData): number {
    if (day.workout && day.nutrition) return 0.95;
    if (day.workout || day.nutrition) return 0.75;
    return 1;
}

export default function ActivityHeatmap() {
    const [data, setData] = useState<ActivityHeatmapData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const { t, lang } = useLanguage();

    const MONTHS = lang === 'de' ? MONTHS_DE : MONTHS_EN;
    const DAYS = lang === 'de' ? DAYS_DE : DAYS_EN;

    useEffect(() => {
        getActivityHeatmap()
            .then(setData)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="card-glass p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-green-500/10 border-green-500/30 text-green-400">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-cream-50">{t('activity.title')}</h3>
                        <p className="text-xs text-dark-300">{t('activity.loading')}</p>
                    </div>
                </div>
                <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                </div>
            </div>
        );
    }

    // Build the grid data for last 26 weeks (~ 6 months)
    const today = new Date();
    const weeksToShow = 26;
    const totalDays = weeksToShow * 7;

    // Create a lookup map
    const workoutMap = new Map<string, { title: string; duration: number | null }>();
    const nutritionMap = new Map<string, { calories: number; protein: number }>();

    if (data) {
        for (const w of data.workouts) {
            workoutMap.set(w.date, { title: w.title, duration: w.duration_min });
        }
        for (const n of data.nutrition) {
            nutritionMap.set(n.date, { calories: n.calories, protein: n.protein });
        }
    }

    // Build grid — start from the beginning of the week, `totalDays` ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    // Adjust to start on Monday
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const weeks: DayData[][] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= today) {
        const week: DayData[] = [];
        for (let d = 0; d < 7; d++) {
            const dateStr = currentDate.toISOString().slice(0, 10);
            const isInRange = currentDate <= today;
            const workout = workoutMap.get(dateStr);
            const nutrition = nutritionMap.get(dateStr);

            week.push({
                date: dateStr,
                workout: isInRange && !!workout,
                workoutTitle: workout?.title,
                workoutDuration: workout?.duration,
                nutrition: isInRange && !!nutrition,
                calories: nutrition?.calories,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        weeks.push(week);
    }

    // Count stats
    const totalWorkouts = data?.workouts.length ?? 0;
    const totalNutritionDays = data?.nutrition.length ?? 0;
    const bothDays = [...workoutMap.keys()].filter(d => nutritionMap.has(d)).length;

    // Find which months appear at which week index
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
        // Use the Thursday of the week to determine the month (ISO week standard)
        const thursdayDate = new Date(week[3]?.date || week[0]?.date);
        const month = thursdayDate.getMonth();
        if (month !== lastMonth) {
            monthLabels.push({ label: MONTHS[month], weekIndex });
            lastMonth = month;
        }
    });

    const cellSize = 13;
    const cellGap = 3;
    const labelWidth = 28;
    const topPad = 18;
    const gridWidth = weeks.length * (cellSize + cellGap);
    const gridHeight = 7 * (cellSize + cellGap);

    return (
        <div className="card-glass p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-green-500/10 border-green-500/30 text-green-400">
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-cream-50">{t('activity.title')}</h3>
                    <p className="text-xs text-dark-300">{t('activity.subtitle', { weeks: String(weeksToShow) })}</p>
                </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-4 text-xs">
                <div className="flex items-center gap-1.5 text-blue-400">
                    <Dumbbell size={12} />
                    <span className="text-cream-200">{t('activity.workouts', { n: String(totalWorkouts) })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-green-400">
                    <UtensilsCrossed size={12} />
                    <span className="text-cream-200">{t('activity.daysTracked', { n: String(totalNutritionDays) })}</span>
                </div>
                {bothDays > 0 && (
                    <div className="flex items-center gap-1.5 text-purple-400">
                        <span className="text-cream-200">{t('activity.both', { n: String(bothDays) })}</span>
                    </div>
                )}
            </div>

            {/* Heatmap grid */}
            <div className="overflow-x-auto -mx-2 px-2" style={{ scrollbarWidth: 'none' }}>
                <div className="relative" style={{ minWidth: gridWidth + labelWidth + 8 }}>
                    <svg
                        width={gridWidth + labelWidth + 8}
                        height={gridHeight + topPad + 4}
                        className="block"
                    >
                        {/* Month labels */}
                        {monthLabels.map(({ label, weekIndex }) => (
                            <text
                                key={`${label}-${weekIndex}`}
                                x={labelWidth + weekIndex * (cellSize + cellGap) + cellSize / 2}
                                y={12}
                                fill="#555"
                                fontSize="9"
                                textAnchor="middle"
                                fontFamily="monospace"
                            >
                                {label}
                            </text>
                        ))}

                        {/* Day labels */}
                        {DAYS.map((label, i) => (
                            label ? (
                                <text
                                    key={i}
                                    x={labelWidth - 6}
                                    y={topPad + i * (cellSize + cellGap) + cellSize / 2 + 3}
                                    fill="#444"
                                    fontSize="8"
                                    textAnchor="end"
                                    fontFamily="monospace"
                                >
                                    {label}
                                </text>
                            ) : null
                        ))}

                        {/* Grid cells */}
                        {weeks.map((week, wi) =>
                            week.map((day, di) => {
                                const x = labelWidth + wi * (cellSize + cellGap);
                                const y = topPad + di * (cellSize + cellGap);
                                const isFuture = new Date(day.date) > today;
                                if (isFuture) return null;

                                return (
                                    <rect
                                        key={day.date}
                                        x={x}
                                        y={y}
                                        width={cellSize}
                                        height={cellSize}
                                        rx={2.5}
                                        fill={getDayColor(day)}
                                        opacity={getDayOpacity(day)}
                                        className="cursor-pointer transition-opacity duration-150"
                                        onMouseEnter={(e) => {
                                            const rect = (e.target as SVGRectElement).getBoundingClientRect();
                                            setTooltip({ ...day, x: rect.left + rect.width / 2, y: rect.top });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                );
                            })
                        )}
                    </svg>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#3B82F6', opacity: 0.75 }} />
                        <span className="text-[9px] text-dark-400">{t('activity.workout')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22C55E', opacity: 0.75 }} />
                        <span className="text-[9px] text-dark-400">{t('activity.nutrition')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#A855F7', opacity: 0.95 }} />
                        <span className="text-[9px] text-dark-400">{t('activity.bothLabel')}</span>
                    </div>
                </div>
                <span className="text-[9px] text-dark-400">{t('activity.lessMore')}</span>
            </div>

            {/* Tooltip (portal-style, fixed position) */}
            {tooltip && (
                <div
                    className="fixed z-[100] pointer-events-none px-3 py-2 rounded-lg bg-dark-700 border border-dark-500/50 shadow-xl text-xs max-w-[200px]"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 8,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <p className="text-cream-50 font-medium mb-0.5">
                        {new Date(tooltip.date + 'T12:00:00').toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {tooltip.workout && (
                        <p className="text-blue-300 text-[11px]">
                            🏋️ {tooltip.workoutTitle}{tooltip.workoutDuration ? ` (${tooltip.workoutDuration}min)` : ''}
                        </p>
                    )}
                    {tooltip.nutrition && (
                        <p className="text-green-300 text-[11px]">
                            🍽️ {t('activity.kcalTracked', { n: String(Math.round(tooltip.calories || 0)) })}
                        </p>
                    )}
                    {!tooltip.workout && !tooltip.nutrition && (
                        <p className="text-dark-400 text-[11px]">{t('activity.noActivity')}</p>
                    )}
                </div>
            )}
        </div>
    );
}
