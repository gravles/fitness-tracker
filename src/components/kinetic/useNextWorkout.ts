'use client';

import { useState, useEffect } from 'react';
import { isToday } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getUpcomingWorkouts, ScheduledWorkout } from '@/lib/schedule-api';
import { haptics } from '@/lib/haptics';

/**
 * Next scheduled workout + the start/navigate action, shared between the
 * Kinetic "Up next" card and any other entry point.
 */
export function useNextWorkout() {
  const router = useRouter();
  const [workout, setWorkout] = useState<ScheduledWorkout | null>(null);

  useEffect(() => {
    getUpcomingWorkouts(1)
      .then(data => setWorkout(data[0] ?? null))
      .catch(err => console.error('Error loading next workout:', err));
  }, []);

  /** Today's workout starts a session; anything else lands on the schedule. */
  function start() {
    haptics.tap();
    if (workout && isToday(new Date(workout.scheduled_date + 'T00:00:00'))) {
      router.push(
        workout.template_id
          ? `/workout/active/new?template=${workout.template_id}&schedule=${workout.id}`
          : `/workout/active/new?schedule=${workout.id}`
      );
    } else {
      router.push('/schedule');
    }
  }

  return { workout, start };
}
