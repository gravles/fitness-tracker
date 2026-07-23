'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getDailyLog, upsertDailyLog, getWorkouts, addWorkout, Workout } from '@/lib/api';
import { checkAndAwardBadges } from '@/lib/badges';
import { MovementSection } from '@/components/daily-log/MovementSection';
import { WorkoutChatModal } from '@/components/WorkoutChatModal';

/**
 * Hosts the old /log Activity tab on the Workout hub: today's moved/rest
 * toggle, workout list with quick-add presets, custom entry, and the AI coach
 * chat. Owns its own state + persistence (the daily-log form is gone).
 */
export function TodayActivitySection() {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const [movementCompleted, setMovementCompleted] = useState<boolean | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [addingWorkout, setAddingWorkout] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [log, todayWorkouts] = await Promise.all([
        getDailyLog(dateStr).catch(() => null),
        getWorkouts(dateStr).catch(() => []),
      ]);
      setMovementCompleted(log?.movement_completed ?? null);
      setWorkouts(todayWorkouts);
    } catch (e) {
      console.error('Failed to load today activity', e);
    } finally {
      setLoaded(true);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  async function persistMovement(val: boolean, totalDuration: number) {
    try {
      await upsertDailyLog({
        date: dateStr,
        movement_completed: val,
        movement_duration: totalDuration,
      });
      checkAndAwardBadges();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save movement');
    }
  }

  if (!loaded) return null;

  return (
    <>
      <MovementSection
        movementCompleted={movementCompleted}
        setMovementCompleted={(val) => {
          setMovementCompleted(val);
          persistMovement(val, workouts.reduce((a, w) => a + w.duration, 0));
        }}
        workouts={workouts}
        setWorkouts={(next) => {
          setWorkouts(next);
          // Adding a workout implies movement happened today
          const total = next.reduce((a, w) => a + w.duration, 0);
          if (next.length > 0 && movementCompleted !== true) {
            setMovementCompleted(true);
            persistMovement(true, total);
          } else {
            upsertDailyLog({ date: dateStr, movement_duration: total }).catch(() => {});
          }
        }}
        dateStr={dateStr}
        onOpenAiCoach={() => setShowChat(true)}
        onAddWorkoutStart={() => setAddingWorkout(true)}
        addingWorkout={addingWorkout}
        onDeleteWorkoutStart={() => {}}
      />

      <WorkoutChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onSave={async (workout) => {
          try {
            const added = await addWorkout({ ...workout, date: dateStr });
            setWorkouts(prev => [...prev, added]);
            setMovementCompleted(true);
            persistMovement(true, [...workouts, added].reduce((a, w) => a + w.duration, 0));
            toast.success(`Logged: ${workout.activity_type}`);
          } catch (e) {
            console.error(e);
            toast.error('Failed to save workout');
          }
        }}
      />
    </>
  );
}
