'use client';

import { useState, useEffect } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Dumbbell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUpcomingWorkouts, ScheduledWorkout } from '@/lib/schedule-api';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/components/LanguageProvider';
import { StatTile } from '@/components/ui';

export function NextWorkoutTile({ stagger }: { stagger?: number }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [workout, setWorkout] = useState<ScheduledWorkout | null>(null);

  useEffect(() => {
    getUpcomingWorkouts(1)
      .then(data => setWorkout(data[0] ?? null))
      .catch(err => console.error('Error loading next workout:', err));
  }, []);

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    if (isToday(date)) return t.upcoming.today;
    if (isTomorrow(date)) return t.upcoming.tomorrow;
    return format(date, 'EEE, MMM d');
  }

  function handleClick() {
    haptics.tap();
    if (workout && isToday(new Date(workout.scheduled_date + 'T00:00:00'))) {
      router.push(workout.template_id
        ? `/workout/active/new?template=${workout.template_id}&schedule=${workout.id}`
        : `/workout/active/new?schedule=${workout.id}`);
    } else {
      router.push('/schedule');
    }
  }

  return (
    <StatTile
      icon={Dumbbell}
      iconColor="var(--color-primary)"
      label={t.dashboard.nextWorkout}
      value={workout ? workout.title : t.dashboard.noneScheduled}
      sub={workout ? `${formatDate(workout.scheduled_date)} · ${workout.scheduled_time.slice(0, 5)}` : t.upcoming.scheduleDesc}
      onClick={handleClick}
      stagger={stagger}
      aria-label={t.dashboard.nextWorkout}
    />
  );
}
