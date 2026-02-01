'use client';

import { useOptimistic, useTransition, useCallback } from 'react';

/**
 * Custom hook for optimistic updates with automatic rollback on error
 * 
 * @example
 * const [optimisticItems, addItem, removeItem] = useOptimisticList(items, async (item) => {
 *   await api.addItem(item);
 * });
 */
export function useOptimisticList<T extends { id: string }>(
    items: T[],
    onAdd: (item: T) => Promise<void>,
    onRemove?: (id: string) => Promise<void>
) {
    const [isPending, startTransition] = useTransition();
    const [optimisticItems, updateOptimisticItems] = useOptimistic(
        items,
        (state: T[], action: { type: 'add' | 'remove'; item?: T; id?: string }) => {
            if (action.type === 'add' && action.item) {
                return [...state, action.item];
            }
            if (action.type === 'remove' && action.id) {
                return state.filter(item => item.id !== action.id);
            }
            return state;
        }
    );

    const addItem = useCallback((item: T) => {
        startTransition(async () => {
            updateOptimisticItems({ type: 'add', item });
            try {
                await onAdd(item);
            } catch (error) {
                console.error('Failed to add item, rolling back', error);
                // The optimistic update will be rolled back automatically
                // when the component re-renders with the original items
            }
        });
    }, [onAdd, updateOptimisticItems]);

    const removeItem = useCallback((id: string) => {
        if (!onRemove) return;
        startTransition(async () => {
            updateOptimisticItems({ type: 'remove', id });
            try {
                await onRemove(id);
            } catch (error) {
                console.error('Failed to remove item, rolling back', error);
            }
        });
    }, [onRemove, updateOptimisticItems]);

    return { optimisticItems, addItem, removeItem, isPending };
}

/**
 * Custom hook for optimistic toggle state (like checkboxes, switches)
 * 
 * @example
 * const [isChecked, toggle, isPending] = useOptimisticToggle(initialValue, async (newValue) => {
 *   await api.updateSetting(newValue);
 * });
 */
export function useOptimisticToggle(
    value: boolean,
    onToggle: (newValue: boolean) => Promise<void>
) {
    const [isPending, startTransition] = useTransition();
    const [optimisticValue, setOptimisticValue] = useOptimistic(value);

    const toggle = useCallback(() => {
        const newValue = !optimisticValue;
        startTransition(async () => {
            setOptimisticValue(newValue);
            try {
                await onToggle(newValue);
            } catch (error) {
                console.error('Toggle failed, rolling back', error);
            }
        });
    }, [optimisticValue, onToggle, setOptimisticValue]);

    const setValue = useCallback((newValue: boolean) => {
        startTransition(async () => {
            setOptimisticValue(newValue);
            try {
                await onToggle(newValue);
            } catch (error) {
                console.error('Set value failed, rolling back', error);
            }
        });
    }, [onToggle, setOptimisticValue]);

    return { value: optimisticValue, toggle, setValue, isPending };
}

/**
 * Custom hook for optimistic form submission with loading state
 * 
 * @example
 * const { submit, isPending } = useOptimisticSubmit(async (data) => {
 *   await api.saveForm(data);
 * });
 */
export function useOptimisticSubmit<T>(
    onSubmit: (data: T) => Promise<void>,
    options?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
    }
) {
    const [isPending, startTransition] = useTransition();

    const submit = useCallback((data: T) => {
        startTransition(async () => {
            try {
                await onSubmit(data);
                options?.onSuccess?.();
            } catch (error) {
                console.error('Submit failed', error);
                options?.onError?.(error as Error);
            }
        });
    }, [onSubmit, options]);

    return { submit, isPending };
}

/**
 * Custom hook for optimistic counter updates (like XP, counts)
 * 
 * @example
 * const { value, increment, decrement, isPending } = useOptimisticCounter(xp, async (newValue) => {
 *   await api.updateXP(newValue);
 * });
 */
export function useOptimisticCounter(
    value: number,
    onUpdate: (newValue: number) => Promise<void>
) {
    const [isPending, startTransition] = useTransition();
    const [optimisticValue, setOptimisticValue] = useOptimistic(value);

    const increment = useCallback((amount: number = 1) => {
        const newValue = optimisticValue + amount;
        startTransition(async () => {
            setOptimisticValue(newValue);
            try {
                await onUpdate(newValue);
            } catch (error) {
                console.error('Increment failed, rolling back', error);
            }
        });
    }, [optimisticValue, onUpdate, setOptimisticValue]);

    const decrement = useCallback((amount: number = 1) => {
        const newValue = optimisticValue - amount;
        startTransition(async () => {
            setOptimisticValue(newValue);
            try {
                await onUpdate(newValue);
            } catch (error) {
                console.error('Decrement failed, rolling back', error);
            }
        });
    }, [optimisticValue, onUpdate, setOptimisticValue]);

    const set = useCallback((newValue: number) => {
        startTransition(async () => {
            setOptimisticValue(newValue);
            try {
                await onUpdate(newValue);
            } catch (error) {
                console.error('Set value failed, rolling back', error);
            }
        });
    }, [onUpdate, setOptimisticValue]);

    return { value: optimisticValue, increment, decrement, set, isPending };
}
