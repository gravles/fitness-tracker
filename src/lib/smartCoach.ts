import { DailyLog } from './api';
import { differenceInDays, parseISO, format } from 'date-fns';

export interface CoachingTip {
    title: string;
    message: string;
    type: 'success' | 'warning' | 'info';
}

export function getSmartAdvice(logs: DailyLog[], streak: number): CoachingTip {

    // Helper to get a stable index based on the day of the year
    const getDailyIndex = (length: number) => {
        const today = new Date();
        const start = new Date(today.getFullYear(), 0, 0);
        const diff = (today.getTime() - start.getTime()) + ((start.getTimezoneOffset() - today.getTimezoneOffset()) * 60 * 1000);
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        return dayOfYear % length;
    };

    // 1. Check Streak Milestones
    if (streak >= 7) {
        const highStreakTips = [
            { title: 'Unstoppable! 🔥', message: `You've been consistent for ${streak} days. Keep this momentum going!` },
            { title: 'On Fire! 🚀', message: `${streak} day streak! You are absolutely crushing your goals.` },
            { title: 'Habit Master 👑', message: `Consistency is key, and you've found it. ${streak} days strong!` },
            { title: 'Consistency King 🏆', message: `Nothing stops you! ${streak} days in a row.` }
        ];
        const tip = highStreakTips[getDailyIndex(highStreakTips.length)];
        return { ...tip, type: 'success' };
    }

    if (streak >= 3) {
        const buildingTips = [
            { title: 'Heating Up! 🚀', message: '3+ days in a row! You are building a solid habit.' },
            { title: 'Rolling! 🎲', message: 'Great consistency. Keep showing up!' },
            { title: 'Momentum Builder 🏗️', message: 'You are laying the foundation for success.' }
        ];
        const tip = buildingTips[getDailyIndex(buildingTips.length)];
        return { ...tip, type: 'success' };
    }

    // 2. Check Recent Inactivity
    const today = new Date();
    const lastLog = logs[logs.length - 1];

    if (lastLog) {
        const daysSinceLastLog = differenceInDays(today, parseISO(lastLog.date));
        if (daysSinceLastLog > 1) {
            const recoveryTips = [
                { title: 'We miss you! 👋', message: `It's been ${daysSinceLastLog} days. A small 10-minute walk can get you back on track.` },
                { title: 'Fresh Start 🌱', message: 'Don\'t worry about the gap. Today is a new day to move.' },
                { title: 'One Step 🦶', message: `Just one log today breaks the silence. You got this!` }
            ];
            const tip = recoveryTips[getDailyIndex(recoveryTips.length)];
            return { ...tip, type: 'warning' };
        }
    } else {
        return {
            title: 'Welcome! 👋',
            message: 'Start your journey by logging your first activity today.',
            type: 'info'
        };
    }

    // 3. What's Left? (Protein Check)
    const targetProtein = 150; // TODO: Fetch from settings
    const currentProtein = logs[logs.length - 1]?.protein_grams || 0;
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

    // 4. General Wellness / Fallback
    const generalTips = [
        { title: 'Daily Tip 💡', message: 'Consistency beats intensity. Just show up today!' },
        { title: 'Hydration check 💧', message: 'Have you had enough water today? It boosts performance.' },
        { title: 'Recovery Mode 🛌', message: 'Sleep is when the magic happens. Prioritize 7-8 hours.' },
        { title: 'Mindset 🧠', message: 'Focus on how you feel after the workout, not during.' },
        { title: 'Sunshine ☀️', message: '10 minutes of morning sun sets your rhythm for the day.' }
    ];
    const tip = generalTips[getDailyIndex(generalTips.length)];
    return { ...tip, type: 'info' };
}
