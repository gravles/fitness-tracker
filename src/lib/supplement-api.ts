import { supabase } from './supabase';
import { format } from 'date-fns';
import { expandRecurrence } from './recurrence';

export const SUPPLEMENT_KINDS = ['supplement', 'medication'] as const;
export type SupplementKind = (typeof SUPPLEMENT_KINDS)[number];

export const DOSE_UNITS = ['mg', 'mcg', 'g', 'IU', 'ml', 'capsule', 'tablet', 'scoop', 'drop', 'puff', 'unit'] as const;
export const SUPPLEMENT_FORMS = ['capsule', 'tablet', 'powder', 'liquid', 'gummy', 'injection', 'topical', 'other'] as const;

export type DoseStatus = 'planned' | 'taken' | 'skipped';

export interface Supplement {
    id: string;
    user_id: string;
    name: string;
    kind: SupplementKind;
    dose_amount: number | null;
    dose_unit: string | null;
    form: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface SupplementDose {
    id: string;
    user_id: string;
    supplement_id: string | null;
    name: string;
    kind: SupplementKind;
    dose_amount: number | null;
    dose_unit: string | null;
    scheduled_date: string;        // YYYY-MM-DD
    scheduled_time: string | null; // HH:MM:SS, null for ad-hoc/PRN logs
    status: DoseStatus;
    taken_at: string | null;
    skipped_reason: string | null;
    notes: string | null;
    remind_minutes: number | null;
    reminder_sent: boolean;
    created_at: string;
    updated_at: string;
}

/** Compact "500 mg" style label; empty string when no dose is stored. */
export function formatDose(d: { dose_amount: number | null; dose_unit: string | null }): string {
    if (d.dose_amount == null) return d.dose_unit ?? '';
    return `${d.dose_amount}${d.dose_unit ? ` ${d.dose_unit}` : ''}`;
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export async function getSupplements(): Promise<Supplement[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function saveSupplement(input: {
    id?: string;
    name: string;
    kind?: SupplementKind;
    doseAmount?: number | null;
    doseUnit?: string | null;
    form?: string | null;
    notes?: string | null;
}): Promise<Supplement> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const fields = {
        name:        input.name.trim(),
        kind:        input.kind ?? 'supplement',
        dose_amount: input.doseAmount ?? null,
        dose_unit:   input.doseUnit ?? null,
        form:        input.form ?? null,
        notes:       input.notes ?? null,
        updated_at:  new Date().toISOString(),
    };

    if (input.id) {
        const { data, error } = await supabase
            .from('supplements')
            .update(fields)
            .eq('id', input.id)
            .eq('user_id', session.user.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('supplements')
        .insert({ ...fields, user_id: session.user.id })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteSupplement(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('supplements')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);
    if (error) throw error;
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

/**
 * Materialize dose rows for a supplement: every date in the recurrence
 * pattern × every time of day. Without daysOfWeek/until, just startDate.
 */
export async function scheduleDoses(input: {
    supplement: Supplement;
    startDate: string;             // YYYY-MM-DD
    times: string[];               // HH:MM
    daysOfWeek?: string[];         // ['mon', 'wed', ...]
    until?: string;                // YYYY-MM-DD inclusive
    remind?: boolean;
    notes?: string | null;
}): Promise<SupplementDose[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    if (!input.times.length) throw new Error('At least one time of day is required');

    const dates = input.daysOfWeek?.length && input.until
        ? expandRecurrence(input.startDate, input.daysOfWeek, input.until, 90).dates
        : [input.startDate];

    const rows = dates.flatMap(date =>
        input.times.map(time => ({
            user_id:        session.user.id,
            supplement_id:  input.supplement.id,
            name:           input.supplement.name,
            kind:           input.supplement.kind,
            dose_amount:    input.supplement.dose_amount,
            dose_unit:      input.supplement.dose_unit,
            scheduled_date: date,
            scheduled_time: time.length === 5 ? `${time}:00` : time,
            status:         'planned',
            notes:          input.notes ?? null,
            remind_minutes: input.remind === false ? null : 0,
        }))
    );

    const { data, error } = await supabase
        .from('supplement_doses')
        .insert(rows)
        .select();
    if (error) throw error;
    return data || [];
}

/** Delete future planned doses of a supplement — the "stopped taking it" flow. */
export async function cancelFutureDoses(supplementId: string, fromDate: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('supplement_doses')
        .delete()
        .eq('user_id', session.user.id)
        .eq('supplement_id', supplementId)
        .eq('status', 'planned')
        .gte('scheduled_date', fromDate);
    if (error) throw error;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getDosesForRange(startDate: string, endDate: string): Promise<SupplementDose[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('supplement_doses')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
}

export async function getTodaysDoses(): Promise<SupplementDose[]> {
    const today = format(new Date(), 'yyyy-MM-dd');
    return getDosesForRange(today, today);
}

// ─── Dose mutations ──────────────────────────────────────────────────────────

async function updateDose(id: string, patch: Record<string, unknown>): Promise<SupplementDose> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('supplement_doses')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', session.user.id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function markDoseTaken(id: string): Promise<SupplementDose> {
    return updateDose(id, { status: 'taken', taken_at: new Date().toISOString(), skipped_reason: null });
}

export async function skipDose(id: string, reason?: string): Promise<SupplementDose> {
    return updateDose(id, { status: 'skipped', skipped_reason: reason ?? null, taken_at: null });
}

export async function undoDose(id: string): Promise<SupplementDose> {
    return updateDose(id, { status: 'planned', taken_at: null, skipped_reason: null });
}

/** Log an unscheduled (PRN / as-needed) intake straight to history. */
export async function logAdhocDose(input: {
    supplement?: Supplement;
    name?: string;
    doseAmount?: number | null;
    doseUnit?: string | null;
    date?: string;                 // YYYY-MM-DD, defaults to today
    notes?: string | null;
}): Promise<SupplementDose> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const name = input.supplement?.name ?? input.name?.trim();
    if (!name) throw new Error('A supplement or name is required');

    const { data, error } = await supabase
        .from('supplement_doses')
        .insert({
            user_id:        session.user.id,
            supplement_id:  input.supplement?.id ?? null,
            name,
            kind:           input.supplement?.kind ?? 'supplement',
            dose_amount:    input.doseAmount ?? input.supplement?.dose_amount ?? null,
            dose_unit:      input.doseUnit ?? input.supplement?.dose_unit ?? null,
            scheduled_date: input.date ?? format(new Date(), 'yyyy-MM-dd'),
            scheduled_time: null,
            status:         'taken',
            taken_at:       new Date().toISOString(),
            notes:          input.notes ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}
