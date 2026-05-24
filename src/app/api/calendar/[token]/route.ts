import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * Convert a local wall-clock date+time in a given IANA timezone to a UTC Date.
 * Uses the Intl API — no external library required.
 */
function localToUtcDate(dateStr: string, timeStr: string, tz: string): Date {
    const probe     = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00Z`);
    const localRepr = probe.toLocaleString('sv-SE', { timeZone: tz }); // "YYYY-MM-DD HH:mm:ss"
    const localMs   = new Date(localRepr.replace(' ', 'T') + 'Z').getTime();
    const offsetMs  = localMs - probe.getTime();
    return new Date(probe.getTime() - offsetMs);
}

/** Format a Date to iCal UTC timestamp: YYYYMMDDTHHMMSSZ */
function toIcalDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape iCal text values (RFC 5545 §3.3.11) */
function escapeIcal(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/** Fold long iCal lines at 75 octets */
function foldLine(line: string): string {
    const chunks: string[] = [];
    while (line.length > 75) {
        chunks.push(line.slice(0, 75));
        line = ' ' + line.slice(75);
    }
    chunks.push(line);
    return chunks.join('\r\n');
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    if (!token || token.length < 10) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const supabase = getSupabaseAdmin();

    // Look up user by calendar_token
    const { data: userSettings, error: settingsError } = await supabase
        .from('user_settings')
        .select('user_id, timezone, display_name')
        .eq('calendar_token', token)
        .maybeSingle();

    if (settingsError || !userSettings) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const { user_id, timezone = 'UTC', display_name } = userSettings;
    const calendarName = display_name ? `${display_name}'s Workouts` : 'My Workouts';

    // Fetch next 90 days from both tables in parallel
    const today       = new Date();
    const in90Days    = new Date(today.getTime() + 90 * 86_400_000);
    const todayStr    = today.toISOString().slice(0, 10);
    const in90DaysStr = in90Days.toISOString().slice(0, 10);

    const [{ data: adHocWorkouts }, { data: programSessions }] = await Promise.all([
        // Ad-hoc scheduled workouts
        supabase
            .from('scheduled_workouts')
            .select('id, scheduled_date, scheduled_time, title, notes, duration_minutes')
            .eq('user_id', user_id)
            .eq('status', 'scheduled')
            .gte('scheduled_date', todayStr)
            .lte('scheduled_date', in90DaysStr)
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time',  { ascending: true }),

        // Program sessions
        supabase
            .from('program_sessions')
            .select('id, scheduled_date, scheduled_time, day_label, notes')
            .eq('user_id', user_id)
            .in('status', ['upcoming', 'rescheduled'])
            .gte('scheduled_date', todayStr)
            .lte('scheduled_date', in90DaysStr)
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time',  { ascending: true }),
    ]);

    // Normalise into a single list
    interface CalEvent {
        uid:             string;
        date:            string;
        time:            string;
        title:           string;
        notes?:          string | null;
        durationMinutes: number;
    }

    const events: CalEvent[] = [
        ...(adHocWorkouts ?? []).map(w => ({
            uid:             `adhoc-${w.id}@fitness-tracker`,
            date:            w.scheduled_date,
            time:            w.scheduled_time,
            title:           w.title,
            notes:           w.notes,
            durationMinutes: w.duration_minutes ?? 60,
        })),
        ...(programSessions ?? []).map(s => ({
            uid:             `program-${s.id}@fitness-tracker`,
            date:            s.scheduled_date,
            time:            s.scheduled_time ?? '12:00:00',
            title:           s.day_label,
            notes:           s.notes,
            durationMinutes: 60,
        })),
    ];

    // Sort combined list by date then time
    events.sort((a, b) =>
        a.date !== b.date
            ? a.date.localeCompare(b.date)
            : a.time.localeCompare(b.time)
    );

    // Build iCal
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Fitness Tracker//Workout Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeIcal(calendarName)}`,
        'X-WR-TIMEZONE:UTC',
        'X-WR-CALDESC:Scheduled workouts from Fitness Tracker',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'X-PUBLISHED-TTL:PT1H',
    ];

    const dtStamp = toIcalDate(new Date());

    for (const ev of events) {
        const startUtc = localToUtcDate(ev.date, ev.time, timezone);
        const endUtc   = new Date(startUtc.getTime() + ev.durationMinutes * 60_000);

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${ev.uid}`);
        lines.push(`DTSTAMP:${dtStamp}`);
        lines.push(`DTSTART:${toIcalDate(startUtc)}`);
        lines.push(`DTEND:${toIcalDate(endUtc)}`);
        lines.push(`SUMMARY:🏋️ ${escapeIcal(ev.title)}`);
        if (ev.notes) {
            lines.push(`DESCRIPTION:${escapeIcal(ev.notes)}`);
        }
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const icsBody = lines.map(foldLine).join('\r\n') + '\r\n';

    return new NextResponse(icsBody, {
        status: 200,
        headers: {
            'Content-Type':        'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="workouts.ics"`,
            'Cache-Control':       'no-cache, no-store, must-revalidate',
        },
    });
}
