'use client';

import { VoiceInput } from '../VoiceInput';
import { FoodCamera } from '../FoodCamera';
import { Keyboard, ChefHat, Camera, X, Brain, Heart, Trash2, BookOpen, Pencil } from 'lucide-react';
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
    targets?: { protein: number; calories: number };
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
    setFavorites,
    targets
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

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<any>(null);

    function startEdit(item: any, index: number) {
        setEditingIndex(index);
        setEditForm({ ...item, quantity: item.quantity || 1 });
    }

    function saveEdit() {
        if (editingIndex === null || !editForm) return;
        const updatedItems = [...foodItems];
        updatedItems[editingIndex] = editForm;
        setFoodItems(updatedItems);
        updateNutritionTotals(updatedItems);
        setEditingIndex(null);
        setEditForm(null);
    }

    return (
        <>
            {/* Edit Modal Overlay */}
            {editingIndex !== null && editForm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Edit Food Item</h3>
                            <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Portion Unit</label>
                                    <input
                                        type="text"
                                        value={editForm.portion_estimate || ''}
                                        onChange={e => setEditForm({ ...editForm, portion_estimate: e.target.value })}
                                        placeholder="e.g. 1 slice"
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.quantity}
                                        onChange={e => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-orange-400 uppercase mb-1">Calories (per unit)</label>
                                    <input
                                        type="number"
                                        value={editForm.calories}
                                        onChange={e => setEditForm({ ...editForm, calories: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-orange-50 rounded-xl border border-orange-100 text-sm font-bold text-orange-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-400 uppercase mb-1">Protein (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.protein}
                                        onChange={e => setEditForm({ ...editForm, protein: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm font-bold text-blue-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-yellow-500 uppercase mb-1">Carbs (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.carbs}
                                        onChange={e => setEditForm({ ...editForm, carbs: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-sm font-bold text-yellow-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-400 uppercase mb-1">Fat (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.fat}
                                        onChange={e => setEditForm({ ...editForm, fat: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-purple-50 rounded-xl border border-purple-100 text-sm font-bold text-purple-800"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveEdit}
                                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg mt-2"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <span className="text-xl">🎙️</span>
                                </div>
                                <span className="text-xs font-bold text-gray-600">{isListening ? 'Listening' : 'Voice'}</span>
                            </button>
                        )}
                    />

                    <button
                        onClick={() => setShowCamera(true)}
                        className="flex flex-col items-center gap-1 min-w-[70px]"
                    >
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100">
                            <Camera className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">Camera</span>
                    </button>

                    <button
                        onClick={() => setShowTextInput(true)}
                        className="flex flex-col items-center gap-1 min-w-[70px]"
                    >
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                            <Keyboard className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">Type</span>
                    </button>

                    <button
                        onClick={() => setShowMenuScanner(true)}
                        className="flex flex-col items-center gap-1 min-w-[70px]"
                    >
                        <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center shadow-sm border border-yellow-100">
                            <ChefHat className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">Scan Menu</span>
                    </button>

                    <button
                        onClick={() => setShowFoodSelector(true)}
                        className="flex flex-col items-center gap-1 min-w-[70px]"
                    >
                        <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shadow-sm border border-pink-100">
                            <Heart className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-600">Favorites</span>
                    </button>
                </div>

                {showCamera && (
                    <div className="mb-6 animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-600">Scan Meal</h4>
                            <button onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <FoodCamera
                            onClose={() => setShowCamera(false)}
                            autoStart={true}
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
                                            onClick={() => startEdit(item, idx)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit Item"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
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

                    {/* Read-Only Stats Grid with Progress Rings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Protein with Progress */}
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center relative">
                            {targets?.protein && targets.protein > 0 && (
                                <div className="absolute top-2 right-2">
                                    <svg className="w-8 h-8 -rotate-90">
                                        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="none" className="text-blue-100" />
                                        <circle
                                            cx="16" cy="16" r="12"
                                            stroke="currentColor" strokeWidth="3" fill="none"
                                            className="text-blue-500"
                                            strokeDasharray={`${Math.min(100, (nutrition.protein / targets.protein) * 100) * 0.754} 100`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                            )}
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Protein</span>
                            <span className="text-xl font-black text-blue-700">{nutrition.protein}<span className="text-sm font-medium ml-0.5">g</span></span>
                            {targets?.protein && targets.protein > 0 && (
                                <span className="text-[10px] text-blue-500 font-medium">/ {targets.protein}g</span>
                            )}
                        </div>

                        {/* Calories with Progress */}
                        <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 flex flex-col items-center relative">
                            {targets?.calories && targets.calories > 0 && (
                                <div className="absolute top-2 right-2">
                                    <svg className="w-8 h-8 -rotate-90">
                                        <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="3" fill="none" className="text-orange-100" />
                                        <circle
                                            cx="16" cy="16" r="12"
                                            stroke="currentColor" strokeWidth="3" fill="none"
                                            className="text-orange-500"
                                            strokeDasharray={`${Math.min(100, (nutrition.calories / targets.calories) * 100) * 0.754} 100`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                            )}
                            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Calories</span>
                            <span className="text-xl font-black text-orange-700">{nutrition.calories}</span>
                            {targets?.calories && targets.calories > 0 && (
                                <span className="text-[10px] text-orange-500 font-medium">/ {targets.calories}</span>
                            )}
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-2xl border border-yellow-100 flex flex-col items-center">
                            <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Carbs</span>
                            <span className="text-xl font-black text-yellow-700">{nutrition.carbs}<span className="text-sm font-medium ml-0.5">g</span></span>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100 flex flex-col items-center">
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Fat</span>
                            <span className="text-xl font-black text-purple-700">{nutrition.fat}<span className="text-sm font-medium ml-0.5">g</span></span>
                        </div>
                    </div>

                    {/* Eating Window */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Eating Window</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={nutrition.windowStart}
                                onChange={e => setNutrition({ ...nutrition, windowStart: e.target.value })}
                                className="flex-1 p-2 bg-gray-50 rounded-xl text-sm border border-gray-100 font-medium"
                            />
                            <span className="text-gray-300 font-bold">-</span>
                            <input
                                type="time"
                                value={nutrition.windowEnd}
                                onChange={e => setNutrition({ ...nutrition, windowEnd: e.target.value })}
                                className="flex-1 p-2 bg-gray-50 rounded-xl text-sm border border-gray-100 font-medium"
                            />
                        </div>
                    </div>
                </div>


            </section>
        </>
    );
}
