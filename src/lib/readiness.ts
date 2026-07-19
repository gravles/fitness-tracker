/**
 * Readiness score (0–100) from data every user has — no wearable required:
 * last night's sleep quality, yesterday's energy and alcohol, and the ratio
 * of recent training load to the longer-term norm (acute:chronic).
 *
 * Deliberately transparent: each component's contribution is returned so the
 * UI (and the AI coach) can explain the number. When richer sleep/HRV data
 * lands in a future sleep_records table, it can replace the sleep component
 * without touching consumers.
 */

export interface ReadinessDailyLog {
    date: string;                    // YYYY-MM-DD
    sleep_quality?: number | null;   // 1–5
    energy_level?: number | null;    // 1–5
    alcohol_drinks?: number | null;
}

export interface ReadinessWorkout {
    date: string;
    duration?: number | null;        // minutes
    intensity?: string | null;       // Light | Moderate | Hard
}

export interface ReadinessSleepRecord {
    duration_minutes: number;
    deep_minutes?: number | null;
    rem_minutes?: number | null;
}

export interface ReadinessComponent {
    name: string;
    delta: number;
    detail: string;
}

export interface Readiness {
    score: number;                   // 0–100
    label: 'primed' | 'ready' | 'steady' | 'recovery';
    recommendation: string;
    components: ReadinessComponent[];
}

const INTENSITY_FACTOR: Record<string, number> = { Light: 1, Moderate: 1.5, Hard: 2 };

function loadFor(workouts: ReadinessWorkout[], from: string, to: string): number {
    return workouts
        .filter(w => w.date >= from && w.date <= to)
        .reduce((sum, w) => sum + (w.duration ?? 45) * (INTENSITY_FACTOR[w.intensity ?? 'Moderate'] ?? 1.5), 0);
}

function shift(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Map tracked sleep duration onto the same 1–5 scale the manual rating uses. */
function durationQuality(minutes: number): number {
    const hours = minutes / 60;
    if (hours < 5) return 1;
    if (hours < 6) return 2;
    if (hours < 7) return 3;
    if (hours <= 9.5) return hours < 8 ? 4 : 5;
    return 4; // very long sleep is usually a recovery signal, not a win
}

export function computeReadiness(
    logs: ReadinessDailyLog[],
    workouts: ReadinessWorkout[],
    today: string,
    sleepRecord?: ReadinessSleepRecord | null,
): Readiness {
    const components: ReadinessComponent[] = [];
    let score = 100;

    const byDate = new Map(logs.map(l => [l.date, l]));
    const yesterday = byDate.get(shift(today, -1));
    const todayLog = byDate.get(today);

    // Sleep: tracked sleep (Health Connect etc.) wins over the manual rating
    if (sleepRecord != null && sleepRecord.duration_minutes > 0) {
        const quality = durationQuality(sleepRecord.duration_minutes);
        const delta = (quality - 3) * 10;
        score += delta;
        const h = Math.floor(sleepRecord.duration_minutes / 60);
        const m = sleepRecord.duration_minutes % 60;
        components.push({ name: 'sleep', delta, detail: `slept ${h}h ${m.toString().padStart(2, '0')}m` });
    } else {
        const sleep = todayLog?.sleep_quality ?? null;
        if (sleep != null) {
            const delta = (sleep - 3) * 10; // 1→-20 … 5→+20
            score += delta;
            components.push({ name: 'sleep', delta, detail: `sleep quality ${sleep}/5` });
        }
    }

    // Yesterday's energy as a trailing fatigue signal
    const energy = yesterday?.energy_level ?? null;
    if (energy != null) {
        const delta = (energy - 3) * 4;
        score += delta;
        components.push({ name: 'energy', delta, detail: `yesterday's energy ${energy}/5` });
    }

    // Alcohol last night
    const drinks = yesterday?.alcohol_drinks ?? 0;
    if (drinks > 0) {
        const delta = -Math.min(drinks * 7, 21);
        score += delta;
        components.push({ name: 'alcohol', delta, detail: `${drinks} drink${drinks === 1 ? '' : 's'} last night` });
    }

    // Training load: last 3 days vs the 28-day norm scaled to 3 days
    const acute = loadFor(workouts, shift(today, -2), today);
    const chronicDaily = loadFor(workouts, shift(today, -27), today) / 28;
    const chronic3 = chronicDaily * 3;
    if (chronic3 > 0) {
        const ratio = acute / chronic3;
        let delta = 0;
        let detail = 'training load in your normal range';
        if (ratio > 1.5) {
            delta = -15;
            detail = 'training load well above your recent norm';
        } else if (ratio > 1.2) {
            delta = -8;
            detail = 'training load above your recent norm';
        } else if (ratio < 0.3) {
            delta = 5;
            detail = 'well rested — light recent load';
        }
        if (delta !== 0) score += delta;
        components.push({ name: 'load', delta, detail });
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    const label: Readiness['label'] =
        score >= 80 ? 'primed' : score >= 60 ? 'ready' : score >= 40 ? 'steady' : 'recovery';

    const recommendation = {
        primed: 'Green light — a great day to push for the progression targets.',
        ready: 'Good to train as planned.',
        steady: 'Train, but consider the fallback version and skip max-effort sets.',
        recovery: 'Recovery day — rest, walk, or at most the fallback workout.',
    }[label];

    return { score, label, recommendation, components };
}
