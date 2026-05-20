'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Clock } from 'lucide-react';
import { getRecentExerciseNames } from '@/lib/workout-api';

interface Props {
    onSelect: (name: string) => void;
    onClose: () => void;
}

export function ExercisePicker({ onSelect, onClose }: Props) {
    const [query, setQuery] = useState('');
    const [recentNames, setRecentNames] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getRecentExerciseNames().then(setRecentNames).catch(() => {});
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const filtered = query.trim()
        ? recentNames.filter(n => n.toLowerCase().includes(query.toLowerCase()))
        : recentNames;

    const queryIsNew = query.trim() && !recentNames.some(
        n => n.toLowerCase() === query.trim().toLowerCase()
    );

    function handleSelect(name: string) {
        if (name.trim()) { onSelect(name.trim()); onClose(); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                className="w-full bg-[var(--color-surface-elevated)] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-[var(--color-border)] rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-[var(--color-border-light)]">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg text-[var(--color-text)]">Add Exercise</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-subtle)] transition-colors">
                            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search or type new exercise..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) handleSelect(query.trim()); }}
                            className="w-full pl-9 pr-4 py-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={e => { e.target.style.borderColor = ''; }}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-3 space-y-1">
                    {queryIsNew && (
                        <button
                            onClick={() => handleSelect(query.trim())}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                            style={{ background: 'rgba(29,95,168,0.06)', color: 'var(--color-primary)' }}
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(29,95,168,0.12)' }}>
                                <Plus className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Add "{query.trim()}"</span>
                        </button>
                    )}

                    {filtered.length > 0 && (
                        <>
                            {!query.trim() && (
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                                    <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Recent</span>
                                </div>
                            )}
                            {filtered.map(name => (
                                <button
                                    key={name}
                                    onClick={() => handleSelect(name)}
                                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--color-bg-subtle)] text-sm font-medium text-[var(--color-text)] transition-colors active:bg-[var(--color-bg-muted)]"
                                >
                                    {name}
                                </button>
                            ))}
                        </>
                    )}

                    {filtered.length === 0 && !queryIsNew && !query.trim() && (
                        <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
                            Type an exercise name to get started
                        </p>
                    )}

                    {filtered.length === 0 && query.trim() && !queryIsNew && (
                        <p className="text-center text-sm text-[var(--color-text-muted)] py-4">No matches</p>
                    )}
                </div>

                <div className="h-6" />
            </div>
        </div>
    );
}
