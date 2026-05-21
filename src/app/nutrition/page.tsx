'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import {
    Plus, Trash2, Loader2, Sparkles, ChevronLeft, ChevronRight,
    Clock, CheckCircle2, RefreshCw, Settings2, UtensilsCrossed,
    Camera, Mic, MicOff, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
    getPantryItems, addPantryItem, deletePantryItem,
    getMealPlan, saveMealPlan,
    getNutritionPrefs, saveNutritionPrefs,
    getSettings, getDailyLog, upsertDailyLog,
    PantryItem, PlannedMeal, NutritionPrefs, DEFAULT_NUTRITION_PREFS,
} from '@/lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Protein', 'Carbs', 'Vegetables', 'Dairy', 'Fats', 'Other'] as const;
const PREP_TIMES = [
    { value: 'no-prep', label: 'No prep', desc: 'Ready to eat' },
    { value: 'quick', label: 'Quick', desc: '5–15 min' },
    { value: 'standard', label: 'Standard', desc: '15–30 min' },
    { value: 'extended', label: 'Extended', desc: '30+ min' },
] as const;
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABELS: Record<string, string> = {
    breakfast: '🌅 Breakfast',
    lunch: '☀️ Lunch',
    dinner: '🌙 Dinner',
    snack: '🍎 Snack',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanItem = {
    name: string;
    category: PantryItem['category'];
    prep_time: PantryItem['prep_time'];
    notes: string;
    selected: boolean;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function getMondayOfWeek(d: Date): Date {
    return startOfWeek(d, { weekStartsOn: 1 });
}

function mealKey(date: string, mealType: string) {
    return `${date}_${mealType}`;
}

function macroColor(pct: number) {
    if (pct >= 90) return 'var(--color-success)';
    if (pct >= 60) return 'var(--color-gold)';
    return '#ef4444';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroPill({ label, value, target }: { label: string; value: number; target: number }) {
    const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    return (
        <div className="flex-1 text-center">
            <div className="text-xs font-bold" style={{ color: macroColor(pct) }}>{value}g</div>
            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
        </div>
    );
}

function MealCard({
    mealType, meal, onLog, onRegenerate, isLogging, isRegenerating,
}: {
    mealType: string;
    meal: PlannedMeal | null;
    onLog: () => void;
    onRegenerate: () => void;
    isLogging: boolean;
    isRegenerating: boolean;
}) {
    if (!meal) {
        return (
            <div
                className="p-3 rounded-xl border border-dashed flex items-center justify-between"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-subtle)' }}
            >
                <span className="text-sm text-[var(--color-text-muted)]">{MEAL_LABELS[mealType]}</span>
                <button onClick={onRegenerate} disabled={isRegenerating} className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                    {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Generate'}
                </button>
            </div>
        );
    }

    return (
        <div
            className="p-3 rounded-xl border space-y-2"
            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        {MEAL_LABELS[mealType]}
                    </p>
                    <p className="font-bold text-sm text-[var(--color-text)] mt-0.5">{meal.name}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <button
                        onClick={onRegenerate}
                        disabled={isRegenerating}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle)' }}
                        title="Regenerate this meal"
                    >
                        {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={onLog}
                        disabled={isLogging}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                    >
                        {isLogging ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" /> Log</>}
                    </button>
                </div>
            </div>

            {/* Ingredients */}
            <p className="text-xs text-[var(--color-text-muted)]">{meal.ingredients.slice(0, 3).join(' · ')}{meal.ingredients.length > 3 ? ` +${meal.ingredients.length - 3} more` : ''}</p>

            {/* Prep time + macros */}
            <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    <Clock className="w-3 h-3" />
                    {meal.prep_time_min} min
                </div>
                <div className="flex gap-3 text-[10px]">
                    <span style={{ color: 'var(--color-primary)' }}><b>{meal.macros.protein}g</b> P</span>
                    <span style={{ color: 'var(--color-text-muted)' }}><b>{meal.macros.carbs}g</b> C</span>
                    <span style={{ color: 'var(--color-text-muted)' }}><b>{meal.macros.fat}g</b> F</span>
                    <span style={{ color: 'var(--color-gold)' }}><b>{meal.macros.calories}</b> cal</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NutritionPage() {
    const today = new Date();
    const [tab, setTab] = useState<'today' | 'plan' | 'pantry'>('today');

    // Data
    const [pantry, setPantry] = useState<PantryItem[]>([]);
    const [meals, setMeals] = useState<Record<string, PlannedMeal | null>>({});
    const [prefs, setPrefs] = useState<NutritionPrefs>(DEFAULT_NUTRITION_PREFS);
    const [settings, setSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Week navigation (Plan tab)
    const [weekStart, setWeekStart] = useState(getMondayOfWeek(today));
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // Generation state
    const [generating, setGenerating] = useState<string | null>(null); // 'week' | dateStr
    const [loggingMeal, setLoggingMeal] = useState<string | null>(null); // mealKey

    // Pantry form
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItem, setNewItem] = useState<Partial<PantryItem>>({ category: 'Protein', prep_time: 'quick' });
    const [addingItem, setAddingItem] = useState(false);

    // Prefs form
    const [showPrefs, setShowPrefs] = useState(false);
    const [editPrefs, setEditPrefs] = useState<NutritionPrefs>(DEFAULT_NUTRITION_PREFS);
    const [savingPrefs, setSavingPrefs] = useState(false);

    // Smart pantry scanning
    const [scanning, setScanning] = useState(false);
    const [recording, setRecording] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [reviewItems, setReviewItems] = useState<ScanItem[]>([]);
    const [showReview, setShowReview] = useState(false);
    const [bulkAdding, setBulkAdding] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        loadAll();
    }, []);

    useEffect(() => {
        loadMealPlan();
    }, [weekStart]);

    async function loadAll() {
        setIsLoading(true);
        try {
            const [p, pr, s] = await Promise.all([
                getPantryItems(),
                getNutritionPrefs(),
                getSettings(),
            ]);
            setPantry(p);
            setPrefs(pr);
            setEditPrefs(pr);
            setSettings(s);
        } finally {
            setIsLoading(false);
        }
    }

    async function loadMealPlan() {
        const weekStr = format(weekStart, 'yyyy-MM-dd');
        const plan = await getMealPlan(weekStr);
        setMeals(plan?.meals ?? {});
    }

    // ── Meal generation ────────────────────────────────────────────────────────

    async function getAuthHeader(): Promise<Record<string, string>> {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    }

    async function generateMeals(dates: string[]) {
        if (pantry.length === 0) {
            toast.error('Add some pantry items first so I know what to cook with!');
            setTab('pantry');
            return;
        }

        const key = dates.length === 1 ? dates[0] : 'week';
        setGenerating(key);
        try {
            const authHeaders = await getAuthHeader();
            const res = await fetch('/api/nutrition/meal-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    dates,
                    prefs,
                    targetProtein: settings?.target_protein || 150,
                    targetCalories: settings?.target_calories || 2500,
                    pantryItems: pantry,
                }),
            });

            if (!res.ok) throw new Error(await res.text());
            const { meals: newMeals } = await res.json();

            const merged = { ...meals };
            for (const [date, dayMeals] of Object.entries(newMeals as Record<string, any>)) {
                for (const mealType of MEAL_TYPES) {
                    const k = mealKey(date, mealType);
                    merged[k] = dayMeals[mealType] ?? null;
                }
            }

            setMeals(merged);
            await saveMealPlan(format(weekStart, 'yyyy-MM-dd'), merged);
            toast.success(dates.length === 1 ? 'Meal updated!' : `${dates.length}-day plan ready!`);
        } catch (e) {
            console.error(e);
            toast.error('Failed to generate meals — check your pantry has enough items');
        } finally {
            setGenerating(null);
        }
    }

    async function regenerateSingleMeal(date: string, mealType: string) {
        const k = mealKey(date, mealType);
        setGenerating(k);
        try {
            const authHeaders = await getAuthHeader();
            const res = await fetch('/api/nutrition/meal-plan/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    dates: [date],
                    prefs,
                    targetProtein: settings?.target_protein || 150,
                    targetCalories: settings?.target_calories || 2500,
                    pantryItems: pantry,
                }),
            });

            if (!res.ok) throw new Error();
            const { meals: newMeals } = await res.json();
            const newMeal = newMeals[date]?.[mealType] ?? null;

            const merged = { ...meals, [k]: newMeal };
            setMeals(merged);
            await saveMealPlan(format(weekStart, 'yyyy-MM-dd'), merged);
        } catch {
            toast.error('Failed to regenerate — try again');
        } finally {
            setGenerating(null);
        }
    }

    // ── Log a meal to daily log ────────────────────────────────────────────────

    async function logMeal(date: string, mealType: string) {
        const k = mealKey(date, mealType);
        const meal = meals[k];
        if (!meal) return;

        setLoggingMeal(k);
        try {
            const existing = (await getDailyLog(date)) ?? {} as import('@/lib/api').DailyLog;
            const existingItems: any[] = existing.food_items ?? [];
            const newItem = {
                name: meal.name,
                calories: meal.macros.calories,
                protein: meal.macros.protein,
                carbs: meal.macros.carbs,
                fat: meal.macros.fat,
            };
            const updated = [...existingItems, newItem];
            const totals = updated.reduce(
                (acc, item) => ({
                    calories: acc.calories + (item.calories || 0),
                    protein: acc.protein + (item.protein || 0),
                    carbs: acc.carbs + (item.carbs || 0),
                    fat: acc.fat + (item.fat || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );

            await upsertDailyLog({
                date,
                food_items: updated,
                calories: totals.calories,
                protein_grams: totals.protein,
                carbs_grams: totals.carbs,
                fat_grams: totals.fat,
                nutrition_logged: true,
            });
            toast.success(`${meal.name} logged!`);
        } catch {
            toast.error('Failed to log meal');
        } finally {
            setLoggingMeal(null);
        }
    }

    // ── Pantry management ──────────────────────────────────────────────────────

    async function handleAddItem() {
        if (!newItem.name?.trim()) return;
        setAddingItem(true);
        try {
            const added = await addPantryItem({
                name: newItem.name.trim(),
                category: (newItem.category as PantryItem['category']) || 'Other',
                prep_time: (newItem.prep_time as PantryItem['prep_time']) || 'quick',
                notes: newItem.notes || null,
                calories_per_100g: null,
                protein_per_100g: null,
                carbs_per_100g: null,
                fat_per_100g: null,
            });
            setPantry(prev => [...prev, added].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
            setNewItem({ category: 'Protein', prep_time: 'quick' });
            setShowAddItem(false);
            toast.success(`${added.name} added to pantry`);
        } catch {
            toast.error('Failed to add item');
        } finally {
            setAddingItem(false);
        }
    }

    async function handleDeleteItem(id: string) {
        await deletePantryItem(id);
        setPantry(prev => prev.filter(i => i.id !== id));
    }

    // ── Prefs save ─────────────────────────────────────────────────────────────

    async function handleSavePrefs() {
        setSavingPrefs(true);
        try {
            await saveNutritionPrefs(editPrefs);
            setPrefs(editPrefs);
            setShowPrefs(false);
            toast.success('Preferences saved');
        } finally {
            setSavingPrefs(false);
        }
    }

    // ── Smart pantry scan ──────────────────────────────────────────────────────

    async function processScan(imageBase64?: string, imageMimeType?: string, transcript?: string) {
        setScanning(true);
        try {
            const authHeaders = await getAuthHeader();
            const body = imageBase64
                ? { image: imageBase64, mimeType: imageMimeType || 'image/jpeg' }
                : { transcript };
            const res = await fetch('/api/nutrition/pantry/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            const { items } = await res.json();
            if (!items?.length) { toast.error('No food items detected — try again'); return; }
            setReviewItems(items.map((item: any) => ({ ...item, notes: item.notes || '', selected: true })));
            setShowReview(true);
        } catch (e) {
            console.error(e);
            toast.error('Scan failed — try again');
        } finally {
            setScanning(false);
        }
    }

    function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            processScan(base64, file.type);
        };
        reader.readAsDataURL(file);
    }

    function handleVoiceToggle() {
        if (recording) {
            recognitionRef.current?.stop();
            setRecording(false);
            const transcript = voiceTranscript;
            setVoiceTranscript('');
            if (transcript.trim()) processScan(undefined, undefined, transcript);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                toast.error('Voice input not supported in this browser. Try Chrome or Safari.');
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';
            recognition.onresult = (event: any) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
                    else interim += event.results[i][0].transcript;
                }
                setVoiceTranscript(finalTranscript + interim);
            };
            recognition.onerror = () => {
                setRecording(false);
                toast.error('Voice error — check microphone permission');
            };
            recognition.onend = () => setRecording(false);

            recognitionRef.current = recognition;
            finalTranscript = '';
            recognition.start();
            setRecording(true);
            setVoiceTranscript('');
        }
    }

    async function handleBulkAdd() {
        const toAdd = reviewItems.filter(i => i.selected && i.name.trim());
        if (!toAdd.length) return;
        setBulkAdding(true);
        try {
            for (const item of toAdd) {
                await addPantryItem({
                    name: item.name.trim(),
                    category: item.category,
                    prep_time: item.prep_time,
                    notes: item.notes || null,
                    calories_per_100g: null,
                    protein_per_100g: null,
                    carbs_per_100g: null,
                    fat_per_100g: null,
                });
            }
            const updated = await getPantryItems();
            setPantry(updated);
            setShowReview(false);
            toast.success(`Added ${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} to pantry!`);
        } catch {
            toast.error('Failed to add some items');
        } finally {
            setBulkAdding(false);
        }
    }

    // ─── Today tab ─────────────────────────────────────────────────────────────

    const todayStr = format(today, 'yyyy-MM-dd');
    const todayMeals = MEAL_TYPES.map(t => ({ type: t, meal: meals[mealKey(todayStr, t)] ?? null }));
    const todayTotals = todayMeals.reduce(
        (acc, { meal }) => ({
            calories: acc.calories + (meal?.macros.calories || 0),
            protein: acc.protein + (meal?.macros.protein || 0),
            carbs: acc.carbs + (meal?.macros.carbs || 0),
            fat: acc.fat + (meal?.macros.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const hasTodayPlan = todayMeals.some(m => m.meal !== null);

    // ─── Grouped pantry ────────────────────────────────────────────────────────

    const pantryByCategory = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = pantry.filter(i => i.category === cat);
        return acc;
    }, {} as Record<string, PantryItem[]>);

    const PREP_BADGE: Record<string, { label: string; color: string }> = {
        'no-prep': { label: 'No prep', color: 'var(--color-success)' },
        'quick': { label: 'Quick', color: 'var(--color-primary)' },
        'standard': { label: 'Standard', color: 'var(--color-gold)' },
        'extended': { label: 'Extended', color: '#9b72cf' },
    };

    if (isLoading) {
        return (
            <main className="p-6 pt-12 pb-24 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
            </main>
        );
    }

    return (
        <main className="p-6 pt-12 pb-24 space-y-5 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                        Meal Planner
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)]">Built around your pantry</p>
                </div>
                <button
                    onClick={() => { setShowPrefs(true); setEditPrefs(prefs); }}
                    className="p-2.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)]"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <Settings2 className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                {(['today', 'plan', 'pantry'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                        style={tab === t
                            ? { background: 'var(--color-surface-elevated)', color: 'var(--color-text)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                            : { color: 'var(--color-text-muted)' }
                        }
                    >
                        {t === 'today' ? "Today's Plan" : t === 'plan' ? 'This Week' : `Pantry (${pantry.length})`}
                    </button>
                ))}
            </div>

            {/* ── TODAY TAB ─────────────────────────────────────────────────────── */}
            {tab === 'today' && (
                <div className="space-y-4">
                    {/* Macro summary */}
                    {hasTodayPlan && (
                        <div className="p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Planned today</span>
                                <span className="text-sm font-bold" style={{ color: 'var(--color-gold)' }}>{todayTotals.calories} cal</span>
                            </div>
                            <div className="flex gap-2">
                                <MacroPill label="Protein" value={todayTotals.protein} target={settings?.target_protein || 150} />
                                <MacroPill label="Carbs" value={todayTotals.carbs} target={Math.round((settings?.target_calories || 2500) * 0.45 / 4)} />
                                <MacroPill label="Fat" value={todayTotals.fat} target={Math.round((settings?.target_calories || 2500) * 0.30 / 9)} />
                            </div>
                        </div>
                    )}

                    {/* Generate today button */}
                    {!hasTodayPlan && (
                        <button
                            onClick={() => generateMeals([todayStr])}
                            disabled={!!generating}
                            className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid rgba(201,168,76,0.2)' }}
                        >
                            {generating === todayStr
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Planning your meals…</>
                                : <><Sparkles className="w-5 h-5" /> Plan Today's Meals</>
                            }
                        </button>
                    )}

                    {/* Meal cards */}
                    <div className="space-y-2">
                        {todayMeals.map(({ type, meal }) => (
                            <MealCard
                                key={type}
                                mealType={type}
                                meal={meal}
                                onLog={() => logMeal(todayStr, type)}
                                onRegenerate={() => regenerateSingleMeal(todayStr, type)}
                                isLogging={loggingMeal === mealKey(todayStr, type)}
                                isRegenerating={generating === mealKey(todayStr, type)}
                            />
                        ))}
                    </div>

                    {hasTodayPlan && (
                        <button
                            onClick={() => generateMeals([todayStr])}
                            disabled={!!generating}
                            className="w-full py-3 rounded-2xl text-sm font-semibold border transition-all"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                            {generating === todayStr ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Regenerate all meals'}
                        </button>
                    )}
                </div>
            )}

            {/* ── PLAN TAB ──────────────────────────────────────────────────────── */}
            {tab === 'plan' && (
                <div className="space-y-4">
                    {/* Week nav + generate */}
                    <div className="flex items-center justify-between">
                        <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-2 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                            <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </button>
                        <span className="text-sm font-bold text-[var(--color-text)]">
                            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-2 rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
                            <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </button>
                    </div>

                    <button
                        onClick={() => generateMeals(weekDays.map(d => format(d, 'yyyy-MM-dd')))}
                        disabled={!!generating}
                        className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                        style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid rgba(201,168,76,0.2)' }}
                    >
                        {generating === 'week'
                            ? <><Loader2 className="w-5 h-5 animate-spin" /> Building week plan…</>
                            : <><Sparkles className="w-5 h-5" /> Generate Full Week</>
                        }
                    </button>

                    {/* Day-by-day list */}
                    {weekDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isToday = isSameDay(day, today);
                        const dayMeals = MEAL_TYPES.map(t => ({ type: t, meal: meals[mealKey(dateStr, t)] ?? null }));
                        const hasMeals = dayMeals.some(m => m.meal);

                        return (
                            <div key={dateStr} className="rounded-2xl border overflow-hidden" style={{ borderColor: isToday ? 'var(--color-primary)' : 'var(--color-border-light)' }}>
                                {/* Day header */}
                                <div
                                    className="px-4 py-2.5 flex items-center justify-between"
                                    style={{ background: isToday ? 'rgba(29,95,168,0.08)' : 'var(--color-bg-subtle)' }}
                                >
                                    <div>
                                        <span className="font-bold text-sm text-[var(--color-text)]">{format(day, 'EEEE')}</span>
                                        <span className="text-xs text-[var(--color-text-muted)] ml-2">{format(day, 'MMM d')}</span>
                                        {isToday && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-primary)', color: 'white' }}>Today</span>}
                                    </div>
                                    <button
                                        onClick={() => generateMeals([dateStr])}
                                        disabled={!!generating}
                                        className="text-xs font-semibold flex items-center gap-1"
                                        style={{ color: hasMeals ? 'var(--color-text-muted)' : 'var(--color-primary)' }}
                                    >
                                        {generating === dateStr
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : hasMeals ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />
                                        }
                                        {hasMeals ? 'Redo' : 'Plan day'}
                                    </button>
                                </div>

                                {/* Meals */}
                                {hasMeals && (
                                    <div className="p-3 space-y-2 bg-[var(--color-surface-elevated)]">
                                        {dayMeals.filter(m => m.meal).map(({ type, meal }) => (
                                            <MealCard
                                                key={type}
                                                mealType={type}
                                                meal={meal}
                                                onLog={() => logMeal(dateStr, type)}
                                                onRegenerate={() => regenerateSingleMeal(dateStr, type)}
                                                isLogging={loggingMeal === mealKey(dateStr, type)}
                                                isRegenerating={generating === mealKey(dateStr, type)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── PANTRY TAB ────────────────────────────────────────────────────── */}
            {tab === 'pantry' && (
                <div className="space-y-5">
                    {pantry.length === 0 && !showAddItem && (
                        <div className="text-center py-8 space-y-2">
                            <div className="text-5xl">🛒</div>
                            <p className="font-bold text-[var(--color-text)]">Your pantry is empty</p>
                            <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto">Scan a photo or read out what's in your fridge — AI will categorise everything for you.</p>
                        </div>
                    )}

                    {/* Hidden file input for camera */}
                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoScan}
                    />

                    {/* Smart add buttons */}
                    {!showAddItem && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={scanning || recording}
                                    className="py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid rgba(201,168,76,0.2)' }}
                                >
                                    {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                    {scanning ? 'Scanning…' : 'Scan Photo'}
                                </button>
                                <button
                                    onClick={handleVoiceToggle}
                                    disabled={scanning}
                                    className="py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                    style={recording
                                        ? { background: '#ef4444', color: 'white' }
                                        : { background: 'var(--color-surface-elevated)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                                    }
                                >
                                    {recording ? <><MicOff className="w-5 h-5" /> Done</> : <><Mic className="w-5 h-5" /> Voice</>}
                                </button>
                            </div>

                            {/* Live transcript preview */}
                            {recording && (
                                <div className="px-4 py-3 rounded-xl flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 animate-pulse flex-shrink-0" />
                                    <p className="text-sm text-[var(--color-text)] italic min-h-[20px]">
                                        {voiceTranscript || 'Listening… say your food items'}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => setShowAddItem(true)}
                                className="w-full py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 border border-dashed transition-all"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                            >
                                <Plus className="w-3.5 h-3.5" /> Add manually
                            </button>
                        </div>
                    )}

                    {/* Add item form (manual) */}
                    {showAddItem && (
                        <div className="p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)] space-y-3">
                            <p className="font-bold text-[var(--color-text)]">Add Item</p>

                            <input
                                type="text"
                                placeholder="e.g. Chicken Breast, Greek Yogurt, Rice…"
                                value={newItem.name || ''}
                                onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                                className="w-full p-3 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                autoFocus
                            />

                            {/* Category */}
                            <div>
                                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">Category</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setNewItem(p => ({ ...p, category: cat }))}
                                            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                                            style={newItem.category === cat
                                                ? { background: 'var(--color-primary)', color: 'white' }
                                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                                            }
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Prep time */}
                            <div>
                                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">How long to prepare?</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PREP_TIMES.map(pt => (
                                        <button
                                            key={pt.value}
                                            onClick={() => setNewItem(p => ({ ...p, prep_time: pt.value }))}
                                            className="py-2 px-3 rounded-xl text-left transition-all border"
                                            style={newItem.prep_time === pt.value
                                                ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'white' }
                                                : { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                                            }
                                        >
                                            <p className="text-xs font-bold">{pt.label}</p>
                                            <p className="text-[10px]">{pt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <input
                                type="text"
                                placeholder="Notes (optional, e.g. 'I buy the pre-cooked kind')"
                                value={newItem.notes || ''}
                                onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))}
                                className="w-full p-3 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowAddItem(false); setNewItem({ category: 'Protein', prep_time: 'quick' }); }}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    disabled={addingItem || !newItem.name?.trim()}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                >
                                    {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Pantry'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Grouped pantry list */}
                    {CATEGORIES.filter(cat => pantryByCategory[cat]?.length > 0).map(cat => (
                        <div key={cat}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>{cat}</p>
                            <div className="space-y-1.5">
                                {pantryByCategory[cat].map(item => {
                                    const badge = PREP_BADGE[item.prep_time];
                                    return (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)]"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-[var(--color-text)] truncate">{item.name}</p>
                                                {item.notes && <p className="text-xs text-[var(--color-text-muted)] truncate">{item.notes}</p>}
                                            </div>
                                            <span
                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                                style={{ background: `${badge?.color}18`, color: badge?.color }}
                                            >
                                                {badge?.label}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="p-1.5 rounded-lg flex-shrink-0"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── REVIEW MODAL (scan results) ───────────────────────────────────── */}
            {showReview && (
                <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-bg)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div>
                            <h2 className="font-bold text-lg text-[var(--color-text)]">Review Items</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {reviewItems.filter(i => i.selected).length} of {reviewItems.length} selected
                                {' · '}
                                <button
                                    onClick={() => setReviewItems(items => items.map(i => ({ ...i, selected: true })))}
                                    className="font-semibold"
                                    style={{ color: 'var(--color-primary)' }}
                                >
                                    Select all
                                </button>
                            </p>
                        </div>
                        <button
                            onClick={() => setShowReview(false)}
                            className="p-2 rounded-xl"
                            style={{ background: 'var(--color-bg-subtle)' }}
                        >
                            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </button>
                    </div>

                    {/* Items list */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                        {reviewItems.map((item, idx) => (
                            <div
                                key={idx}
                                className="p-3 rounded-2xl border transition-all"
                                style={{
                                    background: item.selected ? 'var(--color-surface-elevated)' : 'var(--color-bg-subtle)',
                                    borderColor: item.selected ? 'var(--color-primary)' : 'var(--color-border-light)',
                                    opacity: item.selected ? 1 : 0.45,
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => setReviewItems(its => its.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it))}
                                        className="mt-0.5 flex-shrink-0"
                                    >
                                        {item.selected
                                            ? <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                            : <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--color-border)' }} />
                                        }
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        {/* Editable name */}
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={e => setReviewItems(its => its.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                                            className="w-full font-semibold text-sm bg-transparent outline-none text-[var(--color-text)] border-b border-transparent focus:border-[var(--color-border)]"
                                        />

                                        {/* Category chips */}
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {CATEGORIES.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setReviewItems(its => its.map((it, i) => i === idx ? { ...it, category: cat } : it))}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-all"
                                                    style={item.category === cat
                                                        ? { background: 'var(--color-primary)', color: 'white' }
                                                        : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }
                                                    }
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Prep time pills */}
                                        <div className="flex gap-1 mt-1">
                                            {PREP_TIMES.map(pt => (
                                                <button
                                                    key={pt.value}
                                                    onClick={() => setReviewItems(its => its.map((it, i) => i === idx ? { ...it, prep_time: pt.value } : it))}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-all"
                                                    style={item.prep_time === pt.value
                                                        ? { background: 'var(--color-gold)', color: 'white' }
                                                        : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }
                                                    }
                                                >
                                                    {pt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                        <button
                            onClick={handleBulkAdd}
                            disabled={bulkAdding || reviewItems.filter(i => i.selected).length === 0}
                            className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid rgba(201,168,76,0.2)' }}
                        >
                            {bulkAdding
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Adding…</>
                                : <><Plus className="w-5 h-5" /> Add {reviewItems.filter(i => i.selected).length} Items to Pantry</>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* ── PREFS BOTTOM SHEET ─────────────────────────────────────────────── */}
            {showPrefs && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                    onClick={() => setShowPrefs(false)}
                >
                    <div
                        className="w-full max-w-2xl rounded-t-3xl p-6 space-y-5 pb-safe"
                        style={{ background: 'var(--color-surface-elevated)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg text-[var(--color-text)]">Meal Planning Preferences</h3>
                            <button onClick={() => setShowPrefs(false)} className="text-[var(--color-text-muted)]">✕</button>
                        </div>

                        <p className="text-sm text-[var(--color-text-muted)]">Set how much time you have to prep each meal. The AI will only suggest meals that fit.</p>

                        {[
                            { key: 'breakfast_prep_min' as keyof NutritionPrefs, label: '🌅 Breakfast prep time', options: [5, 10, 15, 20] },
                            { key: 'lunch_prep_min' as keyof NutritionPrefs, label: '☀️ Lunch prep time', options: [5, 10, 15, 30] },
                            { key: 'dinner_prep_min' as keyof NutritionPrefs, label: '🌙 Dinner prep time', options: [15, 30, 45, 60] },
                        ].map(({ key, label, options }) => (
                            <div key={key}>
                                <p className="text-sm font-semibold text-[var(--color-text)] mb-2">{label}</p>
                                <div className="flex gap-2">
                                    {options.map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => setEditPrefs(p => ({ ...p, [key]: mins }))}
                                            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                                            style={editPrefs[key] === mins
                                                ? { background: 'var(--color-primary)', color: 'white' }
                                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                                            }
                                        >
                                            {mins}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div>
                            <p className="text-sm font-semibold text-[var(--color-text)] mb-2">Dietary notes</p>
                            <textarea
                                value={editPrefs.dietary_notes}
                                onChange={e => setEditPrefs(p => ({ ...p, dietary_notes: e.target.value }))}
                                placeholder="e.g. no red meat, low dairy, high fibre, I meal prep on Sundays…"
                                rows={2}
                                className="w-full p-3 rounded-xl text-sm outline-none resize-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />
                        </div>

                        <button
                            onClick={handleSavePrefs}
                            disabled={savingPrefs}
                            className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
                        >
                            {savingPrefs ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
