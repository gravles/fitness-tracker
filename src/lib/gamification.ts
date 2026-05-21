import { DailyLog } from './api';

export interface BadgeDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    condition: (logs: DailyLog[], streak: number, lifetimeStats?: any) => boolean;
}

export const BADGES: BadgeDefinition[] = [
    // ── Streaks ──────────────────────────────────────────────
    {
        id: 'first_step',
        name: 'First Step',
        description: 'Log your first day.',
        icon: '🦶',
        condition: (logs) => logs.length >= 1,
    },
    {
        id: 'heating_up',
        name: 'Heating Up',
        description: 'Reach a 3-day logging streak.',
        icon: '🔥',
        condition: (_, streak) => streak >= 3,
    },
    {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: 'Reach a 7-day logging streak.',
        icon: '🚀',
        condition: (_, streak) => streak >= 7,
    },
    {
        id: 'streak_14',
        name: 'Iron Will',
        description: 'Reach a 14-day logging streak.',
        icon: '🦾',
        condition: (_, streak) => streak >= 14,
    },
    {
        id: 'streak_30',
        name: 'Legendary',
        description: 'Reach a 30-day logging streak.',
        icon: '👑',
        condition: (_, streak) => streak >= 30,
    },

    // ── Logging milestones ────────────────────────────────────
    {
        id: 'log_10',
        name: 'Getting Started',
        description: 'Log 10 days in total.',
        icon: '📝',
        condition: (_, __, stats) => (stats?.totalLogs || 0) >= 10,
    },
    {
        id: 'log_50',
        name: 'Committed',
        description: 'Log 50 days in total.',
        icon: '💯',
        condition: (_, __, stats) => (stats?.totalLogs || 0) >= 50,
    },
    {
        id: 'log_100',
        name: 'Century Club',
        description: 'Log 100 days in total.',
        icon: '🏅',
        condition: (_, __, stats) => (stats?.totalLogs || 0) >= 100,
    },

    // ── Activity ──────────────────────────────────────────────
    {
        id: 'weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Log a workout on a Saturday or Sunday.',
        icon: '📅',
        condition: (logs) => {
            if (logs.length === 0) return false;
            const last = logs[logs.length - 1];
            const day = new Date(last.date).getUTCDay();
            return (day === 0 || day === 6) && !!last.movement_completed;
        },
    },
    {
        id: 'active_week',
        name: 'Active Week',
        description: 'Move on 5 out of any 7 consecutive days.',
        icon: '🏃',
        condition: (logs) => {
            const last7 = logs.slice(-7);
            return last7.filter(l => l.movement_completed).length >= 5;
        },
    },

    // ── Nutrition ─────────────────────────────────────────────
    {
        id: 'protein_pro',
        name: 'Protein Pro',
        description: 'Hit 150g protein in a single day.',
        icon: '🥩',
        condition: (logs) => logs.some(l => (l.protein_grams || 0) >= 150),
    },
    {
        id: 'protein_streak_5',
        name: 'Protein Streak',
        description: 'Hit your protein goal 5 days in a row.',
        icon: '🥗',
        condition: (logs, _, stats) => {
            const goal = stats?.proteinGoal;
            if (!goal) return false;
            const last5 = logs.slice(-5);
            return last5.length >= 5 && last5.every(l => (l.protein_grams || 0) >= goal);
        },
    },
    {
        id: 'calorie_tracker_7',
        name: 'Number Cruncher',
        description: 'Track calories 7 days in a row.',
        icon: '🔢',
        condition: (logs) => {
            const last7 = logs.slice(-7);
            return last7.length >= 7 && last7.every(l => (l.calories || 0) > 0);
        },
    },

    // ── Wellness ──────────────────────────────────────────────
    {
        id: 'perfect_day',
        name: 'Perfect Day',
        description: 'Hit movement + protein goal + 2 habits in one day.',
        icon: '⭐',
        condition: (logs, _, stats) => {
            const goal = stats?.proteinGoal || 150;
            return logs.some(
                l => l.movement_completed && (l.protein_grams || 0) >= goal && (l.habits || []).length >= 2
            );
        },
    },
    {
        id: 'sleep_5',
        name: 'Deep Sleeper',
        description: 'Log a perfect 5/5 sleep quality.',
        icon: '😴',
        condition: (logs) => logs.some(l => l.sleep_quality === 5),
    },
    {
        id: 'dry_week',
        name: 'Clear Headed',
        description: 'Go 7 consecutive days without alcohol.',
        icon: '🧠',
        condition: (logs) => {
            const last7 = logs.slice(-7);
            return last7.length >= 7 && last7.every(l => (l.alcohol_drinks || 0) === 0);
        },
    },
];

export interface XPTargets {
    daily_protein?: number;
    daily_calories?: number;
}

export function calculateXP(log: DailyLog, targets?: XPTargets): number {
    let xp = 0;

    // Base: 10 XP for logging
    xp += 10;

    // Movement: 10 XP
    if (log.movement_completed || (log.movement_duration || 0) > 0) xp += 10;

    // Protein goal: 5 XP
    if (targets?.daily_protein && (log.protein_grams || 0) >= targets.daily_protein) xp += 5;

    // Calorie tracking: 5 XP
    if (targets?.daily_calories && (log.calories || 0) > 0) xp += 5;

    // Habits: 5 XP each
    if (log.habits && log.habits.length > 0) xp += log.habits.length * 5;

    return xp;
}

export interface LifetimeStats {
    totalLogs: number;
    proteinGoal?: number;
}

/**
 * Returns badges from BADGES whose conditions are now met but haven't been
 * earned yet. The caller is responsible for persisting them via awardBadge().
 */
export function getNewlyEarnedBadges(
    logs: DailyLog[],
    streak: number,
    lifetimeStats: LifetimeStats,
    alreadyEarned: Set<string>
): BadgeDefinition[] {
    return BADGES.filter(
        b => !alreadyEarned.has(b.id) && b.condition(logs, streak, lifetimeStats)
    );
}
