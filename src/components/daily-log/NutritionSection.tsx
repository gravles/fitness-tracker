'use client';

import { VoiceInput } from '../VoiceInput';
import { FoodCamera } from '../FoodCamera';
import { BarcodeScanner } from '../BarcodeScanner';
import { Keyboard, ChefHat, Camera, X, Brain, Heart, Trash2, BookOpen, Pencil, Barcode, Loader2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { addFavoriteFood, deleteFavoriteFood, getFavoriteFoods, FavoriteFood } from '@/lib/api';
import { confirm } from '@/components/ConfirmDialog';

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
                    <span className={`text-lg font-black ${over ? 'text-orange-500' : 'text-[var(--color-text)]'}`}>{value}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{unit}</span>
                </div>
            </div>
            <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
            {target > 0 ? (
                <p className={`text-[11px] font-semibold ${over ? 'text-orange-500' : 'text-[var(--color-text-muted)]'}`}>
                    {over ? `${value - target} over` : `${remaining} left`}
                </p>
            ) : (
                <p className="text-[11px] text-[var(--color-text-muted)] opacity-60">no target set</p>
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
    const [voiceListening, setVoiceListening] = useState(false);
    const [voiceProcessing, setVoiceProcessing] = useState(false);

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
                if (!await confirm({ title: 'Remove Favorite', message: `Remove '${item.name}' from favorites?` })) return;
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
                toast.success(`Saved '${item.name}' to favorites!`);
            }
        } catch (e) {
            console.error('Error toggling favorite:', e);
            toast.error('Failed to update favorite');
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
                    <div className="bg-[var(--color-surface-elevated)] rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">Edit Food Item</h3>
                            <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-[var(--color-bg-subtle)] rounded-full">
                                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] font-bold text-[var(--color-text)] outline-none"
                                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                    onBlur={e => { e.target.style.borderColor = ''; }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Portion Unit</label>
                                    <input
                                        type="text"
                                        value={editForm.portion_estimate || ''}
                                        onChange={e => setEditForm({ ...editForm, portion_estimate: e.target.value })}
                                        placeholder="e.g. 1 slice"
                                        className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text)] outline-none"
                                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                        onBlur={e => { e.target.style.borderColor = ''; }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.quantity}
                                        onChange={e => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm font-bold text-[var(--color-text)] outline-none"
                                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                        onBlur={e => { e.target.style.borderColor = ''; }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#f97316' }}>Calories (per unit)</label>
                                    <input
                                        type="number"
                                        value={editForm.calories}
                                        onChange={e => setEditForm({ ...editForm, calories: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#3b82f6' }}>Protein (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.protein}
                                        onChange={e => setEditForm({ ...editForm, protein: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--color-warning)' }}>Carbs (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.carbs}
                                        onChange={e => setEditForm({ ...editForm, carbs: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#a855f7' }}>Fat (g)</label>
                                    <input
                                        type="number"
                                        value={editForm.fat}
                                        onChange={e => setEditForm({ ...editForm, fat: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveEdit}
                                className="w-full py-4 text-white rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg mt-2"
                                style={{ background: 'var(--color-navy)' }}
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
                {/* Listening / Processing banner */}
                {(voiceListening || voiceProcessing) && (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-2 ${
                        voiceListening
                            ? 'bg-red-500/10 border border-red-500/30'
                            : 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30'
                    }`}>
                        {voiceListening ? (
                            <>
                                <div className="relative flex-shrink-0">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
                                    <div className="w-3 h-3 rounded-full bg-red-500 relative" />
                                </div>
                                <span className="text-sm font-bold text-red-500">Listening… speak now</span>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                                <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>Processing your voice…</span>
                            </>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <VoiceInput
                        autoStart={autoStartVoice}
                        onStateChange={(listening, processing) => {
                            setVoiceListening(listening);
                            setVoiceProcessing(processing);
                        }}
                        onIntentDetected={(intent) => {
                            if (intent.error) {
                                toast.error("Voice Error: " + intent.error);
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
                                        toast.success(`Added: ${newItems.map((i: any) => i.name).join(', ')} (and +${alcoholAdded} standard drinks)`);
                                    } else {
                                        toast.success(`Added: ${newItems.map((i: any) => i.name).join(', ')}`);
                                    }
                                } else if (intent.data?.item) {
                                    setSubjective((prev: any) => ({ ...prev, note: (prev.note + ' ' + intent.data.item).trim() }));
                                    toast(`Voice text added to notes (no items detected)`);
                                }
                            } else if (intent.intent === 'log_workout') {
                                setChatInitialInput(intent.original || '');
                                setShowWorkoutChat(true);
                            } else {
                                toast.error(`Could not understand: "${intent.original}"`);
                            }
                        }}
                        customTrigger={(onClick, isListening, isProcessing) => (
                            <button
                                onClick={onClick}
                                disabled={isProcessing}
                                className="flex flex-col items-center gap-1 w-full"
                            >
                                <div className="relative w-full flex justify-center">
                                    {/* Ping ring when listening */}
                                    {isListening && (
                                        <span className="absolute inset-0 flex items-center justify-center">
                                            <span className="w-[52px] h-[52px] rounded-2xl bg-red-500 animate-ping opacity-25 absolute" />
                                        </span>
                                    )}
                                    <div
                                        className={`w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border transition-all duration-200 relative z-10 ${
                                            isListening ? 'bg-red-500 border-red-400 scale-110' :
                                            isProcessing ? 'border-[var(--color-primary)] opacity-70' : ''
                                        }`}
                                        style={!isListening ? { background: 'rgba(29,95,168,0.08)', color: 'var(--color-primary)', borderColor: 'rgba(29,95,168,0.2)' } : undefined}
                                    >
                                        {isProcessing
                                            ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
                                            : isListening
                                            ? <Mic className="w-5 h-5 text-white" />
                                            : <span className="text-lg">🎙️</span>
                                        }
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold max-[320px]:hidden leading-tight ${
                                    isListening ? 'text-red-500' :
                                    isProcessing ? 'text-[var(--color-primary)]' :
                                    'text-[var(--color-text-muted)]'
                                }`}>
                                    {isProcessing ? 'Thinking…' : isListening ? 'Listening' : 'Voice'}
                                </span>
                            </button>
                        )}
                    />

                    <button
                        onClick={() => setShowCamera(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border" style={{ background: 'rgba(29,95,168,0.08)', color: 'var(--color-primary)', borderColor: 'rgba(29,95,168,0.2)' }}>
                            <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Camera</span>
                    </button>

                    <button
                        onClick={() => setShowTextInput(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border" style={{ background: 'rgba(29,95,168,0.08)', color: 'var(--color-primary)', borderColor: 'rgba(29,95,168,0.2)' }}>
                            <Keyboard className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Type</span>
                    </button>

                    <button
                        onClick={() => setShowMenuScanner(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border" style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold)', borderColor: 'rgba(201,168,76,0.3)' }}>
                            <ChefHat className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Scanner</span>
                    </button>

                    <button
                        onClick={() => setShowFoodSelector(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border" style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899', borderColor: 'rgba(236,72,153,0.2)' }}>
                            <Heart className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Favorites</span>
                    </button>

                    <button
                        onClick={() => setShowBarcodeScanner(true)}
                        className="flex flex-col items-center gap-1 w-full"
                    >
                        <div className="w-full aspect-square max-w-[52px] mx-auto rounded-2xl flex items-center justify-center shadow-sm border" style={{ background: 'rgba(29,95,168,0.08)', color: 'var(--color-primary)', borderColor: 'rgba(29,95,168,0.2)' }}>
                            <Barcode className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] max-[320px]:hidden leading-tight">Barcode</span>
                    </button>
                </div>

                {showCamera && (
                    <div className="mb-6 animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-[var(--color-text-muted)]">Scan Meal</h4>
                            <button onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-[var(--color-text-muted)]" /></button>
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
                                        toast.success(`Logged '${data.name}' and added +${data.alcohol_units} standard drinks.`);
                                    }

                                } catch (e: any) {
                                    console.error(e);
                                    toast.error('AI Error: ' + (e.message || 'Failed to analyze food. Check usage limits.'));
                                } finally {
                                    setLoadingAI(false);
                                }
                            }}
                        />
                    </div>
                )}

                {loadingAI && (
                    <div className="absolute inset-0 bg-[var(--color-surface-elevated)]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center" style={{ color: 'var(--color-primary)' }}>
                        <Brain className="w-8 h-8 animate-pulse mb-2" />
                        <p className="text-sm font-bold animate-pulse">Analyzing Food...</p>
                    </div>
                )}

                {showBarcodeScanner && (
                    <div className="mt-4">
                        <BarcodeScanner
                            onResult={food => {
                                onAddFoodItems([{ ...food, quantity: 1 }]);
                                setShowBarcodeScanner(false);
                            }}
                            onClose={() => setShowBarcodeScanner(false)}
                        />
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
                                trackColor="rgba(249,115,22,0.15)"
                                unit="kcal"
                            />
                            <MacroRing
                                value={nutrition.protein}
                                target={targets?.protein || 0}
                                label="Protein"
                                color="#3b82f6"
                                trackColor="rgba(59,130,246,0.15)"
                                unit="g"
                            />
                        </div>
                        {/* Carbs + Fat chips */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl p-2.5 text-center border" style={{ background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.2)' }}>
                                <p className="text-lg font-black" style={{ color: 'var(--color-warning)' }}>{nutrition.carbs}<span className="text-xs font-medium ml-0.5">g</span></p>
                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-warning)' }}>Carbs</p>
                            </div>
                            <div className="rounded-xl p-2.5 text-center border" style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.2)' }}>
                                <p className="text-lg font-black" style={{ color: '#a855f7' }}>{nutrition.fat}<span className="text-xs font-medium ml-0.5">g</span></p>
                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#a855f7' }}>Fat</p>
                            </div>
                        </div>
                    </div>

                    {/* Food Items List */}
                    {foodItems.length > 0 && (
                        <div className="space-y-2">
                            {foodItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-[var(--color-bg-subtle)] rounded-lg border border-[var(--color-border-light)] text-sm">
                                    <div className="flex-1">
                                        <span className="font-bold text-[var(--color-text)] block">{item.name}</span>
                                        {item.portion_estimate && <span className="text-xs text-[var(--color-text-muted)] block mb-0.5">Unit: {item.portion_estimate}</span>}
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            {Math.round(item.calories * (item.quantity || 1))} kcal • {Math.round(item.protein * (item.quantity || 1))}g P • {Math.round(item.carbs * (item.quantity || 1))}g C
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center">
                                            <label className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Qty</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={item.quantity !== undefined ? item.quantity : 1}
                                                onChange={(e) => updateFoodItemQuantity(index, e.target.value)}
                                                className="w-16 p-1 text-center bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-sm font-bold text-[var(--color-text)]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEdit(item, index)}
                                                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] rounded-lg transition-all tap-target"
                                                style={{}}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,95,168,0.08)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeFoodItem(index)}
                                                className="p-2 text-[var(--color-text-muted)] hover:text-red-500 rounded-lg hover:bg-red-50 transition-all tap-target"
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
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Eating Window</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={nutrition.windowStart}
                                onChange={e => setNutrition({ ...nutrition, windowStart: e.target.value })}
                                className="flex-1 p-2 bg-[var(--color-bg-subtle)] rounded-xl text-sm border border-[var(--color-border-light)] font-medium text-[var(--color-text)]"
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.target.style.borderColor = ''; }}
                            />
                            <span className="text-[var(--color-border)] font-bold">-</span>
                            <input
                                type="time"
                                value={nutrition.windowEnd}
                                onChange={e => setNutrition({ ...nutrition, windowEnd: e.target.value })}
                                className="flex-1 p-2 bg-[var(--color-bg-subtle)] rounded-xl text-sm border border-[var(--color-border-light)] font-medium text-[var(--color-text)]"
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.target.style.borderColor = ''; }}
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
        </>
    );
}
