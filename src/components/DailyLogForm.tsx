'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDailyLog, upsertDailyLog, getWorkouts, Workout, getFavoriteFoods, FavoriteFood, addWorkout, getSettings, getStreak, getUserBadges, getMonthlyLogs, awardBadge, getLifetimeLogCount } from '@/lib/api';
import { getNewlyEarnedBadges } from '@/lib/gamification';
import { format, subDays } from 'date-fns';
import { Loader2, Utensils, Activity, Heart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MenuScanner } from './MenuScanner';
import { WorkoutChatModal } from './WorkoutChatModal';
import { FoodSelector } from './FoodSelector';
import { MovementSection } from './daily-log/MovementSection';
import { NutritionSection } from './daily-log/NutritionSection';
import { AlcoholSection } from './daily-log/AlcoholSection';
import { SubjectiveSection } from './daily-log/SubjectiveSection';
import { HabitsSection } from './daily-log/HabitsSection';
import { TextLogModal } from './TextLogModal';
import { haptics } from '@/lib/haptics';

type LogTab = 'nutrition' | 'activity' | 'wellness';

interface DailyLogFormProps {
    date: Date;
}

export function DailyLogForm({ date }: DailyLogFormProps) {
    const searchParams = useSearchParams();

    // Tab state
    const [activeTab, setActiveTab] = useState<LogTab>('nutrition');

    const [loading, setLoading] = useState(true);
    const [foodItems, setFoodItems] = useState<any[]>([]);
    const [showMenuScanner, setShowMenuScanner] = useState(false);
    const [showWorkoutChat, setShowWorkoutChat] = useState(false);
    const [chatInitialInput, setChatInitialInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);
    const [showFoodSelector, setShowFoodSelector] = useState(false);

    // State Variables
    const [settings, setSettings] = useState({ cycle: true, habits: [] as string[] });
    const [targetsState, setTargetsState] = useState({ protein: 0, calories: 0 });
    const [movementCompleted, setMovementCompleted] = useState<boolean | null>(null);
    const [nutrition, setNutrition] = useState({
        protein: 0, carbs: 0, fat: 0, calories: 0,
        windowStart: '', windowEnd: '', logged: false
    });
    const [alcohol, setAlcohol] = useState(0);
    const [subjective, setSubjective] = useState({
        sleep: 3, energy: 3, motivation: 3, stress: 3, note: ''
    });
    const [habits, setHabits] = useState<string[]>([]);
    const [menstrualFlow, setMenstrualFlow] = useState<string | null>(null);
    const [initialXP, setInitialXP] = useState(0);

    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
    const [addingWorkout, setAddingWorkout] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [autoStartVoice, setAutoStartVoice] = useState(false);

    // Autosave & Concurrency Refs
    const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);
    const isFirstLoad = useRef(true);
    const isSavingRef = useRef(false);
    const pendingSaveRef = useRef(false);

    const totalDuration = workouts.reduce((acc, w) => acc + w.duration, 0);

    // Quick Actions Handling
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'camera') {
            setShowCamera(true);
        } else if (action === 'voice') {
            setAutoStartVoice(true);
        } else if (action === 'scan') {
            setShowMenuScanner(true);
        }
    }, [searchParams]);

    // Autosave Logic
    const stateRef = useRef<any>(null);
    useEffect(() => {
        stateRef.current = {
            date, movementCompleted, totalDuration, workouts, nutrition, alcohol, subjective, habits, menstrualFlow, foodItems
        };
    });

    useEffect(() => {
        if (loading || isFirstLoad.current) return;

        if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);

        autosaveTimeout.current = setTimeout(() => {
            triggerSave();
            autosaveTimeout.current = null;
        }, 1000);

        return () => {
            if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
        };
    }, [
        movementCompleted, workouts, nutrition, alcohol, subjective, habits, menstrualFlow, foodItems, foodItems.length
    ]);

    // Unmount Flush
    useEffect(() => {
        return () => {
            if (autosaveTimeout.current && stateRef.current && !isFirstLoad.current) {
                const s = stateRef.current;
                const offsetDate = new Date(s.date.getTime() - (s.date.getTimezoneOffset() * 60000));
                const dateStr = offsetDate.toISOString().split('T')[0];

                upsertDailyLog({
                    date: dateStr,
                    movement_completed: s.movementCompleted ?? undefined,
                    movement_duration: s.totalDuration,
                    movement_intensity: s.workouts.length > 0 ? s.workouts[0].intensity : undefined,
                    calories: s.nutrition.calories,
                    protein_grams: s.nutrition.protein,
                    carbs_grams: s.nutrition.carbs,
                    fat_grams: s.nutrition.fat,
                    eating_window_start: s.nutrition.windowStart || null,
                    eating_window_end: s.nutrition.windowEnd || null,
                    nutrition_logged: s.nutrition.logged,
                    food_items: s.foodItems,
                    alcohol_drinks: s.alcohol,
                    sleep_quality: s.subjective.sleep,
                    energy_level: s.subjective.energy,
                    motivation_level: s.subjective.motivation,
                    stress_level: s.subjective.stress,
                    daily_note: s.subjective.note,
                    habits: s.habits,
                    menstrual_flow: s.menstrualFlow,
                }).catch(console.error);
            }
        };
    }, []);

    // Sequential Save Handler
    async function triggerSave(manual = false) {
        if (isSavingRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        isSavingRef.current = true;
        await performSave(manual);
        isSavingRef.current = false;

        if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            triggerSave();
        }
    }

    async function fetchLog() {
        setLoading(true);
        isFirstLoad.current = true;
        try {
            const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const [log, workoutData, favData, userSettings] = await Promise.all([
                getDailyLog(dateStr),
                getWorkouts(dateStr),
                getFavoriteFoods(),
                getSettings()
            ]);

            setWorkouts(workoutData || []);
            setFavorites(favData || []);

            // Set available habits and nutrition targets from user settings
            if (userSettings?.custom_habits) {
                setSettings(prev => ({ ...prev, habits: userSettings.custom_habits || [] }));
            }
            setTargetsState({
                protein: userSettings?.target_protein ?? 0,
                calories: userSettings?.target_calories ?? 0,
            });

            if (log) {
                setMovementCompleted(log.movement_completed ?? null);
                setNutrition({
                    protein: log.protein_grams ?? 0,
                    carbs: log.carbs_grams ?? 0,
                    fat: log.fat_grams ?? 0,
                    calories: log.calories ?? 0,
                    windowStart: log.eating_window_start ?? '',
                    windowEnd: log.eating_window_end ?? '',
                    logged: log.nutrition_logged ?? false,
                });
                setFoodItems(log.food_items || []);
                setAlcohol(log.alcohol_drinks ?? 0);
                setSubjective({
                    sleep: log.sleep_quality ?? 3,
                    energy: log.energy_level ?? 3,
                    motivation: log.motivation_level ?? 3,
                    stress: log.stress_level ?? 3,
                    note: log.daily_note ?? log.notes ?? '',
                });
                setHabits(log.habits || []);
                setMenstrualFlow(log.menstrual_flow || null);
                setInitialXP(log.xp_earned || 0);
            } else {
                // Reset to defaults
                setMovementCompleted(null);
                setNutrition({ protein: 0, carbs: 0, fat: 0, calories: 0, windowStart: '', windowEnd: '', logged: true });
                setFoodItems([]);
                setAlcohol(0);
                setSubjective({ sleep: 3, energy: 3, motivation: 3, stress: 3, note: '' });
                setHabits([]);
                setMenstrualFlow(null);
                setInitialXP(0);
            }
        } catch (e) {
            console.error('Error fetching log:', e);
        } finally {
            setLoading(false);
            setTimeout(() => {
                isFirstLoad.current = false;
            }, 100);
        }
    }

    useEffect(() => {
        fetchLog();
    }, [date]);

    // Food Item Management
    function addFoodItems(items: any[]) {
        setFoodItems(prev => {
            const newItems = [...prev, ...items];
            updateNutritionTotals(newItems);
            return newItems;
        });
        haptics.success();
    }

    function updateNutritionTotals(items: any[]) {
        const totals = items.reduce(
            (acc, item) => {
                const rawQ = item.quantity !== undefined ? item.quantity : 1;
                const q = parseFloat(String(rawQ));
                const multiplier = isNaN(q) ? 0 : q;

                return {
                    calories: acc.calories + (parseFloat(String(item.calories)) || 0) * multiplier,
                    protein: acc.protein + (parseFloat(String(item.protein)) || 0) * multiplier,
                    carbs: acc.carbs + (parseFloat(String(item.carbs)) || 0) * multiplier,
                    fat: acc.fat + (parseFloat(String(item.fat)) || 0) * multiplier,
                };
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        setNutrition(prev => ({
            ...prev,
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fat: Math.round(totals.fat),
        }));
    }

    async function performSave(isManualLog = false) {
        console.log('[DEBUG] performSave starting...', { isManualLog });
        setSaving(true);

        try {
            const s = stateRef.current;
            if (!s) {
                return;
            }

            const offsetDate = new Date(s.date.getTime() - (s.date.getTimezoneOffset() * 60000));
            const dateStr = offsetDate.toISOString().split('T')[0];

            const logData = {
                date: dateStr,
                movement_completed: s.movementCompleted ?? undefined,
                movement_duration: s.totalDuration,
                movement_intensity: s.workouts.length > 0 ? s.workouts[0].intensity : undefined,
                calories: s.nutrition.calories,
                protein_grams: s.nutrition.protein,
                carbs_grams: s.nutrition.carbs,
                fat_grams: s.nutrition.fat,
                eating_window_start: s.nutrition.windowStart || null,
                eating_window_end: s.nutrition.windowEnd || null,
                nutrition_logged: s.nutrition.logged,
                food_items: s.foodItems,
                alcohol_drinks: s.alcohol,
                sleep_quality: s.subjective.sleep,
                energy_level: s.subjective.energy,
                motivation_level: s.subjective.motivation,
                stress_level: s.subjective.stress,
                daily_note: s.subjective.note,
                habits: s.habits,
                menstrual_flow: s.menstrualFlow,
            };

            await upsertDailyLog(logData);

            if (isManualLog) {
                haptics.success();
            }

            // Check for newly earned badges after every save
            try {
                const today = new Date();
                const startStr = format(subDays(today, 30), 'yyyy-MM-dd');
                const endStr = format(today, 'yyyy-MM-dd');
                const [streak, recentLogs, earnedBadges, settings, totalLogs] = await Promise.all([
                    getStreak(),
                    getMonthlyLogs(startStr, endStr),
                    getUserBadges(),
                    getSettings(),
                    getLifetimeLogCount(),
                ]);
                const alreadyEarned = new Set(earnedBadges.map((b: any) => b.badge_id));
                const newBadges = getNewlyEarnedBadges(recentLogs, streak, {
                    totalLogs,
                    proteinGoal: settings?.target_protein || undefined,
                }, alreadyEarned);
                await Promise.all(newBadges.map(b => awardBadge(b.id)));
                newBadges.forEach(b =>
                    toast.success(`${b.icon} Badge unlocked: ${b.name}!`, { duration: 5000 })
                );
            } catch (e) {
                console.error('Badge check failed', e);
            }
        } catch (e) {
            if (isManualLog) {
                toast.error('Failed to save. Please try again.');
                haptics.error();
            }
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
        );
    }

    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const dateStr = offsetDate.toISOString().split('T')[0];

    // Tab summary helpers
    const nutritionSummary = nutrition.calories > 0
        ? `${nutrition.calories} cal • ${nutrition.protein}g protein`
        : 'Not logged';

    const activitySummary = workouts.length > 0
        ? `${workouts.length} workout${workouts.length > 1 ? 's' : ''} • ${totalDuration}m`
        : movementCompleted === true ? 'Active' : movementCompleted === false ? 'Rest day' : 'Not logged';

    const wellnessSummary = `Sleep ${subjective.sleep}/5 • Energy ${subjective.energy}/5`;

    return (
        <>
            <div className="space-y-4 pb-32 pb-safe">
                {/* Tab Navigation */}
                <div className="flex bg-[var(--color-bg-muted)] rounded-xl p-1">
                    <button
                        onClick={() => { haptics.tap(); setActiveTab('nutrition'); }}
                        className={`flex-1 flex flex-col items-center py-2.5 rounded-lg font-medium transition-all ${activeTab === 'nutrition' ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                    >
                        <div className="flex items-center gap-1.5">
                            <Utensils className="w-4 h-4" />
                            <span className="text-sm font-bold">Nutrition</span>
                        </div>
                        <span className="text-[10px] mt-0.5 text-[var(--color-text-muted)] max-[320px]:hidden">
                            {nutrition.calories > 0 ? `${nutrition.calories} cal` : '—'}
                        </span>
                    </button>
                    <button
                        onClick={() => { haptics.tap(); setActiveTab('activity'); }}
                        className={`flex-1 flex flex-col items-center py-2.5 rounded-lg font-medium transition-all ${activeTab === 'activity' ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                    >
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4" />
                            <span className="text-sm font-bold">Activity</span>
                        </div>
                        <span className="text-[10px] mt-0.5 text-[var(--color-text-muted)] max-[320px]:hidden">
                            {workouts.length > 0 ? `${workouts.length} workout` : '—'}
                        </span>
                    </button>
                    <button
                        onClick={() => { haptics.tap(); setActiveTab('wellness'); }}
                        className={`flex-1 flex flex-col items-center py-2.5 rounded-lg font-medium transition-all ${activeTab === 'wellness' ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                    >
                        <div className="flex items-center gap-1.5">
                            <Heart className="w-4 h-4" />
                            <span className="text-sm font-bold">Wellness</span>
                        </div>
                        <span className="text-[10px] mt-0.5 text-[var(--color-text-muted)] max-[320px]:hidden">
                            {habits.length > 0 ? `${habits.length} habits` : '—'}
                        </span>
                    </button>
                </div>

                {/* ==================== NUTRITION TAB ==================== */}
                {activeTab === 'nutrition' && (
                    <div className="space-y-6">
                        <NutritionSection
                            nutrition={nutrition}
                            setNutrition={setNutrition}
                            foodItems={foodItems}
                            setFoodItems={setFoodItems}
                            setAlcohol={setAlcohol}
                            setSubjective={setSubjective}
                            setChatInitialInput={setChatInitialInput}
                            setShowWorkoutChat={setShowWorkoutChat}
                            onAddFoodItems={addFoodItems}
                            autoStartVoice={autoStartVoice}
                            showCamera={showCamera}
                            setShowCamera={setShowCamera}
                            setShowMenuScanner={setShowMenuScanner}
                            setShowFoodSelector={setShowFoodSelector}
                            setShowTextInput={setShowTextInput}
                            favorites={favorites}
                            setFavorites={setFavorites}
                            targets={targetsState}
                        />

                        <AlcoholSection
                            alcohol={alcohol}
                            setAlcohol={setAlcohol}
                        />
                    </div>
                )}

                {/* ==================== ACTIVITY TAB ==================== */}
                {activeTab === 'activity' && (
                    <div className="space-y-6">
                        <MovementSection
                            movementCompleted={movementCompleted}
                            setMovementCompleted={setMovementCompleted}
                            workouts={workouts}
                            setWorkouts={setWorkouts}
                            dateStr={dateStr}
                            onOpenAiCoach={() => setShowWorkoutChat(true)}
                            onAddWorkoutStart={() => setAddingWorkout(true)}
                            addingWorkout={addingWorkout}
                            onDeleteWorkoutStart={() => { }}
                        />
                    </div>
                )}

                {/* ==================== WELLNESS TAB ==================== */}
                {activeTab === 'wellness' && (
                    <div className="space-y-6">
                        <SubjectiveSection
                            subjective={subjective}
                            setSubjective={setSubjective}
                        />

                        <HabitsSection
                            habits={habits}
                            setHabits={setHabits}
                            availableHabits={settings.habits}
                        />
                    </div>
                )}

                {/* ==================== MODALS ==================== */}

                {showMenuScanner && (
                    <MenuScanner
                        onClose={() => setShowMenuScanner(false)}
                        onLog={(item) => {
                            addFoodItems([item]);
                            setShowMenuScanner(false);
                        }}
                    />
                )}

                <WorkoutChatModal
                    isOpen={showWorkoutChat}
                    onClose={() => setShowWorkoutChat(false)}
                    onSave={async (w) => {
                        try {
                            const added = await addWorkout({ ...w, date: dateStr });
                            setWorkouts([...workouts, added]);
                            toast.success('Workout added!');
                            setShowWorkoutChat(false);
                            setChatInitialInput('');
                        } catch (e) {
                            console.error("Failed to add workout", e);
                            toast.error("Failed to save workout. Please try again.");
                        }
                    }}
                    initialData={chatInitialInput}
                />

                {showFoodSelector && (
                    <FoodSelector
                        onClose={() => setShowFoodSelector(false)}
                        onSelect={(item) => {
                            addFoodItems([item]);
                            setShowFoodSelector(false);
                        }}
                    />
                )}

                <TextLogModal
                    isOpen={showTextInput}
                    onClose={() => setShowTextInput(false)}
                    onWorkoutRequest={(text) => {
                        setChatInitialInput(text);
                        setShowWorkoutChat(true);
                    }}
                    onProcessed={(intent) => {
                        if (intent.intent === 'log_food') {
                            if (intent.data?.items) {
                                let alcoholAdded = 0;
                                const newItems = intent.data.items.map((i: any) => {
                                    if (i.alcohol_units) alcoholAdded += i.alcohol_units;
                                    return i;
                                });

                                addFoodItems(newItems);
                                if (alcoholAdded > 0) {
                                    setAlcohol(prev => prev + alcoholAdded);
                                    toast.success(`Added: ${newItems.map((i: any) => i.name).join(', ')} (and +${alcoholAdded} standard drinks)`);
                                } else {
                                    toast.success(`Added: ${newItems.map((i: any) => i.name).join(', ')}`);
                                }
                            } else if (intent.data?.item) {
                                setSubjective(prev => ({ ...prev, note: (prev.note + ' ' + intent.data.item).trim() }));
                                toast(`Text added to notes (no items detected)`);
                            }
                        } else {
                            toast.error(`Could not understand. Please try again.`);
                        }
                    }}
                />
            </div>
        </>
    );
}
