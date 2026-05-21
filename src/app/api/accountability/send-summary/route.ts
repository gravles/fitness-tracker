import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, format, startOfWeek } from 'date-fns';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        // Get user from token
        const { data: { user }, error: authError } = token
            ? await supabaseAdmin.auth.getUser(token)
            : { data: { user: null }, error: null };

        if (!user) {
            // Try cookie-based auth via the request body (client sends partnerId)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { partnerId } = await req.json();

        // Fetch the partner
        const { data: partner, error: partnerError } = await supabaseAdmin
            .from('accountability_partners')
            .select('*')
            .eq('id', partnerId)
            .eq('user_id', user.id)
            .single();

        if (partnerError || !partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
        }

        // Gather last 7 days of data
        const today = new Date();
        const weekAgo = subDays(today, 7);
        const startStr = format(weekAgo, 'yyyy-MM-dd');
        const endStr = format(today, 'yyyy-MM-dd');

        const { data: logs } = await supabaseAdmin
            .from('daily_logs')
            .select('date, movement_completed, protein_grams, calories, sleep_quality, energy_level, daily_note')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr);

        const { data: workouts } = await supabaseAdmin
            .from('workouts')
            .select('date, activity_type, duration')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lte('date', endStr);

        // Compute stats
        const daysLogged = logs?.length ?? 0;
        const workoutsCount = workouts?.length ?? 0;
        const proteinDays = logs?.filter(l => l.protein_grams && l.protein_grams >= 100).length ?? 0;
        const avgSleep = logs && logs.length > 0
            ? (logs.reduce((s, l) => s + (l.sleep_quality || 0), 0) / logs.length).toFixed(1)
            : '—';
        const lastNote = logs?.findLast(l => l.daily_note)?.daily_note || '';

        // Get user profile for first name
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
        const userName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'your friend';

        // Build email HTML
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .card { background: white; border-radius: 16px; padding: 28px; max-width: 480px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #1a1a2e; }
  .sub { color: #888; font-size: 14px; margin-bottom: 24px; }
  .stat { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
  .stat:last-child { border-bottom: none; }
  .label { color: #888; font-size: 14px; }
  .value { font-weight: 700; color: #1a1a2e; font-size: 16px; }
  .note { background: #f8f8f8; border-radius: 10px; padding: 14px; margin-top: 16px; color: #555; font-size: 14px; font-style: italic; }
  .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #aaa; }
</style></head>
<body>
  <div class="card">
    <h1>Weekly check-in 📊</h1>
    <p class="sub">Here's how ${userName} did last week (${format(weekAgo, 'MMM d')} – ${format(today, 'MMM d')})</p>
    <div class="stat"><span class="label">Days logged</span><span class="value">${daysLogged} / 7</span></div>
    <div class="stat"><span class="label">Workouts completed</span><span class="value">${workoutsCount}</span></div>
    <div class="stat"><span class="label">Protein goal days</span><span class="value">${proteinDays} / 7</span></div>
    <div class="stat"><span class="label">Avg sleep quality</span><span class="value">${avgSleep} / 5</span></div>
    ${lastNote ? `<div class="note">"${lastNote}"</div>` : ''}
    <p class="footer">Sent by Fitness Tracker · You're receiving this because ${userName} added you as an accountability partner.</p>
  </div>
</body>
</html>`;

        // Send via Resend if configured, else log and return success for dev
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: 'Fitness Tracker <noreply@fit.nathandavie.com>',
                    to: [partner.partner_email],
                    subject: `${userName}'s weekly fitness check-in 💪`,
                    html: emailHtml,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                console.error('Resend error:', err);
                return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
            }
        } else {
            console.log('[accountability] No RESEND_API_KEY set — email would go to:', partner.partner_email);
            console.log('[accountability] Stats:', { daysLogged, workoutsCount, proteinDays, avgSleep });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Accountability summary error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
