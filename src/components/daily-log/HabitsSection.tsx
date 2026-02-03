'use client';

import { Check, Settings } from 'lucide-react';
import Link from 'next/link';

interface HabitsSectionProps {
    habits: string[];
    setHabits: (habits: string[]) => void;
    availableHabits: string[];
}

export function HabitsSection({ habits, setHabits, availableHabits }: HabitsSectionProps) {

    function toggleHabit(habit: string) {
        if (habits.includes(habit)) {
            setHabits(habits.filter(h => h !== habit));
        } else {
            setHabits([...habits, habit]);
        }
    }

    // Show empty state instead of hiding completely
    if (!availableHabits || availableHabits.length === 0) {
        return (
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">✅</span> Daily Habits
                </h3>
                <div className="text-center py-6">
                    <p className="text-gray-500 mb-3">No habits configured yet</p>
                    <Link
                        href="/profile#habits"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Set up habits
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">✅</span> Daily Habits
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {availableHabits.map((habit) => {
                    const isCompleted = habits.includes(habit);
                    return (
                        <button
                            key={habit}
                            onClick={() => toggleHabit(habit)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${isCompleted
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-blue-200'
                                }`}
                        >
                            <span className="font-medium text-sm">{habit}</span>
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'bg-white border-gray-300 group-hover:border-blue-300'
                                }`}>
                                {isCompleted && <Check className="w-3.5 h-3.5" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
