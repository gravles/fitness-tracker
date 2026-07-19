import { describe, it, expect } from 'vitest';
import { mergeFoodItems, unionFoodItems, foodFingerprint } from '../food-merge';

const coffee = { name: 'coffee', calories: 5 };
const bun = { name: 'bun', calories: 190 };
const wrap = { name: 'chicken wrap', calories: 600 };
const shake = { name: 'protein shake', calories: 220 };

describe('mergeFoodItems (three-way)', () => {
    it('preserves items added elsewhere since this client loaded', () => {
        // Client loaded [coffee], watch added wrap+shake meanwhile, client logs bun
        const { merged, extras } = mergeFoodItems(
            [coffee],
            [coffee, bun],
            [coffee, wrap, shake],
        );
        expect(extras).toEqual([wrap, shake]);
        expect(merged).toEqual([coffee, bun, wrap, shake]);
    });

    it('reproduces the stale-snapshot wipe scenario and prevents it', () => {
        // The bug that ate today's log: morning snapshot [coffee], server had
        // grown to [coffee, wrap, shake], client saved [coffee, bun] verbatim.
        const { merged } = mergeFoodItems([coffee], [coffee, bun], [coffee, wrap, shake]);
        expect(merged).toHaveLength(4); // nothing lost
    });

    it('respects local deletions', () => {
        // Client loaded [coffee, bun], deleted bun; server unchanged
        const { merged, extras } = mergeFoodItems(
            [coffee, bun],
            [coffee],
            [coffee, bun],
        );
        expect(extras).toEqual([]);
        expect(merged).toEqual([coffee]);
    });

    it('handles duplicate items as a multiset', () => {
        // Two shakes on the server, base knew of one → one was added elsewhere
        const { extras } = mergeFoodItems(
            [shake],
            [shake],
            [shake, shake],
        );
        expect(extras).toEqual([shake]);
    });

    it('uses explicit ids when present', () => {
        const a = { id: 'x1', name: 'meal', calories: 100 };
        const b = { id: 'x2', name: 'meal', calories: 100 };
        expect(foodFingerprint(a)).not.toBe(foodFingerprint(b));
        const { extras } = mergeFoodItems([a], [a], [a, b]);
        expect(extras).toEqual([b]);
    });
});

describe('unionFoodItems (offline replay)', () => {
    it('keeps server items and adds only missing payload items', () => {
        const merged = unionFoodItems([coffee, wrap], [coffee, bun]);
        expect(merged).toEqual([coffee, wrap, bun]);
    });

    it('never drops newer server items even for a stale full-day payload', () => {
        const merged = unionFoodItems([coffee, wrap, shake], [coffee]);
        expect(merged).toEqual([coffee, wrap, shake]);
    });
});
