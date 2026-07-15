'use client';

import { useState, useEffect } from 'react';
import { getFavoriteFoods, getRecentFoods, deleteFavoriteFood, createSavedMeal, getSavedMeals, deleteSavedMeal, incrementSavedMealUseCount, FavoriteFood, SavedMeal } from '@/lib/api';
import { confirm } from '@/components/ConfirmDialog';
import { Search, Check, Trash2, Loader2, X, BookMarked, UtensilsCrossed } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './ui/Modal';

interface FoodSelectorProps {
    onClose: () => void;
    onSelect: (items: any[]) => void;
}

export function FoodSelector({ onClose, onSelect }: FoodSelectorProps) {
    const [tab, setTab] = useState<'favorites' | 'recent' | 'meals'>('favorites');
    const [loading, setLoading] = useState(true);
    const [savingMeal, setSavingMeal] = useState(false);
    const [mealNamePrompt, setMealNamePrompt] = useState(false);
    const [mealName, setMealName] = useState('');
    const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
    const [recent, setRecent] = useState<any[]>([]);
    const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, [tab]);

    // Clear selection when switching tabs
    useEffect(() => {
        setSelected(new Set());
    }, [tab]);

    async function loadData() {
        setLoading(true);
        try {
            if (tab === 'favorites') {
                const data = await getFavoriteFoods();
                setFavorites(data || []);
            } else if (tab === 'recent') {
                const data = await getRecentFoods();
                setRecent(data || []);
            } else {
                const data = await getSavedMeals();
                setSavedMeals(data || []);
            }
        } catch (e) {
            console.error('Error loading food data', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteFavorite(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!await confirm({ title: 'Remove Favorite', message: 'Remove from favorites?' })) return;
        try {
            await deleteFavoriteFood(id);
            setFavorites(favorites.filter(f => f.id !== id));
            setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (e) {
            console.error('Error deleting favorite', e);
        }
    }

    function toggleItem(key: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function handleConfirm() {
        const items = tab === 'favorites' ? favorites : recent;
        const picked = items.filter((item, idx) => selected.has(item.id ?? String(idx)));
        if (picked.length > 0) onSelect(picked);
    }

    const items = tab === 'favorites' ? favorites : recent;
    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const filteredMeals = savedMeals.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const content = (
        <Modal isOpen onClose={onClose} aria-label="Select food" size="md" zTier="top" padding={false} className="flex flex-col max-h-[85dvh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center bg-[var(--color-bg-subtle)] flex-shrink-0">
                    <div className="flex bg-[var(--color-bg-muted)] p-1 rounded-lg">
                        <button
                            onClick={() => setTab('favorites')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${tab === 'favorites' ? 'bg-[var(--color-surface-elevated)] shadow-sm text-[var(--color-danger)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                        >
                            Favorites
                        </button>
                        <button
                            onClick={() => setTab('recent')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${tab === 'recent' ? 'bg-[var(--color-surface-elevated)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                            style={tab === 'recent' ? { color: 'var(--color-primary)' } : undefined}
                        >
                            Recent
                        </button>
                        <button
                            onClick={() => setTab('meals')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${tab === 'meals' ? 'bg-[var(--color-surface-elevated)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                            style={tab === 'meals' ? { color: 'var(--color-success)' } : undefined}
                        >
                            Meals
                        </button>
                    </div>
                    <button onClick={onClose}>
                        <X className="w-5 h-5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border-light)] flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder={`Search ${tab}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-light)] rounded-xl outline-none text-sm font-medium text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={e => { e.target.style.borderColor = ''; }}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="py-10 flex justify-center text-[var(--color-text-muted)]">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : tab === 'meals' ? (
                        filteredMeals.length === 0 ? (
                            <div className="py-10 text-center text-[var(--color-text-muted)] text-sm">
                                {search ? 'No matches found.' : 'No saved meals yet. Select foods and tap "Save as Meal"!'}
                            </div>
                        ) : filteredMeals.map(meal => (
                            <div
                                key={meal.id}
                                className="group flex justify-between items-center p-3 rounded-xl border transition-all"
                                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-light)' }}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)' }}>
                                        <UtensilsCrossed className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-[var(--color-text)] truncate">{meal.name}</p>
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            {meal.total_calories} kcal · {meal.total_protein}g P · {meal.food_items.length} items
                                            {meal.use_count > 0 && <span className="ml-1 opacity-60">· used {meal.use_count}×</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={async () => {
                                            await incrementSavedMealUseCount(meal.id);
                                            onSelect(meal.food_items);
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                                        style={{ background: 'var(--color-success)' }}
                                    >
                                        Log
                                    </button>
                                    <button
                                        onClick={async e => {
                                            e.stopPropagation();
                                            if (!await confirm({ title: 'Delete Meal', message: `Delete "${meal.name}"?` })) return;
                                            await deleteSavedMeal(meal.id);
                                            setSavedMeals(prev => prev.filter(m => m.id !== meal.id));
                                        }}
                                        className="w-7 h-7 rounded-full bg-red-50 text-[var(--color-danger)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-[var(--color-text-muted)] text-sm">
                            {search ? 'No matches found.' : tab === 'favorites' ? 'No favorites yet. Star items in your daily log!' : 'No recent history found.'}
                        </div>
                    ) : (
                        filtered.map((item, idx) => {
                            const key = item.id ?? String(idx);
                            const isSelected = selected.has(key);
                            return (
                                <div
                                    key={key}
                                    onClick={() => toggleItem(key)}
                                    className="group flex justify-between items-center p-3 rounded-xl cursor-pointer transition-all border"
                                    style={{
                                        background: isSelected ? 'var(--color-gold-muted)' : 'transparent',
                                        borderColor: isSelected ? 'var(--color-gold)' : 'transparent',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-subtle)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                >
                                    {/* Checkbox */}
                                    <div
                                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mr-3 transition-all"
                                        style={{
                                            borderColor: isSelected ? 'var(--color-gold)' : 'var(--color-border)',
                                            background: isSelected ? 'var(--color-gold)' : 'transparent',
                                        }}
                                    >
                                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-[var(--color-text)] flex items-center gap-2">
                                            <span className="truncate">{item.name}</span>
                                            {tab === 'recent' && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] rounded-full flex-shrink-0">History</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                            {Math.round(item.calories)} kcal • {Math.round(item.protein)}g P • {Math.round(item.carbs)}g C • {Math.round(item.fat)}g F
                                            {item.portion_estimate && <span className="ml-2 opacity-60">• {item.portion_estimate}</span>}
                                        </div>
                                    </div>

                                    {/* Delete (favorites only) */}
                                    {tab === 'favorites' && (
                                        <button
                                            onClick={(e) => handleDeleteFavorite(e, item.id)}
                                            className="w-8 h-8 rounded-full bg-red-50 text-[var(--color-danger)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100 flex-shrink-0 ml-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer — hidden on the Meals tab since each meal has its own Log button */}
                {tab !== 'meals' && <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-elevated)] flex-shrink-0 space-y-2">
                    {/* Save as meal name prompt */}
                    {mealNamePrompt && (
                        <div className="flex gap-2 animate-in slide-in-from-bottom">
                            <input
                                type="text"
                                value={mealName}
                                onChange={e => setMealName(e.target.value)}
                                placeholder="Meal name (e.g. Post-workout shake)"
                                autoFocus
                                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                onKeyDown={async e => {
                                    if (e.key === 'Enter' && mealName.trim()) {
                                        setSavingMeal(true);
                                        try {
                                            const allItems = tab === 'favorites' ? favorites : recent;
                                            const picked = allItems.filter((item, idx) => selected.has(item.id ?? String(idx)));
                                            await createSavedMeal(mealName.trim(), picked);
                                            const { toast } = await import('sonner');
                                            toast.success(`"${mealName.trim()}" saved!`);
                                            setMealNamePrompt(false);
                                            setMealName('');
                                        } catch { } finally { setSavingMeal(false); }
                                    }
                                    if (e.key === 'Escape') { e.stopPropagation(); setMealNamePrompt(false); setMealName(''); }
                                }}
                            />
                            <button
                                disabled={!mealName.trim() || savingMeal}
                                onClick={async () => {
                                    if (!mealName.trim()) return;
                                    setSavingMeal(true);
                                    try {
                                        const allItems = tab === 'favorites' ? favorites : recent;
                                        const picked = allItems.filter((item, idx) => selected.has(item.id ?? String(idx)));
                                        await createSavedMeal(mealName.trim(), picked);
                                        const { toast } = await import('sonner');
                                        toast.success(`"${mealName.trim()}" saved!`);
                                        setMealNamePrompt(false);
                                        setMealName('');
                                    } catch { } finally { setSavingMeal(false); }
                                }}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
                                style={{ background: 'var(--color-gold)', color: 'white' }}
                            >
                                {savingMeal ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                            </button>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={handleConfirm}
                            disabled={selected.size === 0}
                            className="flex-1 py-3.5 rounded-xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {selected.size === 0
                                ? 'Tap items to select'
                                : `Add ${selected.size} item${selected.size > 1 ? 's' : ''} to log`}
                        </button>
                        {selected.size >= 2 && !mealNamePrompt && (
                            <button
                                onClick={() => setMealNamePrompt(true)}
                                className="px-4 rounded-xl font-bold transition-all active:scale-[0.98]"
                                style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold)', border: '1px solid var(--color-gold)' }}
                                title="Save selection as a reusable meal"
                            >
                                <BookMarked className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>}
        </Modal>
    );

    return createPortal(content, document.body);
}
