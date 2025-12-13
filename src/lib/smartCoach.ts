import { DailyLog } from './api';
import { differenceInDays, parseISO } from 'date-fns';

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

    // 3. Fallback / General Advice
    return {
        title: 'Daily Tip 💡',
        message: 'Consistency beats intensity. Just show up today!',
        type: 'info'
    };
}
