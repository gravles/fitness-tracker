'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDailyLog, upsertDailyLog, getWorkouts, Workout, getFavoriteFoods, FavoriteFood, addWorkout } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { MenuScanner } from './MenuScanner';
import { WorkoutChatModal } from './WorkoutChatModal';
import { FoodSelector } from './FoodSelector';
import { MovementSection } from './daily-log/MovementSection';
import { NutritionSection } from './daily-log/NutritionSection';
import { AlcoholSection } from './daily-log/AlcoholSection';
import { SubjectiveSection } from './daily-log/SubjectiveSection';
import { HabitsSection } from './daily-log/HabitsSection';
import { TextLogModal } from './TextLogModal';



interface DailyLogFormProps {
    date: Date;
}

export function DailyLogForm({ date }: DailyLogFormProps) {
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [foodItems, setFoodItems] = useState<any[]>([]);
    const [showMenuScanner, setShowMenuScanner] = useState(false);
    const [showWorkoutChat, setShowWorkoutChat] = useState(false);
    const [chatInitialInput, setChatInitialInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);

    // The original file had `setShowTextInput` triggered by a button. I probably need to keep that modal or logic.
    // I see `NutritionSection` triggers `setShowTextInput`.
    // So the modal for text input must be here.

    const [showFoodSelector, setShowFoodSelector] = useState(false);

    // State Variables
    const [settings, setSettings] = useState({ cycle: true, habits: [] as string[] });
    const [targetsState, setTargetsState] = useState({ protein: 0, calories: 0 });
    const [movementCompleted, setMovementCompleted] = useState<boolean | null>(null);
    const [nutrition, setNutrition] = useState({
        protein: 0, carbs: 0, fat: 0, calories: 0,
        windowStart: '', windowEnd: '', logged: true
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
    useEffect(() => {
        if (loading || isFirstLoad.current) return;

        if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);

        autosaveTimeout.current = setTimeout(() => {
            triggerSave();
        }, 2000); // 2 second debounce

        return () => {
            if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
        };
    }, [
        movementCompleted, workouts, nutrition, alcohol, subjective, habits, menstrualFlow, foodItems
    ]);

    // Sequential Save Handler
    async function triggerSave(manual = false) {
        if (isSavingRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        isSavingRef.current = true;
        setSaving(true);

        try {
            await performSave(manual);
        } finally {
            isSavingRef.current = false;
            setSaving(false);

            // If another change happened while we were saving, save again immediately
            if (pendingSaveRef.current) {
                pendingSaveRef.current = false;
                triggerSave(false); // recursive autosave
            }
        }
    }


    async function fetchLog() {
        setLoading(true);
        // Ensure local date string YYYY-MM-DD
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            // Fetch everything we need: Log, Workouts, AND Settings (for targets)
            const [logData, workoutData, favoritesData, settingsData] = await Promise.all([
                getDailyLog(dateStr),
                getWorkouts(dateStr),
                getFavoriteFoods(),
                import('@/lib/api').then(m => m.getSettings())
            ]);

            // Update Settings State
            if (settingsData) {
                setSettings({
                    cycle: settingsData.enable_cycle_tracking ?? true,
                    habits: settingsData.custom_habits && settingsData.custom_habits.length > 0 ? settingsData.custom_habits : ['Meditation', 'Cold Plunge', 'Reading', 'Stretching', 'No Sugar']
                });
                setTargetsState({
                    protein: settingsData.target_protein || 0,
                    calories: settingsData.target_calories || 0
                });
            }

            if (logData) {
                setMovementCompleted(logData.movement_completed);
                setNutrition({
                    protein: logData.protein_grams || 0,
                    carbs: logData.carbs_grams || 0,
                    fat: logData.fat_grams || 0,
                    calories: logData.calories || 0,
                    windowStart: logData.eating_window_start || '',
                    windowEnd: logData.eating_window_end || '',
                    logged: logData.nutrition_logged ?? false
                });
                setFoodItems(logData.food_items || []);
                setAlcohol(logData.alcohol_drinks || 0);
                setSubjective({
                    sleep: logData.sleep_quality || 3,
                    energy: logData.energy_level || 3,
                    motivation: logData.motivation_level || 3,
                    stress: logData.stress_level || 3,
                    note: logData.daily_note || ''
                });
                setHabits(logData.habits || []);
                setMenstrualFlow(logData.menstrual_flow || null);

                // Calculate Initial XP from existing data
                const { calculateXP } = await import('@/lib/gamification');
                const t = settingsData ? { daily_protein: settingsData.target_protein || 0, daily_calories: settingsData.target_calories || 0 } : undefined;
                const baseline = calculateXP(logData, t);
                setInitialXP(baseline);

            } else {
                // Reset form defaults if no log exists
                setMovementCompleted(null);
                setNutrition({
                    protein: 0, carbs: 0, fat: 0, calories: 0,
                    windowStart: '', windowEnd: '', logged: false
                });
                setFoodItems([]);
                setAlcohol(0);
                setSubjective({
                    sleep: 3, energy: 3, motivation: 3, stress: 3, note: ''
                });
                setHabits([]);
                setMenstrualFlow(null);
                setMenstrualFlow(null);
                setInitialXP(0);
            }
            setWorkouts(workoutData || []);
            setFavorites(favoritesData || []);

        } catch (error) {
            console.error('Error fetching log:', error);
        } finally {
            setLoading(false);
            // Allow autosave after initial load
            setTimeout(() => { isFirstLoad.current = false; }, 1000);
        }
    }

    useEffect(() => {
        fetchLog();
    }, [date]);

    // Food Item Management
    function addFoodItems(items: any[]) {
        // Init quantity to 1 if not present
        const newItems = items.map(i => ({ ...i, quantity: i.quantity || 1 }));
        setFoodItems(prev => {
            const updatedList = [...prev, ...newItems];
            updateNutritionTotals(updatedList);
            return updatedList;
        });
    }

    // Helper needed for addFoodItems above
    function updateNutritionTotals(items: any[]) {
        let p = 0, c = 0, carbs = 0, fat = 0;

        items.forEach(item => {
            const rawQ = item.quantity !== undefined ? item.quantity : 1;
            const q = parseFloat(String(rawQ));
            const multiplier = isNaN(q) ? 0 : q;

            p += (item.protein || 0) * multiplier;
            c += (item.calories || 0) * multiplier;
            carbs += (item.carbs || 0) * multiplier;
            fat += (item.fat || 0) * multiplier;
        });

        setNutrition(prev => ({
            ...prev,
            protein: Math.round(p),
            calories: Math.round(c),
            carbs: Math.round(carbs),
            fat: Math.round(fat)
        }));
    }

    async function performSave(isManualLog = false) {
        const isAutosave = !isManualLog; // Semantic clarity
        // Note: setSaving is handled by triggerSave wrapper
        // setSaving(true); 
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            // --- GAMIFICATION LOGIC START ---
            const { calculateXP } = await import('@/lib/gamification');

            // 1. Reconstruct New State
            const currentLogState: any = {
                movement_completed: movementCompleted === false ? false : (movementCompleted === true || workouts.length > 0),
                movement_duration: totalDuration,
                protein_grams: nutrition.protein,
                calories: nutrition.calories,
                habits: habits,
                date: dateStr
            };

            // 2. Refresh Targets (ensure we use latest keys)
            const activeTargets = targetsState ? { daily_protein: targetsState.protein, daily_calories: targetsState.calories } : undefined;
            const newDailyXP = calculateXP(currentLogState, activeTargets);

            // 3. Calculate Delta
            const xpDelta = newDailyXP - initialXP;

            // --- END GAMIFICATION PRE-CALC ---

            const logData = {
                date: dateStr,
                movement_completed: currentLogState.movement_completed,
                movement_duration: totalDuration,

                protein_grams: nutrition.protein,
                carbs_grams: nutrition.carbs,
                fat_grams: nutrition.fat,
                calories: nutrition.calories,
                eating_window_start: nutrition.windowStart || null,
                eating_window_end: nutrition.windowEnd || null,
                nutrition_logged: nutrition.logged,

                food_items: foodItems,

                alcohol_drinks: alcohol,

                sleep_quality: subjective.sleep,
                energy_level: subjective.energy,
                motivation_level: subjective.motivation,
                stress_level: subjective.stress,
                daily_note: subjective.note,

                habits: habits,
                menstrual_flow: menstrualFlow
            };

            await upsertDailyLog(logData);

            // Apply XP update if any
            if (xpDelta !== 0) {
                const { updateUserXP } = await import('@/lib/api');
                const result = await updateUserXP(xpDelta);
                setInitialXP(newDailyXP); // Update baseline for next save

                if (!isAutosave) {
                    if (xpDelta > 0) {
                        alert(`Saved! You earned +${xpDelta} XP! (Daily Total: ${newDailyXP}) ${result?.leveledUp ? 'LEVEL UP! 🎉' : ''}`);
                    } else {
                        alert(`Saved! Updated daily stats.`);
                    }
                }
            } else {
                if (!isAutosave) alert('Saved!');
            }

        } catch (error) {
            console.error('Error saving log:', error);
            if (!isAutosave) alert('Failed to save log');
        } finally {
            // setSaving(false); // Handled by triggerSave
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Offset date for children who need it
    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const dateStr = offsetDate.toISOString().split('T')[0];

    return (
        <div className="space-y-6 pb-32">

            <MovementSection
                movementCompleted={movementCompleted}
                setMovementCompleted={setMovementCompleted}
                workouts={workouts}
                setWorkouts={setWorkouts}
                dateStr={dateStr}
                onOpenAiCoach={() => setShowWorkoutChat(true)}
                onAddWorkoutStart={() => setAddingWorkout(true)} // Note: MovementSection has local adding state, this might be redundant or unused, but keeps consistency
                addingWorkout={addingWorkout}
                onDeleteWorkoutStart={() => { }}
            />

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
            />

            <AlcoholSection
                alcohol={alcohol}
                setAlcohol={setAlcohol}
            />

            <SubjectiveSection
                subjective={subjective}
                setSubjective={setSubjective}
            />

            <HabitsSection
                habits={habits}
                setHabits={setHabits}
                availableHabits={settings.habits}
            />

            {/* Floating Action Button for Manual Save (optional as autosave exists, but good for UX) */}
            <div className="fixed bottom-24 right-6 md:right-1/2 md:translate-x-32 z-30">
                <button
                    onClick={() => triggerSave(true)}
                    disabled={saving}
                    className="bg-gray-900 text-white rounded-full p-4 shadow-xl shadow-gray-400 hover:scale-110 transition-transform active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <span className="font-bold text-sm">SAVE</span>}
                </button>
            </div>


            {/* Modals and Overlays */}

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
                onSave={(w) => {
                    addWorkout({ ...w, date: dateStr }).then(added => {
                        setWorkouts([...workouts, added]);
                        alert('Workout added!');
                    });
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
                                alert(`Added: ${newItems.map((i: any) => i.name).join(', ')} (and +${alcoholAdded} standard drinks)`);
                            } else {
                                alert(`Added: ${newItems.map((i: any) => i.name).join(', ')}`);
                            }
                        } else if (intent.data?.item) {
                            setSubjective(prev => ({ ...prev, note: (prev.note + ' ' + intent.data.item).trim() }));
                            alert(`Text added to notes (no specific items detected)`);
                        }
                    } else {
                        alert(`Could not understand. Please try again.`);
                    }
                }}
            />
        </div>
    );
}
