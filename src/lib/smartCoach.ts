import { DailyLog } from './api';
import { differenceInDays, parseISO, format } from 'date-fns';

export interface CoachingTip {
    title: string;
    message: string;
    type: 'success' | 'warning' | 'info';
}

export function getSmartAdvice(logs: DailyLog[], streak: number): CoachingTip {
    // 1. Check Streak Milestones
    if (streak >= 7) {
        return {
            title: 'Unstoppable! 🔥',
            message: `You've been consistent for ${streak} days. Keep this momentum going!`,
            type: 'success'
        };
    }

    if (streak >= 3) {
        return {
            title: 'Heating Up! 🚀',
            message: '3 days in a row! You are building a solid habit.',
            type: 'success'
        };
    }

    // 2. Check Recent Inactivity
    const today = new Date();
    const lastLog = logs[logs.length - 1];

    if (lastLog) {
        const daysSinceLastLog = differenceInDays(today, parseISO(lastLog.date));
        if (daysSinceLastLog > 1) {
            return {
                title: 'We miss you! 👋',
                message: `It's been ${daysSinceLastLog} days. A small 10-minute walk can get you back on track.`,
                type: 'warning'
            };
        }
    } else {
        return {
            title: 'Welcome! 👋',
            message: 'Start your journey by logging your first activity today.',
            type: 'info'
        };
    }

    // 3. What's Left? (Protein Check)
    // Assuming a default target of 150g if not passed (Future: pass target as prop)
    const targetProtein = 150;
    const currentProtein = logs[logs.length - 1]?.protein_grams || 0;

    // Only show if it's "Today" (log date matches today)
    const lastLogDate = logs[logs.length - 1]?.date;
    const isToday = lastLogDate === format(new Date(), 'yyyy-MM-dd');

    if (isToday && currentProtein < targetProtein) {
        const remaining = targetProtein - currentProtein;
        return {
            title: 'Protein Goal 🥩',
            message: `You need ${remaining}g more to hit your goal!`,
            type: 'info'
        };
    }

    // 4. Fallback / General Advice
    return {
        title: 'Daily Tip 💡',
        message: 'Consistency beats intensity. Just show up today!',
        type: 'info'
    };
}
