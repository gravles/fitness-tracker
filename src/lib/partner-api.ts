// Client-side data layer for the workout partner feature.
//
// Reads that only touch the caller's own rows (or rows RLS explicitly grants,
// like partnerships and shared items) query Supabase directly. Everything
// cross-user or privileged goes through the /api/partner/* routes, which
// enforce share levels with the service-role key.
import { supabase } from './supabase';
import { saveAsTemplate, TemplateExercise, WorkoutCategory, WorkoutDifficulty } from './features';
import { createSavedMeal, addFavoriteFood } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShareLevel = 'summary' | 'full';
export type PartnershipStatus = 'pending' | 'active' | 'paused' | 'declined' | 'ended';

export interface Partnership {
    id: string;
    inviter_id: string;
    invitee_id: string | null;
    invitee_email: string;
    status: PartnershipStatus;
    inviter_share_level: ShareLevel;
    invitee_share_level: ShareLevel;
    invited_at: string;
    accepted_at: string | null;
    // Derived client-side:
    isInviter: boolean;
    otherUserId: string | null;
    otherName: string | null;
    myShareLevel: ShareLevel;
}

export interface PartnerSummary {
    daysLogged: number;
    workoutsCount: number;
    proteinDays: number;
    avgSleep: string;
    lastNote: string;
    streak: number;
    level: number | null;
}

export interface PartnerFullData {
    recentWorkouts: {
        date: string;
        activityType: string | null;
        duration: number | null;
        intensity: string | null;
        exercises: string[];
    }[];
    recentLogs: {
        date: string;
        calories: number | null;
        proteinGrams: number | null;
        carbsGrams: number | null;
        fatGrams: number | null;
        movementType: string | null;
        movementDuration: number | null;
    }[];
}

export interface PartnerDashboard {
    partnership: {
        id: string;
        status: PartnershipStatus;
        since: string | null;
        myShareLevel: ShareLevel;
        theirShareLevel: ShareLevel;
    };
    partner: { name: string | null };
    paused?: boolean;
    summary?: PartnerSummary;
    full?: PartnerFullData;
}

export type SharedItemType = 'workout_template' | 'saved_meal' | 'favorite_food';

export interface WorkoutTemplatePayload {
    name: string;
    description?: string;
    category?: WorkoutCategory;
    difficulty?: WorkoutDifficulty;
    estimated_duration?: number;
    exercises: TemplateExercise[];
}

export interface SavedMealPayload {
    name: string;
    food_items: any[];
}

export interface FavoriteFoodPayload {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion_estimate?: string;
}

export interface SharedItem {
    id: string;
    partnership_id: string;
    from_user_id: string;
    to_user_id: string;
    item_type: SharedItemType;
    payload: WorkoutTemplatePayload | SavedMealPayload | FavoriteFoodPayload;
    message: string | null;
    status: 'new' | 'saved' | 'dismissed';
    created_at: string;
    fromName?: string | null;
}

export type NudgeType = 'encouragement' | 'check_in' | 'streak_save' | 'system_not_logged';

export interface Nudge {
    id: string;
    partnership_id: string;
    from_user_id: string | null;
    to_user_id: string;
    nudge_type: NudgeType;
    message: string | null;
    created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(options.headers ?? {}),
        },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
    return body;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

/** Keep my profiles row current so partners can see my name. */
export async function ensureMyProfile(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const user = session.user;
    const fullName = (user.user_metadata as any)?.full_name
        ?? (user.user_metadata as any)?.name
        ?? null;
    await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email?.toLowerCase(),
        ...(fullName ? { full_name: fullName } : {}),
    }, { onConflict: 'id' });
}

export async function updateMyProfileName(fullName: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email?.toLowerCase(),
        full_name: fullName,
    }, { onConflict: 'id' });
    if (error) throw error;
}

// ─── Partnerships ────────────────────────────────────────────────────────────

/** All partnerships visible to me (RLS-scoped), with partner names attached. */
export async function getPartnerships(): Promise<Partnership[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const me = session.user.id;

    const { data, error } = await supabase
        .from('partnerships')
        .select('*')
        .in('status', ['pending', 'active', 'paused'])
        .order('invited_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as any[];
    const otherIds = Array.from(new Set(
        rows.map(r => r.inviter_id === me ? r.invitee_id : r.inviter_id).filter(Boolean)
    ));

    const namesById: Record<string, string | null> = {};
    if (otherIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', otherIds);
        for (const p of (profiles ?? [])) namesById[p.id] = p.full_name;
    }

    return rows.map(r => {
        const isInviter = r.inviter_id === me;
        const otherUserId = isInviter ? r.invitee_id : r.inviter_id;
        return {
            ...r,
            isInviter,
            otherUserId,
            otherName: otherUserId ? (namesById[otherUserId] ?? null) : null,
            myShareLevel: isInviter ? r.inviter_share_level : r.invitee_share_level,
        } as Partnership;
    });
}

export async function invitePartner(email: string): Promise<void> {
    await authFetch('/api/partner/invite', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

export async function respondToInvite(partnershipId: string, action: 'accept' | 'decline'): Promise<void> {
    await authFetch('/api/partner/respond', {
        method: 'POST',
        body: JSON.stringify({ partnershipId, action }),
    });
}

export async function updateShareLevel(partnershipId: string, shareLevel: ShareLevel): Promise<void> {
    await authFetch('/api/partner/update', {
        method: 'POST',
        body: JSON.stringify({ partnershipId, op: 'share_level', shareLevel }),
    });
}

export async function setPartnershipStatus(partnershipId: string, op: 'pause' | 'resume' | 'end'): Promise<void> {
    await authFetch('/api/partner/update', {
        method: 'POST',
        body: JSON.stringify({ partnershipId, op }),
    });
}

export async function getPartnerDashboard(partnershipId: string): Promise<PartnerDashboard> {
    return authFetch(`/api/partner/summary?partnershipId=${encodeURIComponent(partnershipId)}`);
}

// ─── Shared items (M2) ───────────────────────────────────────────────────────

export async function shareItemToPartner(
    partnership: Partnership,
    itemType: SharedItemType,
    payload: WorkoutTemplatePayload | SavedMealPayload | FavoriteFoodPayload,
    message?: string,
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    if (!partnership.otherUserId) throw new Error('Partner is not linked yet');

    const { data, error } = await supabase
        .from('partner_shared_items')
        .insert({
            partnership_id: partnership.id,
            from_user_id: session.user.id,
            to_user_id: partnership.otherUserId,
            item_type: itemType,
            payload,
            message: message || null,
        })
        .select()
        .single();
    if (error) throw error;

    // Best-effort push to the recipient — the share itself already succeeded
    authFetch('/api/partner/notify-share', {
        method: 'POST',
        body: JSON.stringify({ itemId: data.id }),
    }).catch(() => {});
}

export async function getSharedInbox(): Promise<SharedItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('partner_shared_items')
        .select('*')
        .eq('to_user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) throw error;

    const items = (data ?? []) as SharedItem[];
    const fromIds = Array.from(new Set(items.map(i => i.from_user_id)));
    if (fromIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', fromIds);
        const names: Record<string, string | null> = {};
        for (const p of (profiles ?? [])) names[p.id] = p.full_name;
        for (const item of items) item.fromName = names[item.from_user_id] ?? null;
    }
    return items;
}

/** One-tap save: copies the snapshot into my own library, marks the share saved. */
export async function saveSharedItem(item: SharedItem): Promise<void> {
    if (item.item_type === 'workout_template') {
        const p = item.payload as WorkoutTemplatePayload;
        await saveAsTemplate(p.name, p.exercises, {
            description: p.description,
            category: p.category,
            difficulty: p.difficulty,
            estimatedDuration: p.estimated_duration,
        });
    } else if (item.item_type === 'saved_meal') {
        const p = item.payload as SavedMealPayload;
        await createSavedMeal(p.name, p.food_items);
    } else {
        const p = item.payload as FavoriteFoodPayload;
        await addFavoriteFood({
            name: p.name,
            calories: p.calories,
            protein: p.protein,
            carbs: p.carbs,
            fat: p.fat,
            portion_estimate: p.portion_estimate,
        });
    }
    await setSharedItemStatus(item.id, 'saved');
}

export async function dismissSharedItem(itemId: string): Promise<void> {
    await setSharedItemStatus(itemId, 'dismissed');
}

async function setSharedItemStatus(itemId: string, status: 'saved' | 'dismissed'): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { error } = await supabase
        .from('partner_shared_items')
        .update({ status })
        .eq('id', itemId)
        .eq('to_user_id', session.user.id);
    if (error) throw error;
}

// ─── Nudges (M2) ─────────────────────────────────────────────────────────────

export async function sendNudge(
    partnershipId: string,
    nudgeType: 'encouragement' | 'check_in' | 'streak_save',
    message?: string,
): Promise<void> {
    await authFetch('/api/partner/nudge', {
        method: 'POST',
        body: JSON.stringify({ partnershipId, nudgeType, message }),
    });
}

// ─── Group challenges (M3) ───────────────────────────────────────────────────

export type ChallengeType = 'streak' | 'protein_days' | 'workout_count';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ChallengeMemberStatus = 'invited' | 'joined' | 'declined' | 'left';

export interface ChallengeListItem {
    id: string;
    name: string;
    challenge_type: ChallengeType;
    target_value: number;
    start_date: string;
    end_date: string;
    is_anonymous: boolean;
    status: ChallengeStatus;
    myStatus: ChallengeMemberStatus;
    myProgress: number;
}

export interface ChallengeDetail {
    challenge: {
        id: string;
        name: string;
        description: string | null;
        challengeType: ChallengeType;
        targetValue: number;
        startDate: string;
        endDate: string;
        isAnonymous: boolean;
        status: ChallengeStatus;
        isCreator: boolean;
    };
    myStatus: ChallengeMemberStatus;
    leaderboard: {
        alias: string;
        name: string | null;
        isMe: boolean;
        progress: number;
        status: ChallengeMemberStatus;
    }[];
}

export interface CreateChallengeInput {
    name: string;
    description?: string;
    challengeType: ChallengeType;
    targetValue: number;
    startDate: string;
    endDate: string;
    isAnonymous: boolean;
    partnershipIds: string[];
}

/** Challenges I'm a member of (invited or joined), newest first. */
export async function getChallenges(): Promise<ChallengeListItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const me = session.user.id;

    const { data: memberships, error } = await supabase
        .from('challenge_members')
        .select('challenge_id, user_id, status, progress')
        .eq('user_id', me)
        .in('status', ['invited', 'joined']);
    if (error) throw error;
    if (!memberships || memberships.length === 0) return [];

    const { data: challenges, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .in('id', memberships.map(m => m.challenge_id))
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
    if (challengeError) throw challengeError;

    const membershipByChallenge = new Map(memberships.map(m => [m.challenge_id, m]));
    return (challenges ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        challenge_type: c.challenge_type,
        target_value: c.target_value,
        start_date: c.start_date,
        end_date: c.end_date,
        is_anonymous: c.is_anonymous,
        status: c.status,
        myStatus: membershipByChallenge.get(c.id)!.status,
        myProgress: membershipByChallenge.get(c.id)!.progress ?? 0,
    }));
}

export async function createChallenge(input: CreateChallengeInput): Promise<string> {
    const res = await authFetch('/api/partner/challenges', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return res.challengeId;
}

export async function getChallengeDetail(id: string): Promise<ChallengeDetail> {
    return authFetch(`/api/partner/challenges/${encodeURIComponent(id)}`);
}

export async function respondToChallenge(
    id: string,
    action: 'join' | 'decline' | 'leave' | 'cancel',
): Promise<void> {
    await authFetch(`/api/partner/challenges/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ action }),
    });
}

/** Recent nudges sent to me (for the partner page feed). */
export async function getRecentNudges(): Promise<Nudge[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('partner_nudges')
        .select('*')
        .eq('to_user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) throw error;
    return (data ?? []) as Nudge[];
}
