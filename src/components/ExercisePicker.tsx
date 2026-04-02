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
        if (name.trim()) {
            onSelect(name.trim());
            onClose();
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                className="w-full bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg text-gray-900">Add Exercise</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search or type new exercise..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && query.trim()) handleSelect(query.trim());
                            }}
                            className="w-full pl-9 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-3 space-y-1">
                    {/* Add custom (if query doesn't match existing) */}
                    {queryIsNew && (
                        <button
                            onClick={() => handleSelect(query.trim())}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-left"
                        >
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Plus className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Add "{query.trim()}"</span>
                        </button>
                    )}

                    {/* Recent exercises */}
                    {filtered.length > 0 && (
                        <>
                            {!query.trim() && (
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Recent</span>
                                </div>
                            )}
                            {filtered.map(name => (
                                <button
                                    key={name}
                                    onClick={() => handleSelect(name)}
                                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-800 transition-colors active:bg-gray-100"
                                >
                                    {name}
                                </button>
                            ))}
                        </>
                    )}

                    {/* No results + no query */}
                    {filtered.length === 0 && !queryIsNew && !query.trim() && (
                        <p className="text-center text-sm text-gray-400 py-8">
                            Type an exercise name to get started
                        </p>
                    )}

                    {/* No match */}
                    {filtered.length === 0 && query.trim() && !queryIsNew && (
                        <p className="text-center text-sm text-gray-400 py-4">No matches</p>
                    )}
                </div>

                {/* Safe area spacer */}
                <div className="h-6" />
            </div>
        </div>
    );
}
