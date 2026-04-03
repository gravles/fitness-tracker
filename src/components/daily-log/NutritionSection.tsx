'use client';

import { VoiceInput } from '../VoiceInput';
import { FoodCamera } from '../FoodCamera';
import { BarcodeScanner } from '../BarcodeScanner';
import { Keyboard, ChefHat, Camera, X, Brain, Heart, Trash2, BookOpen, Pencil, Barcode } from 'lucide-react';
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

interface MacroRingProps {
    value: number;
    target: number;
    label: string;
    color: string;
    trackColor: string;
    unit: string;
}

function MacroRing({ value, target, label, color, trackColor, unit }: MacroRingProps) {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const pct = target > 0 ? Math.min(1, value / target) : 0;
    const offset = circ * (1 - pct);
    const over = target > 0 && value > target;
    const remaining = target > 0 ? Math.max(0, target - value) : 0;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={r} strokeWidth="8" fill="none" stroke={trackColor} />
                    <circle
                        cx="44" cy="44" r={r}
                        strokeWidth="8" fill="none"
                        stroke={over ? '#f97316' : color}
                        strokeDasharray={circ}
                        strokeDashoffset={target > 0 ? offset : circ}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                    <span className={`text-lg font-black ${over ? 'text-orange-500' : 'text-gray-900'}`}>{value}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{unit}</span>
                </div>
            </div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</p>
            {target > 0 ? (
                <p className={`text-[11px] font-semibold ${over ? 'text-orange-500' : 'text-gray-400'}`}>
                    {over ? `${value - target} over` : `${remaining} left`}
                </p>
            ) : (
                <p className="text-[11px] text-gray-300">no target set</p>
            )}
        </div>
    );
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
    const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

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

            <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text)]">
                        <span className="text-xl">🥗</span> Nutrition
                    </h3>
                </div>

                {/* Quick Actions Grid - 2 rows of 3 */}
                <div className="grid grid-cols-3 gap-2">
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
                                className="flex flex-col items-center gap-1 w-full"
                            >
                                <div className={`w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse border-red-400' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                    <span className="text-lg">🎙️</span>
                                </div>
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">
                                    {isListening ? 'Active' : 'Voice'}
                                </span>
                            </button>
                        )}
                    />

                    <button
                        onClick={() => setShowCamera(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-100">
                            <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Camera</span>
                    </button>

                    <button
                        onClick={() => setShowTextInput(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                            <Keyboard className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Type</span>
                    </button>

                    <button
                        onClick={() => setShowMenuScanner(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center shadow-sm border border-yellow-100">
                            <ChefHat className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Scanner</span>
                    </button>

                    <button
                        onClick={() => setShowFoodSelector(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shadow-sm border border-pink-100">
                            <Heart className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Favorites</span>
                    </button>

                    <button
                        onClick={() => setShowBarcodeScanner(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-sm border border-green-100">
                            <Barcode className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Barcode</span>
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

                    {/* Macro summary — always at top */}
                    <div className="pt-2 pb-1">
                        {/* Calorie + Protein rings */}
                        <div className="flex justify-around mb-3">
                            <MacroRing
                                value={nutrition.calories}
                                target={targets?.calories || 0}
                                label="Calories"
                                color="#f97316"
                                trackColor="#fed7aa"
                                unit="kcal"
                            />
                            <MacroRing
                                value={nutrition.protein}
                                target={targets?.protein || 0}
                                label="Protein"
                                color="#3b82f6"
                                trackColor="#bfdbfe"
                                unit="g"
                            />
                        </div>
                        {/* Carbs + Fat chips */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-yellow-50 rounded-xl p-2.5 text-center border border-yellow-100">
                                <p className="text-lg font-black text-yellow-700">{nutrition.carbs}<span className="text-xs font-medium ml-0.5">g</span></p>
                                <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide">Carbs</p>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-2.5 text-center border border-purple-100">
                                <p className="text-lg font-black text-purple-700">{nutrition.fat}<span className="text-xs font-medium ml-0.5">g</span></p>
                                <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wide">Fat</p>
                            </div>
                        </div>
                    </div>

                    {/* Food Items List */}
                    {foodItems.length > 0 && (
                        <div className="space-y-2">
                            {foodItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
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
                                                onChange={(e) => updateFoodItemQuantity(index, e.target.value)}
                                                className="w-16 p-1 text-center bg-white border border-gray-200 rounded text-sm font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEdit(item, index)}
                                                className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition-all tap-target"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeFoodItem(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all tap-target"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

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

                {/* Log Complete Toggle */}
                <div className={`mt-6 p-4 rounded-xl border flex items-center justify-between transition-colors ${
                    nutrition.logged
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-[var(--color-bg-subtle)] border-[var(--color-border-light)]'
                }`}>
                    <div>
                        <h4 className={`font-bold text-sm ${nutrition.logged ? 'text-green-700 dark:text-green-400' : 'text-[var(--color-text)]'}`}>
                            All food logged for today?
                        </h4>
                        <p className={`text-xs mt-0.5 ${nutrition.logged ? 'text-green-600 dark:text-green-500' : 'text-[var(--color-text-muted)]'}`}>
                            {nutrition.logged ? 'Day marked complete — counts toward your streak.' : 'Toggle on when you\'ve finished logging.'}
                        </p>
                    </div>
                    <button
                        onClick={() => setNutrition({ ...nutrition, logged: !nutrition.logged })}
                        aria-label={nutrition.logged ? 'Mark nutrition as incomplete' : 'Mark nutrition as complete'}
                        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${nutrition.logged ? 'bg-green-500' : 'bg-[var(--color-bg-muted)]'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${nutrition.logged ? 'translate-x-6' : ''}`} />
                    </button>
                </div>
            </section >

            {/* Barcode scanner rendered outside section to avoid z-index trapping */}
            {showBarcodeScanner && (
                <BarcodeScanner
                    onResult={food => {
                        onAddFoodItems([{ ...food, quantity: 1 }]);
                    }}
                    onClose={() => setShowBarcodeScanner(false)}
                />
            )}
        </>
    );
}
