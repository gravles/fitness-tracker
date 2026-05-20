'use client';

import { useState, useEffect } from 'react';
import { getFavoriteFoods, getRecentFoods, deleteFavoriteFood, FavoriteFood } from '@/lib/api';
import { Search, Plus, Trash2, Loader2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface FoodSelectorProps {
    onClose: () => void;
    onSelect: (item: any) => void;
}

export function FoodSelector({ onClose, onSelect }: FoodSelectorProps) {
    const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
    const [recent, setRecent] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadData();
    }, [tab]);

    async function loadData() {
        setLoading(true);
        try {
            if (tab === 'favorites') {
                const data = await getFavoriteFoods();
                setFavorites(data || []);
            } else {
                const data = await getRecentFoods();
                setRecent(data || []);
            }
        } catch (e) {
            console.error('Error loading food data', e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteFavorite(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!confirm('Remove from favorites?')) return;
        try {
            await deleteFavoriteFood(id);
            setFavorites(favorites.filter(f => f.id !== id));
        } catch (e) {
            console.error('Error deleting favorite', e);
        }
    }

    const items = tab === 'favorites' ? favorites : recent;
    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const content = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in" style={{ position: 'fixed' }}>
            <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center bg-[var(--color-bg-subtle)]">
                    <div className="flex bg-[var(--color-bg-muted)] p-1 rounded-lg">
                        <button
                            onClick={() => setTab('favorites')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${tab === 'favorites' ? 'bg-[var(--color-surface-elevated)] shadow-sm text-red-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                        >
                            Favorites
                        </button>
                        <button
                            onClick={() => setTab('recent')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${tab === 'recent' ? 'bg-[var(--color-surface-elevated)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                            style={tab === 'recent' ? { color: 'var(--color-primary)' } : undefined}
                        >
                            Recent
                        </button>
                    </div>
                    <button onClick={onClose}>
                        <X className="w-5 h-5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border-light)]">
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
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-[var(--color-text-muted)] text-sm">
                            {search ? 'No matches found.' : tab === 'favorites' ? 'No favorites yet. Star items in your daily log!' : 'No recent history found.'}
                        </div>
                    ) : (
                        filtered.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                onClick={() => onSelect(item)}
                                className="group flex justify-between items-center p-3 hover:bg-[var(--color-bg-subtle)] rounded-xl cursor-pointer transition-colors border border-transparent hover:border-[var(--color-border-light)]"
                            >
                                <div>
                                    <div className="font-bold text-[var(--color-text)] flex items-center gap-2">
                                        {item.name}
                                        {tab === 'recent' && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] rounded-full">History</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                                        {Math.round(item.calories)} kcal • {Math.round(item.protein)}g P • {Math.round(item.carbs)}g C • {Math.round(item.fat)}g F
                                        {item.portion_estimate && <span className="ml-2 opacity-60">• {item.portion_estimate}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                        style={{ background: 'rgba(29,95,168,0.1)', color: 'var(--color-primary)' }}
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                    {tab === 'favorites' && (
                                        <button
                                            onClick={(e) => handleDeleteFavorite(e, item.id)}
                                            className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
