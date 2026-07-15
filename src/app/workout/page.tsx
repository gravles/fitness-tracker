import { redirect } from 'next/navigation';

// The old "Workout Hub" duplicated /schedule (which the bottom nav already
// points at) and was unreachable from primary navigation. Its useful links
// live on /schedule and /more now.
export default function WorkoutHubRedirect() {
    redirect('/schedule');
}
