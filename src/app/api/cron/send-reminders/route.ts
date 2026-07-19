import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { ensureVapid, sendApnsMessage, getMessaging, sendPushToUser } from '@/lib/push-server';
import { computeChallengeProgress, ChallengeType } from '@/lib/partner-summary';

// ─── Supabase ────────────────────────────────────────────────────────────────
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function isAuthorized(request: NextRequest): boolean {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

interface Reminder {
    id:      string;
    label:   string;
    time:    string;   // "HH:MM" UTC
    enabled: boolean;
    body?:   string;
}

/**
 * Convert a local wall-clock date+time in a given IANA timezone to a UTC Date.
 * Works without any external library by leveraging the Intl API.
 */
function localToUtcDate(dateStr: string, timeStr: string, tz: string): Date {
    // Probe: treat the scheduled time as if it were UTC
    const probe = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00Z`);
    // Find out what local wall-clock time that UTC instant corresponds to in `tz`
    const localRepr = probe.toLocaleString('sv-SE', { timeZone: tz }); // "YYYY-MM-DD HH:mm:ss"
    const localMs = new Date(localRepr.replace(' ', 'T') + 'Z').getTime();
    // The difference tells us the UTC offset at that moment
    const offsetMs = localMs - probe.getTime();
    // Subtract the offset to get the actual UTC instant for the wall-clock time
    return new Date(probe.getTime() - offsetMs);
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        ensureVapid();
        const supabase      = getSupabaseAdmin();
        const messaging     = await getMessaging();
        const now           = new Date();
        const currentHour   = now.getUTCHours();
        const currentMinute = now.getUTCMinutes();

        const todayDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC

        // Fetch push subscriptions, device tokens, AND today's log entries in parallel
        const [{ data: webSubs }, { data: deviceTokenRows }, { data: todayLogs }] = await Promise.all([
            supabase.from('push_subscriptions').select('*'),
            supabase.from('device_tokens').select('user_id, token, platform, reminders'),
            // Smart-skip: find users who have already logged anything today
            supabase
                .from('daily_logs')
                .select('user_id')
                .eq('date', todayDateStr)
                .or('nutrition_logged.eq.true,movement_completed.eq.true,calories.gt.0'),
        ]);

        // Users who have already logged today — skip daily reminders for them
        const alreadyLoggedToday = new Set<string>(
            (todayLogs ?? []).map((r: { user_id: string }) => r.user_id)
        );

        // Build lookup: user_id → [{ token, platform }, ...]
        type TokenEntry = { token: string; platform: string };
        const tokensByUser: Record<string, TokenEntry[]> = {};
        for (const row of (deviceTokenRows ?? [])) {
            (tokensByUser[row.user_id] ??= []).push({
                token:    row.token,
                platform: (row.platform as string) ?? 'android',
            });
        }

        let sent = 0, failed = 0;
        const expiredEndpoints: string[] = [];
        const expiredFcmTokens: string[] = [];

        // Helper: send a native push to all tokens for a user
        // iOS → direct APNs (HTTP/2 + JWT)
        // Android → Firebase Cloud Messaging
        async function sendNative(userId: string, title: string, body: string, tag: string, url = '/schedule') {
            for (const { token, platform } of (tokensByUser[userId] ?? [])) {
                try {
                    if (platform === 'ios') {
                        const { ok, expired } = await sendApnsMessage(token, title, body, { url, tag });
                        if (expired) expiredFcmTokens.push(token);
                        if (ok) sent++; else failed++;
                    } else if (messaging) {
                        await messaging.send({
                            token,
                            notification: { title, body },
                            data:         { url, tag },
                            android: { priority: 'high' },
                        });
                        sent++;
                    }
                } catch (err: any) {
                    if (
                        err.code === 'messaging/registration-token-not-registered' ||
                        err.code === 'messaging/invalid-registration-token'
                    ) {
                        expiredFcmTokens.push(token);
                    }
                    failed++;
                }
            }
        }

        // ── 1. Daily reminders (web-push subscribers) ─────────────────────
        const webSubUserIds = new Set<string>();
        await Promise.all((webSubs ?? []).map(async (sub) => {
            webSubUserIds.add(sub.user_id);
            // Smart-skip: user already logged today, no need to remind them
            if (alreadyLoggedToday.has(sub.user_id)) return;
            const reminders: Reminder[] = sub.reminders ?? [];
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h, m] = r.time.split(':').map(Number);
                return h === currentHour && m === currentMinute;
            });

            for (const reminder of due) {
                const title = reminder.label;
                const body  = reminder.body ?? 'Tap to open your fitness tracker.';
                const tag   = `reminder-${reminder.id}`;

                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, url: '/log', tag }),
                        { TTL: 3600 }
                    );
                    sent++;
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                    failed++;
                }

                await sendNative(sub.user_id, title, body, tag, '/log');
            }
        }));

        // ── 2. Daily reminders (native-only FCM users) ────────────────────
        const nativeRemindersByUser: Record<string, Reminder[]> = {};
        for (const row of (deviceTokenRows ?? [])) {
            if (webSubUserIds.has(row.user_id)) continue;
            const reminders: Reminder[] = row.reminders ?? [];
            if (reminders.length > 0 && !nativeRemindersByUser[row.user_id]) {
                nativeRemindersByUser[row.user_id] = reminders;
            }
        }

        for (const [userId, reminders] of Object.entries(nativeRemindersByUser)) {
            // Smart-skip: user already logged today
            if (alreadyLoggedToday.has(userId)) continue;
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h, m] = r.time.split(':').map(Number);
                return h === currentHour && m === currentMinute;
            });
            for (const reminder of due) {
                await sendNative(userId, reminder.label, reminder.body ?? 'Tap to open your fitness tracker.', `reminder-${reminder.id}`, '/log');
            }
        }

        // ── 3. Scheduled workout notifications ────────────────────────────
        const allUserIds = Object.keys(tokensByUser);
        if (allUserIds.length > 0) {
            // Fetch workouts for today and tomorrow (UTC) to handle all timezone offsets
            const todayUtc     = now.toISOString().slice(0, 10);
            const tomorrowUtc  = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

            const [{ data: userSettings }, { data: pendingWorkouts }] = await Promise.all([
                supabase
                    .from('user_settings')
                    .select('user_id, timezone')
                    .in('user_id', allUserIds),
                supabase
                    .from('scheduled_workouts')
                    .select('id, user_id, scheduled_date, scheduled_time, title, remind_minutes')
                    .in('user_id', allUserIds)
                    .in('scheduled_date', [todayUtc, tomorrowUtc])
                    .eq('status', 'scheduled')
                    .eq('reminder_sent', false),
            ]);

            const tzByUser: Record<string, string> = {};
            for (const us of (userSettings ?? [])) {
                tzByUser[us.user_id] = us.timezone ?? 'UTC';
            }

            const notifiedIds: string[] = [];

            for (const workout of (pendingWorkouts ?? [])) {
                const tz           = tzByUser[workout.user_id] ?? 'UTC';
                const remindBefore = (workout.remind_minutes ?? 15) * 60_000; // ms
                const workoutUtc   = localToUtcDate(workout.scheduled_date, workout.scheduled_time, tz);
                const notifyAt     = workoutUtc.getTime() - remindBefore;
                const nowMs        = now.getTime();

                // Fire if we're within this 60-second cron window
                if (nowMs >= notifyAt && nowMs < notifyAt + 60_000) {
                    const minsBefore = workout.remind_minutes ?? 15;
                    const timeLabel  = minsBefore === 0   ? 'Starting now'
                                     : minsBefore < 60   ? `in ${minsBefore} min`
                                     : minsBefore === 60  ? 'in 1 hour'
                                     : minsBefore === 1440 ? 'tomorrow'
                                     : `in ${minsBefore / 60} hours`;

                    await sendNative(
                        workout.user_id,
                        `🏋️ ${workout.title}`,
                        `${timeLabel} — time to get moving!`,
                        `workout-${workout.id}`,
                        '/schedule',
                    );
                    notifiedIds.push(workout.id);
                }
            }

            if (notifiedIds.length > 0) {
                await supabase
                    .from('scheduled_workouts')
                    .update({ reminder_sent: true })
                    .in('id', notifiedIds);
            }
        }

        // ── 3b. Supplement dose reminders ─────────────────────────────────
        // Unlike the workout block, users come from the dose rows themselves
        // (not tokensByUser) so web-push-only subscribers get reminders too;
        // sendPushToUser covers web push + APNs + FCM in one call.
        {
            const todayUtc    = now.toISOString().slice(0, 10);
            const tomorrowUtc = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

            const { data: pendingDoses } = await supabase
                .from('supplement_doses')
                .select('id, user_id, scheduled_date, scheduled_time, name, dose_amount, dose_unit, remind_minutes')
                .in('scheduled_date', [todayUtc, tomorrowUtc])
                .eq('status', 'planned')
                .eq('reminder_sent', false)
                .not('remind_minutes', 'is', null)
                .not('scheduled_time', 'is', null);

            if (pendingDoses && pendingDoses.length > 0) {
                const doseUserIds = Array.from(new Set(pendingDoses.map(d => d.user_id)));
                const { data: doseUserSettings } = await supabase
                    .from('user_settings')
                    .select('user_id, timezone')
                    .in('user_id', doseUserIds);

                const doseTzByUser: Record<string, string> = {};
                for (const us of (doseUserSettings ?? [])) {
                    doseTzByUser[us.user_id] = us.timezone ?? 'UTC';
                }

                const notifiedDoseIds: string[] = [];
                for (const dose of pendingDoses) {
                    const tz       = doseTzByUser[dose.user_id] ?? 'UTC';
                    const doseUtc  = localToUtcDate(dose.scheduled_date, dose.scheduled_time, tz);
                    const notifyAt = doseUtc.getTime() - (dose.remind_minutes ?? 0) * 60_000;
                    const nowMs    = now.getTime();

                    // Fire if we're within this 60-second cron window
                    if (nowMs >= notifyAt && nowMs < notifyAt + 60_000) {
                        const doseLabel = dose.dose_amount != null
                            ? ` (${dose.dose_amount}${dose.dose_unit ? ` ${dose.dose_unit}` : ''})`
                            : '';
                        const { sent: s, failed: f } = await sendPushToUser(supabase, dose.user_id, {
                            title: `💊 ${dose.name}`,
                            body: `Time to take ${dose.name}${doseLabel}`,
                            url: '/supplements',
                            tag: `dose-${dose.id}`,
                        });
                        sent += s; failed += f;
                        notifiedDoseIds.push(dose.id);
                    }
                }

                if (notifiedDoseIds.length > 0) {
                    await supabase
                        .from('supplement_doses')
                        .update({ reminder_sent: true })
                        .in('id', notifiedDoseIds);
                }
            }
        }

        // ── 4. Partner streak-at-risk nudges (hourly) ─────────────────────
        // At 20:00 local time, if a user logged yesterday but nothing today,
        // ping their workout partner(s) so they can send encouragement.
        if (currentMinute === 0) {
            const { data: activePartnerships } = await supabase
                .from('partnerships')
                .select('id, inviter_id, invitee_id')
                .eq('status', 'active')
                .not('invitee_id', 'is', null);

            if (activePartnerships && activePartnerships.length > 0) {
                const partnerUserIds = Array.from(new Set(
                    activePartnerships.flatMap(p => [p.inviter_id, p.invitee_id as string])
                ));

                const [{ data: partnerSettings }, { data: partnerProfiles }] = await Promise.all([
                    supabase.from('user_settings').select('user_id, timezone').in('user_id', partnerUserIds),
                    supabase.from('profiles').select('id, full_name, email').in('id', partnerUserIds),
                ]);

                const tzOf: Record<string, string> = {};
                for (const s of (partnerSettings ?? [])) tzOf[s.user_id] = s.timezone ?? 'UTC';
                const nameOf: Record<string, string> = {};
                for (const p of (partnerProfiles ?? [])) {
                    nameOf[p.id] = p.full_name?.split(' ')[0] || p.email?.split('@')[0] || 'Your partner';
                }

                function localParts(tz: string): { date: string; hour: number } {
                    try {
                        const s = now.toLocaleString('sv-SE', { timeZone: tz }); // "YYYY-MM-DD HH:mm:ss"
                        return { date: s.slice(0, 10), hour: Number(s.slice(11, 13)) };
                    } catch {
                        return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
                    }
                }

                // Users whose local time is 20:00 right now
                type AtRiskCandidate = { userId: string; localDate: string; yesterday: string };
                const candidates = new Map<string, AtRiskCandidate>();
                for (const userId of partnerUserIds) {
                    const { date, hour } = localParts(tzOf[userId] ?? 'UTC');
                    if (hour === 20) {
                        const yesterday = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86_400_000)
                            .toISOString().slice(0, 10);
                        candidates.set(userId, { userId, localDate: date, yesterday });
                    }
                }

                if (candidates.size > 0) {
                    const candidateIds = Array.from(candidates.keys());
                    const allDates = Array.from(new Set(
                        Array.from(candidates.values()).flatMap(c => [c.localDate, c.yesterday])
                    ));
                    const { data: candidateLogs } = await supabase
                        .from('daily_logs')
                        .select('user_id, date, movement_completed, nutrition_logged, calories')
                        .in('user_id', candidateIds)
                        .in('date', allDates);

                    const loggedKeys = new Set(
                        (candidateLogs ?? [])
                            .filter(l => l.movement_completed || l.nutrition_logged || (l.calories && l.calories > 0))
                            .map(l => `${l.user_id}:${l.date}`)
                    );

                    for (const c of candidates.values()) {
                        const loggedToday = loggedKeys.has(`${c.userId}:${c.localDate}`);
                        const loggedYesterday = loggedKeys.has(`${c.userId}:${c.yesterday}`);
                        if (loggedToday || !loggedYesterday) continue; // no streak at risk

                        for (const p of activePartnerships) {
                            if (p.inviter_id !== c.userId && p.invitee_id !== c.userId) continue;
                            const partnerId = p.inviter_id === c.userId ? (p.invitee_id as string) : p.inviter_id;

                            // Partial unique index dedups repeat runs; 23505 = already sent today
                            const { error: nudgeError } = await supabase.from('partner_nudges').insert({
                                partnership_id: p.id,
                                from_user_id: null,
                                to_user_id: partnerId,
                                nudge_type: 'system_not_logged',
                                message: null,
                                local_date: c.localDate,
                            });
                            if (nudgeError) {
                                if (nudgeError.code !== '23505') console.error('Partner nudge insert error:', nudgeError);
                                continue;
                            }

                            const name = nameOf[c.userId] ?? 'Your partner';
                            const { sent: s, failed: f } = await sendPushToUser(supabase, partnerId, {
                                title: `🔥 ${name}'s streak is at risk`,
                                body: `${name} hasn't logged today — send some encouragement?`,
                                url: `/partner/${p.id}`,
                                tag: 'partner-streak-risk',
                            });
                            sent += s; failed += f;
                        }
                    }
                }
            }
        }

        // ── 5. Group challenges — daily maintenance (06:00 UTC) ───────────
        // Flip statuses, refresh member progress, and push milestones/results.
        if (currentHour === 6 && currentMinute === 0) {
            // Activate challenges whose window has started
            await supabase.from('challenges')
                .update({ status: 'active' })
                .eq('status', 'upcoming')
                .lte('start_date', todayDateStr);

            const { data: activeChallenges } = await supabase
                .from('challenges')
                .select('*')
                .eq('status', 'active');

            for (const challenge of (activeChallenges ?? [])) {
                const { data: memberRows } = await supabase
                    .from('challenge_members')
                    .select('*')
                    .eq('challenge_id', challenge.id)
                    .eq('status', 'joined');
                const members = memberRows ?? [];
                if (members.length === 0) continue;

                const memberIds = members.map(m => m.user_id);
                const [{ data: logs }, { data: challengeWorkouts }] = await Promise.all([
                    supabase.from('daily_logs')
                        .select('user_id, date, movement_completed, nutrition_logged, protein_grams, calories')
                        .in('user_id', memberIds)
                        .gte('date', challenge.start_date)
                        .lte('date', challenge.end_date),
                    supabase.from('workouts')
                        .select('user_id, date')
                        .in('user_id', memberIds)
                        .gte('date', challenge.start_date)
                        .lte('date', challenge.end_date),
                ]);

                for (const member of members) {
                    const progress = computeChallengeProgress(
                        challenge.challenge_type as ChallengeType,
                        (logs ?? []).filter(l => l.user_id === member.user_id),
                        (challengeWorkouts ?? []).filter(w => w.user_id === member.user_id),
                        challenge.start_date,
                        challenge.end_date,
                    );
                    member.progress = progress;
                    await supabase.from('challenge_members')
                        .update({ progress, progress_updated_at: now.toISOString() })
                        .eq('challenge_id', challenge.id)
                        .eq('user_id', member.user_id);

                    // Milestone: member reached the target (notify everyone once)
                    if (progress >= challenge.target_value && !member.milestone_notified) {
                        await supabase.from('challenge_members')
                            .update({ milestone_notified: true })
                            .eq('challenge_id', challenge.id)
                            .eq('user_id', member.user_id);
                        for (const other of members) {
                            const isSelf = other.user_id === member.user_id;
                            const { sent: s, failed: f } = await sendPushToUser(supabase, other.user_id, {
                                title: `🏆 ${challenge.name}`,
                                body: isSelf
                                    ? 'You hit the challenge target — amazing work!'
                                    : `${member.display_alias} just hit the challenge target!`,
                                url: `/partner/challenges/${challenge.id}`,
                                tag: `challenge-milestone-${challenge.id}`,
                            });
                            sent += s; failed += f;
                        }
                    }
                }

                // Challenge window over → complete + final results push
                if (challenge.end_date < todayDateStr) {
                    await supabase.from('challenges')
                        .update({ status: 'completed' })
                        .eq('id', challenge.id);
                    const top = [...members].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
                    for (const member of members) {
                        const { sent: s, failed: f } = await sendPushToUser(supabase, member.user_id, {
                            title: `🏁 ${challenge.name} finished`,
                            body: top
                                ? `${top.display_alias} leads the final board with ${top.progress}. See the results!`
                                : 'See the final results!',
                            url: `/partner/challenges/${challenge.id}`,
                            tag: `challenge-complete-${challenge.id}`,
                        });
                        sent += s; failed += f;
                    }
                }
            }
        }

        // ── Clean up expired tokens ───────────────────────────────────────
        await Promise.all([
            expiredEndpoints.length > 0
                ? supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
                : Promise.resolve(),
            expiredFcmTokens.length > 0
                ? supabase.from('device_tokens').delete().in('token', expiredFcmTokens)
                : Promise.resolve(),
        ]);

        return NextResponse.json({ success: true, sent, failed });
    } catch (error) {
        console.error('Cron send-reminders error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
