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

export function calculateXP(log: DailyLog): number {
    let xp = 0;

    // Base XP for logging anything
    xp += 10;

    // Movement
    if (log.movement_completed) {
        xp += 20;
        // Bonus for duration
        if ((log.movement_duration || 0) > 45) xp += 10;
        // Bonus for intensity
        if (log.movement_intensity === 'Hard') xp += 15;
    }

    // Nutrition
    if (log.protein_grams && log.protein_grams >= 130) xp += 15;
    if (log.eating_window_end && log.eating_window_start) xp += 5; // Tracking IF

    // Mindfulness
    if (log.habits && log.habits.includes('Meditation')) xp += 10;

    return xp;
}
