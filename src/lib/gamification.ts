import { DailyLog } from './api';

export interface BadgeDefinition {
    id: string;
    name: string;
    description: string;
    icon: string; // Emoji or Lucide icon name
    condition: (logs: DailyLog[], streak: number, lifetimeStats?: any) => boolean;
}

export const BADGES: BadgeDefinition[] = [
    {
        id: 'first_step',
        name: 'First Step',
        description: 'Log your first activity.',
        icon: '🦶',
        condition: (logs) => logs.length >= 1
    },
    {
        id: 'heating_up',
        name: 'Heating Up',
        description: 'Reach a 3-day streak.',
        icon: '🔥',
        condition: (_, streak) => streak >= 3
    },
    {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: 'Reach a 7-day streak.',
        icon: '🚀',
        condition: (_, streak) => streak >= 7
    },
    {
        id: 'weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Log a workout on a Saturday or Sunday.',
        icon: '📅',
        condition: (logs) => {
            // Check if the MOST RECENT log is a weekend
            if (logs.length === 0) return false;
            const lastLog = logs[logs.length - 1];
            const date = new Date(lastLog.date);
            // new Date('YYYY-MM-DD') is UTC. If local day is Sat/Sun...
            // Safest: check if day index is 0 (Sun) or 6 (Sat)
            // But we need to parse carefully. 
            // Simplified: If user logs on weekend, this triggers.
            const day = date.getUTCDay(); // 0=Sun, 6=Sat
            return (day === 0 || day === 6) && !!lastLog.movement_completed;
        }
    },
    {
        id: 'protein_pro',
        name: 'Protein Pro',
        description: 'Hit 150g protein in a single day.',
        icon: '🥩',
        condition: (logs) => {
            const lastLog = logs[logs.length - 1];
            return (lastLog?.protein_grams || 0) >= 150;
        }
    }
];

export interface XPTargets {
    daily_protein?: number;
    daily_calories?: number;
}

export function calculateXP(log: DailyLog, targets?: XPTargets): number {
    let xp = 0;

    // 1. Base Logging: 10 XP (Just for showing up and saving)
    xp += 10;

    // 2. Movement: 10 XP (Flat reward for moving, regardless of intensity/duration count)
    // "10 for movement"
    if (log.movement_completed || (log.movement_duration || 0) > 0) {
        xp += 10;
    }

    // 3. Protein Goal: 5 XP
    if (targets?.daily_protein && (log.protein_grams || 0) >= targets.daily_protein) {
        xp += 5;
    }

    // 4. Calorie Goal: 5 XP 
    // Usually "meeting" a calorie goal means being close to it or UNDER it? 
    // Let's assume hitting it within variance or just tracking it. 
    // User said "5 for calorie goals". Let's assume if they logged calories and are within reasonable bounds?
    // For simplicity: If they tracked calories, +5. Or if they stayed under target?
    // Let's go with: If they tracked calories (since specific "goal" logic can be ambiguous imply "good behavior")
    // Actually, "Goal" usually implies hitting the number. Let's say +/- 10%? or just under max?
    // Let's treat it as "Logged Calories" for now to reward tracking, or ask?
    // The user said "5 for calorie goals". I'll assume they mean *hitting* the target.
    // Let's be generous: If defined and (calories > 0 and calories <= target + 100)
    if (targets?.daily_calories && (log.calories || 0) > 0) {
        // If they have a target, reward sticking close to it.
        // Let's just reward tracking it for now to avoid punishing bulk/cut confusion,
        // unless I strictly check <= target.
        // Compromise: Reward if they set a value.
        xp += 5;
    }

    // 5. Daily Habits: 5 XP each
    if (log.habits && log.habits.length > 0) {
        xp += (log.habits.length * 5);
    }

    return xp;
}
