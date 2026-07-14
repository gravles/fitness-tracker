import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, getDisplayName } from '@/lib/partner-server';
import { sendPushToUser } from '@/lib/push-server';

const TYPE_LABELS: Record<string, string> = {
    workout_template: 'a workout',
    saved_meal: 'a meal',
    favorite_food: 'a food idea',
};

/**
 * POST /api/partner/notify-share  { itemId }
 * Pushes a notification for a share the caller just created. The row itself
 * was inserted client-side under RLS; this route only verifies ownership and
 * notifies the recipient.
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { itemId } = await req.json();
        if (!itemId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        const { data: item } = await admin
            .from('partner_shared_items')
            .select('id, from_user_id, to_user_id, item_type, payload')
            .eq('id', itemId)
            .maybeSingle();
        if (!item || item.from_user_id !== caller.id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const senderName = await getDisplayName(admin, caller.id);
        const label = TYPE_LABELS[item.item_type] ?? 'something';
        const itemName = (item.payload as any)?.name;

        await sendPushToUser(admin, item.to_user_id, {
            title: `🎁 ${senderName} shared ${label}`,
            body: itemName ? `“${itemName}” — save it to your library with one tap.` : 'Open the app to check it out.',
            url: '/partner',
            tag: 'partner-share',
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Partner notify-share error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
