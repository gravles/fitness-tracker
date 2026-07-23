import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { getStreak, getMonthlyLogs, getUserBadges, getSettings, awardBadge, getLifetimeLogCount } from '@/lib/api';
import { getNewlyEarnedBadges } from '@/lib/gamification';
import { haptics } from '@/lib/haptics';

/**
 * Check for newly earned badges and award them, with a toast per unlock.
 * Extracted from the old DailyLogForm save path so every writer (Eat feed,
 * Workout tab, wellness check-in) keeps gamification alive. Never throws.
 */
export async function checkAndAwardBadges(): Promise<void> {
    try {
        const today = new Date();
        const startStr = format(subDays(today, 30), 'yyyy-MM-dd');
        const endStr = format(today, 'yyyy-MM-dd');
        const [streak, recentLogs, earnedBadges, settings, totalLogs] = await Promise.all([
            getStreak(),
            getMonthlyLogs(startStr, endStr),
            getUserBadges(),
            getSettings(),
            getLifetimeLogCount(),
        ]);
        const alreadyEarned = new Set(earnedBadges.map((b: { badge_id: string }) => b.badge_id));
        const newBadges = getNewlyEarnedBadges(recentLogs, streak, {
            totalLogs,
            proteinGoal: settings?.target_protein || undefined,
        }, alreadyEarned);
        await Promise.all(newBadges.map(b => awardBadge(b.id)));
        if (newBadges.length > 0) haptics.success();
        newBadges.forEach(b =>
            toast.success(`${b.icon} Badge unlocked: ${b.name}!`, { duration: 5000 })
        );
    } catch (e) {
        console.error('Badge check failed', e);
    }
}
