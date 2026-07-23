'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { HeartPulse, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui';
import { getDailyLog, getSettings, upsertDailyLog } from '@/lib/api';
import { checkAndAwardBadges } from '@/lib/badges';
import { haptics } from '@/lib/haptics';
import { SubjectiveSection } from '@/components/daily-log/SubjectiveSection';
import { HabitsSection } from '@/components/daily-log/HabitsSection';

/**
 * Evening wellness check-in on Home — the old /log Wellness tab (sleep,
 * energy, motivation, stress, note, habits) as a card + sheet. Complements
 * the morning ReadinessCheckIn, which covers sleep/energy/drinks on wake.
 */
export function WellnessCheckIn({ stagger }: { stagger?: number }) {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjective, setSubjective] = useState({ sleep: 3, energy: 3, motivation: 3, stress: 3, note: '' });
  const [habits, setHabits] = useState<string[]>([]);
  const [availableHabits, setAvailableHabits] = useState<string[]>([]);
  const [loggedToday, setLoggedToday] = useState(false);

  const load = useCallback(async () => {
    try {
      const [log, settings] = await Promise.all([
        getDailyLog(dateStr).catch(() => null),
        getSettings().catch(() => null),
      ]);
      setSubjective({
        sleep: log?.sleep_quality ?? 3,
        energy: log?.energy_level ?? 3,
        motivation: log?.motivation_level ?? 3,
        stress: log?.stress_level ?? 3,
        note: log?.daily_note ?? '',
      });
      setHabits(log?.habits ?? []);
      setAvailableHabits(settings?.custom_habits ?? []);
      setLoggedToday(!!(log?.motivation_level || log?.stress_level || (log?.habits?.length ?? 0) > 0));
    } catch {
      // never block Home on the check-in
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await upsertDailyLog({
        date: dateStr,
        sleep_quality: subjective.sleep,
        energy_level: subjective.energy,
        motivation_level: subjective.motivation,
        stress_level: subjective.stress,
        daily_note: subjective.note,
        habits,
      });
      haptics.success();
      setLoggedToday(true);
      setOpen(false);
      toast.success('Check-in saved');
      checkAndAwardBadges();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save check-in');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3.5 py-3 text-left animate-in focus-ring transition-kinetic active:scale-[0.99]"
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-card)',
          ['--stagger' as string]: `${stagger ?? 0}ms`,
        }}
        aria-label="Open wellness check-in"
      >
        <div className="flex items-center gap-3 min-w-0">
          <HeartPulse className="w-4 h-4 shrink-0" style={{ color: loggedToday ? 'var(--chart-2)' : 'var(--color-gold-text)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--color-text)]">Wellness check-in</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
              {loggedToday ? 'Logged for today — tap to update' : 'Mood, stress, habits & a note for today'}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Wellness check-in" size="md">
        <div className="space-y-5">
          <SubjectiveSection subjective={subjective} setSubjective={setSubjective} />
          <HabitsSection habits={habits} setHabits={setHabits} availableHabits={availableHabits} />
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-full text-sm font-bold text-white transition-kinetic active:scale-[0.98] disabled:opacity-60 focus-ring"
            style={{ background: 'var(--color-primary)', boxShadow: '0 6px 20px rgba(91, 156, 246, 0.3)' }}
          >
            {saving ? 'Saving…' : 'Save check-in'}
          </button>
        </div>
      </Modal>
    </>
  );
}
