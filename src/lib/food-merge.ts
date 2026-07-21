/**
 * Merge-safe handling of daily_logs.food_items across multiple writers
 * (phone WebView, web, watch via MCP). The failure mode this prevents: a
 * client that loaded the day hours ago saves its stale snapshot and wipes
 * items logged elsewhere in between.
 */

export interface FoodItemLike {
    id?: string;
    name?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    created_at?: string;
    [key: string]: unknown;
}

/** Stable-ish identity: explicit id when present, else name+calories+created_at. */
export function foodFingerprint(item: FoodItemLike): string {
    if (item?.id) return `id:${item.id}`;
    return `fp:${item?.name ?? ''}|${item?.calories ?? ''}|${item?.created_at ?? ''}`;
}

function countByFingerprint(items: FoodItemLike[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const item of items) {
        const fp = foodFingerprint(item);
        map.set(fp, (map.get(fp) ?? 0) + 1);
    }
    return map;
}

/**
 * Three-way merge (multiset semantics):
 * - `base`: what this client loaded from the server originally
 * - `local`: what this client wants to save now (base + its own edits)
 * - `server`: what the server holds at save time
 *
 * Items on the server beyond what `base` contained were added elsewhere since
 * load — they are preserved (returned in `extras` and appended to `merged`).
 * Items the user deleted locally (in base, absent from local) stay deleted.
 */
export function mergeFoodItems(
    base: FoodItemLike[],
    local: FoodItemLike[],
    server: FoodItemLike[],
): { merged: FoodItemLike[]; extras: FoodItemLike[] } {
    const baseCounts = countByFingerprint(base);
    const seen = new Map<string, number>();
    const extras: FoodItemLike[] = [];

    for (const item of server) {
        const fp = foodFingerprint(item);
        const occurrence = (seen.get(fp) ?? 0) + 1;
        seen.set(fp, occurrence);
        if (occurrence > (baseCounts.get(fp) ?? 0)) {
            extras.push(item);
        }
    }

    return { merged: [...local, ...extras], extras };
}

/**
 * Union for offline replays, where the original base snapshot wasn't stored:
 * keep everything currently on the server and add payload items the server
 * doesn't have. (Deletions made offline may be resurrected — an acceptable
 * trade against losing data.)
 */
export function unionFoodItems(server: FoodItemLike[], payload: FoodItemLike[]): FoodItemLike[] {
    const serverCounts = countByFingerprint(server);
    const seen = new Map<string, number>();
    const additions: FoodItemLike[] = [];

    for (const item of payload) {
        const fp = foodFingerprint(item);
        const occurrence = (seen.get(fp) ?? 0) + 1;
        seen.set(fp, occurrence);
        if (occurrence > (serverCounts.get(fp) ?? 0)) {
            additions.push(item);
        }
    }

    return [...server, ...additions];
}

/** Portion multiplier: items store base macros and an optional quantity ("1", ".3", 2). */
export function itemQuantity(item: FoodItemLike): number {
    const raw = (item as { quantity?: unknown }).quantity;
    if (raw === undefined || raw === null || raw === '') return 1;
    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function foodTotals(items: FoodItemLike[]): { calories: number; protein: number; carbs: number; fat: number } {
    const totals = items.reduce<{ calories: number; protein: number; carbs: number; fat: number }>(
        (acc, item) => {
            const q = itemQuantity(item);
            return {
                calories: acc.calories + (item.calories || 0) * q,
                protein: acc.protein + (item.protein || 0) * q,
                carbs: acc.carbs + (item.carbs || 0) * q,
                fat: acc.fat + (item.fat || 0) * q,
            };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
    };
}
