# Optimistic UI Hooks Usage Guide

## Overview

The optimistic UI hooks in `src/lib/use-optimistic.ts` provide instant feedback to users before server operations complete. This makes the app feel faster and more responsive.

## Available Hooks

### 1. `useOptimisticToggle`
For boolean toggles like checkboxes, switches, and yes/no buttons.

```tsx
import { useOptimisticToggle } from '@/lib/use-optimistic';

function FavoriteButton({ isFavorite, itemId }: { isFavorite: boolean; itemId: string }) {
    const { value, toggle, isPending } = useOptimisticToggle(
        isFavorite,
        async (newValue) => {
            await api.toggleFavorite(itemId, newValue);
        }
    );

    return (
        <button onClick={toggle} disabled={isPending}>
            {value ? '❤️ Favorited' : '🤍 Add to Favorites'}
        </button>
    );
}
```

### 2. `useOptimisticList`
For add/remove operations on lists.

```tsx
import { useOptimisticList } from '@/lib/use-optimistic';

function WorkoutList({ workouts }: { workouts: Workout[] }) {
    const { optimisticItems, addItem, removeItem, isPending } = useOptimisticList(
        workouts,
        async (workout) => {
            await api.createWorkout(workout);
        },
        async (id) => {
            await api.deleteWorkout(id);
        }
    );

    return (
        <ul>
            {optimisticItems.map(w => (
                <li key={w.id}>
                    {w.name}
                    <button onClick={() => removeItem(w.id)}>Delete</button>
                </li>
            ))}
        </ul>
    );
}
```

### 3. `useOptimisticSubmit`
For form submissions with loading state.

```tsx
import { useOptimisticSubmit } from '@/lib/use-optimistic';

function TemplateForm() {
    const { submit, isPending } = useOptimisticSubmit(
        async (data: { name: string; exercises: Exercise[] }) => {
            await createTemplate(data.name, data.exercises);
        },
        {
            onSuccess: () => alert('Saved!'),
            onError: (e) => alert(`Error: ${e.message}`),
        }
    );

    return (
        <button onClick={() => submit({ name, exercises })} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Template'}
        </button>
    );
}
```

### 4. `useOptimisticCounter`
For increment/decrement values like XP, counts, quantities.

```tsx
import { useOptimisticCounter } from '@/lib/use-optimistic';

function WaterTracker({ glasses }: { glasses: number }) {
    const { value, increment, decrement, isPending } = useOptimisticCounter(
        glasses,
        async (newValue) => {
            await api.updateWaterGlasses(newValue);
        }
    );

    return (
        <div>
            <button onClick={() => decrement()}>-</button>
            <span>{value} glasses</span>
            <button onClick={() => increment()}>+</button>
        </div>
    );
}
```

## Best Use Cases in This App

| Hook | Where to Use |
|------|--------------|
| `useOptimisticToggle` | Favorite food items, habit checkboxes |
| `useOptimisticList` | Quick-add food items, workout exercises |
| `useOptimisticSubmit` | Template save, goal creation |
| `useOptimisticCounter` | Water glasses, sleep hours |

## Key Benefits

1. **Instant feedback** - UI updates immediately
2. **Automatic rollback** - If API fails, state reverts automatically
3. **Built-in loading states** - `isPending` for UI feedback
4. **No extra state management** - Uses React 19's `useOptimistic`

## When NOT to Use

- When parent component manages state (like DailyLogForm does currently)
- For critical operations that need server confirmation first
- When you need complex error handling beyond rollback
