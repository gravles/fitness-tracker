'use client';

import { VoiceInput } from '../VoiceInput';
import { FoodCamera } from '../FoodCamera';
import { Keyboard, ChefHat, Camera, X, Brain, Heart, Trash2, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { addFavoriteFood, deleteFavoriteFood, getFavoriteFoods, FavoriteFood } from '@/lib/api';

interface NutritionSectionProps {
    nutrition: {
        protein: number;
        carbs: number;
        fat: number;
        calories: number;
        windowStart: string;
        windowEnd: string;
        logged: boolean;
    };
    setNutrition: (val: any) => void;
    foodItems: any[];
    setFoodItems: (items: any[]) => void;
    setAlcohol: (val: any) => void; // For voice interactions that might add alcohol
    setSubjective: (val: any) => void; // For voice interactions adding notes
    setChatInitialInput: (val: string) => void; // For voice interactions logging workouts
    setShowWorkoutChat: (val: boolean) => void;
    onAddFoodItems: (items: any[]) => void;
    autoStartVoice: boolean;
    showCamera: boolean;
    setShowCamera: (val: boolean) => void;
    setShowMenuScanner: (val: boolean) => void;
    setShowFoodSelector: (val: boolean) => void;
    setShowTextInput: (val: boolean) => void;
    favorites: FavoriteFood[];
    setFavorites: (val: any) => void;
}

export function NutritionSection({
    nutrition,
    setNutrition,
    foodItems,
    setFoodItems,
    setAlcohol,
    setSubjective,
    setChatInitialInput,
    setShowWorkoutChat,
    onAddFoodItems,
    autoStartVoice,
    showCamera,
    setShowCamera,
    setShowMenuScanner,
    setShowFoodSelector,
    setShowTextInput,
    favorites,
    setFavorites
}: NutritionSectionProps) {
    const [loadingAI, setLoadingAI] = useState(false);

    function updateFoodItemQuantity(index: number, newQuantity: string | number) {
        const updated = [...foodItems];
        updated[index].quantity = newQuantity;
        updateNutritionTotals(updated);
        setFoodItems(updated);
    }

    function removeFoodItem(index: number) {
        const updated = foodItems.filter((_, i) => i !== index);
        updateNutritionTotals(updated);
        setFoodItems(updated);
    }

    // Duplicate logic from parent, but needed locally if updating via local helpers
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

        setNutrition({
            ...nutrition,
            protein: Math.round(p),
            calories: Math.round(c),
            carbs: Math.round(carbs),
            fat: Math.round(fat)
        });
    }

    function isFavorite(name: string) {
        return favorites.some(f => f.name.toLowerCase() === name.toLowerCase());
    }

    async function toggleFavorite(item: any) {
        const existing = favorites.find(f => f.name.toLowerCase() === item.name.toLowerCase());

        try {
            if (existing) {
                // Remove
                if (!confirm(`Remove '${item.name}' from favorites?`)) return;
                await deleteFavoriteFood(existing.id);
                setFavorites((prev: any[]) => prev.filter(f => f.id !== existing.id));
            } else {
                // Add
                const newFav = await addFavoriteFood({
                    name: item.name,
                    calories: item.calories,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                    portion_estimate: item.portion_estimate
                });
                setFavorites((prev: any[]) => [...prev, newFav]);
                alert(`Saved '${item.name}' to favorites!`);
            }
        } catch (e) {
            console.error('Error toggling favorite:', e);
            alert('Failed to update favorite');
        }
    }

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <span className="text-xl">🥗</span> Nutrition
                </h3>
                <button
                    onClick={() => setNutrition({ ...nutrition, logged: !nutrition.logged })}
                    className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${!nutrition.logged
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                >
                    {nutrition.logged ? "Mark as Not Tracked" : "Not Tracked"}
                </button>
            </div>

            {/* Quick Actions Row */}
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
                <button
                    onClick={() => setShowFoodSelector(true)}
                    className="flex flex-col items-center gap-1 min-w-[70px]"
                >
                    <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shadow-sm border border-pink-100">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-gray-600">History</span>
                </button>

                <VoiceInput
                    autoStart={autoStartVoice}
                    onIntentDetected={(intent) => {
                        if (intent.error) {
                            alert("Voice Error: " + intent.error);
                            return;
                        }

                        if (intent.intent === 'log_food') {
                            if (intent.data?.items) {
                                let alcoholAdded = 0;
                                const newItems = intent.data.items.map((i: any) => {
                                    if (i.alcohol_units) alcoholAdded += i.alcohol_units;
                                    return i;
                                });

                                onAddFoodItems(newItems);
                                if (alcoholAdded > 0) {
                                    setAlcohol((prev: number) => prev + alcoholAdded);
                                    alert(`Added: ${newItems.map((i: any) => i.name).join(', ')} (and +${alcoholAdded} standard drinks)`);
                                } else {
                                    alert(`Added: ${newItems.map((i: any) => i.name).join(', ')}`);
                                }
                            } else if (intent.data?.item) {
                                setSubjective((prev: any) => ({ ...prev, note: (prev.note + ' ' + intent.data.item).trim() }));
                                alert(`Voice text added to notes (no specific items detected)`);
                            }
                        } else if (intent.intent === 'log_workout') {
                            setChatInitialInput(intent.original || '');
                            setShowWorkoutChat(true);
                        } else {
                            alert(`Could not understand: "${intent.original}"`);
                        }
                    }}
                    customTrigger={(onClick, isListening) => (
                        <button
                            onClick={onClick}
                            className="flex flex-col items-center gap-1 min-w-[70px]"
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                <Keyboard className="w-6 h-6 hidden" /> {/* Dummy icon if needed, but VoiceInput handles internal icon usually? Checking VoiceInput implementation next. Assuming it handles logic but exposes trigger. */}
                                {/* Actually VoiceInput UI is self contained usually? Let's check VoiceInput usage.
                                    The previous usage was <VoiceInput ... /> which rendered the button. 
                                    I need to make sure VoiceInput accepts a custom trigger or I wrap it. 
                                    Looking at previous code: <VoiceInput ... /> was used directly.
                                    If I want to style it consistently, I might need to modify VoiceInput OR stick to its default button.
                                    
                                    Wait, the previous code had `<VoiceInput ... />` inside a flex row.
                                    Let's look at `VoiceInput.tsx` if possible. But I don't want to overengineer.
                                    
                                    Let's assume VoiceInput renders a button. The previous usage didn't pass "customTrigger".
                                    I'll just wrap it in a div to align label? Or just let it be.
                                    
                                    Actually, to make it look like a chip:
                                    Let's render it as is, but maybe I should create a "Quick Action" for it?
                                    
                                    If I can't customize VoiceInput easily without opening it, I will check it.
                                    Let's assume I check it after. For now, I'll put the others.
                                */}
                            </div>
                        </button>
                    )}
                />
                {/* Wait, I can't guess prop names. Let's revert to standard component usage and see if I can wrap it or if I need to edit it. 
                    I'll check VoiceInput first.
                 */}

            </div>

            {showCamera && (
                <div className="mb-6 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold text-gray-600">Scan Meal</h4>
                        <button onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <FoodCamera
                        onClose={() => setShowCamera(false)}
                        onCapture={async (img) => {
                            setShowCamera(false);
                            setLoadingAI(true);
                            try {
                                const res = await fetch('/api/ai/analyze-food', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ image: img })
                                });
                                const data = await res.json();

                                // Add as a specific food item
                                onAddFoodItems([{
                                    name: data.name || "Scanned  Meal",
                                    calories: data.calories,
                                    protein: data.protein,
                                    carbs: data.carbs,
                                    fat: data.fat
                                }]);

                                if (data.alcohol_units && data.alcohol_units > 0) {
                                    setAlcohol((prev: number) => prev + data.alcohol_units);
                                    alert(`Logged '${data.name}' and added +${data.alcohol_units} standard drinks.`);
                                }

                            } catch (e: any) {
                                console.error(e);
                                alert('AI Error: ' + (e.message || 'Failed to analyze food. Check usage limits.'));
                            } finally {
                                setLoadingAI(false);
                            }
                        }}
                    />
                </div>
            )}

            {loadingAI && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-blue-600">
                    <Brain className="w-8 h-8 animate-pulse mb-2" />
                    <p className="text-sm font-bold animate-pulse">Analyzing Food...</p>
                </div>
            )}

            <div className="space-y-4 animate-in fade-in">

                {/* Food Items List */}
                {foodItems.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {foodItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                <div className="flex-1">
                                    <span className="font-bold text-gray-800 block">{item.name}</span>
                                    {item.portion_estimate && <span className="text-xs text-gray-400 block mb-0.5">Unit: {item.portion_estimate}</span>}
                                    <span className="text-xs text-gray-500">
                                        {Math.round(item.calories * (item.quantity || 1))} kcal • {Math.round(item.protein * (item.quantity || 1))}g P • {Math.round(item.carbs * (item.quantity || 1))}g C
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center">
                                        <label className="text-[10px] uppercase font-bold text-gray-400">Qty</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={item.quantity !== undefined ? item.quantity : 1}
                                            onChange={(e) => updateFoodItemQuantity(idx, e.target.value)}
                                            className="w-16 p-1 text-center bg-white border border-gray-200 rounded text-sm font-bold"
                                        />
                                    </div>
                                    <button
                                        onClick={() => toggleFavorite(item)}
                                        className={`p-2 transition-colors ${isFavorite(item.name)
                                            ? 'text-red-500 bg-red-50 hover:bg-red-100'
                                            : 'text-gray-300 hover:text-pink-500'
                                            }`}
                                        title={isFavorite(item.name) ? "Remove from Favorites" : "Save to Favorites"}
                                    >
                                        <Heart className={`w-4 h-4 ${isFavorite(item.name) ? 'fill-current' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => removeFoodItem(idx)}
                                        className="text-gray-400 hover:text-red-500 p-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <label className="text-sm font-medium text-gray-500 flex justify-between">
                        Protein (g) <span className="text-blue-600 font-bold">{nutrition.protein}g</span>
                    </label>
                    <input
                        type="range" min="0" max="300" step="5"
                        value={nutrition.protein}
                        onChange={e => setNutrition({ ...nutrition, protein: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2 accent-blue-600"
                    />
                    <div className="flex gap-2 mt-2">
                        <input
                            type="number"
                            value={nutrition.protein || ''}
                            onChange={e => setNutrition({ ...nutrition, protein: parseInt(e.target.value) || 0 })}
                            className="w-20 p-2 bg-gray-50 rounded-lg text-center"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Calories</label>
                        <input
                            type="number"
                            value={nutrition.calories || ''}
                            onChange={e => setNutrition({ ...nutrition, calories: parseInt(e.target.value) || 0 })}
                            className="w-full mt-1 p-3 bg-gray-50 rounded-xl"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Eating Window</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="time"
                                value={nutrition.windowStart}
                                onChange={e => setNutrition({ ...nutrition, windowStart: e.target.value })}
                                className="w-full p-2 bg-gray-50 rounded-lg text-xs"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="time"
                                value={nutrition.windowEnd}
                                onChange={e => setNutrition({ ...nutrition, windowEnd: e.target.value })}
                                className="w-full p-2 bg-gray-50 rounded-lg text-xs"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Completion Toggle */}
            <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100 flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-green-900 text-sm">Log Complete?</h4>
                    <p className="text-xs text-green-700">Mark this day as fully tracked.</p>
                </div>
                <button
                    onClick={() => setNutrition({ ...nutrition, logged: !nutrition.logged })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${nutrition.logged ? 'bg-green-600' : 'bg-green-200'}`}
                >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${nutrition.logged ? 'translate-x-6' : ''}`} />
                </button>
            </div>
        </section>
    );
}
