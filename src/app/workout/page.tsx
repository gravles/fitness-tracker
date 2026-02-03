'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Calendar, Dumbbell, Sparkles, Clock } from 'lucide-react';
import Link from 'next/link';

export default function WorkoutHubPage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-4 py-4 safe-top">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-xl transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-black tracking-tight">Workout Hub</h1>
                    <div className="w-10" />
                </div>
            </header>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Quick Start Section */}
                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Quick Start</h2>

                    <Link
                        href="/workout/active/new"
                        className="block p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg shadow-blue-200"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Play className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Start New Workout</h3>
                                <p className="text-blue-100 text-sm">Begin a blank workout session</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/coach"
                        className="block p-5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl text-white shadow-lg shadow-purple-200"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">AI Coach</h3>
                                <p className="text-purple-100 text-sm">Get a personalized workout recommendation</p>
                            </div>
                        </div>
                    </Link>
                </section>

                {/* Navigation Section */}
                <section className="space-y-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Manage</h2>

                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            href="/schedule"
                            className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors"
                        >
                            <Calendar className="w-6 h-6 text-blue-500 mb-2" />
                            <h3 className="font-bold text-gray-900">Schedule</h3>
                            <p className="text-xs text-gray-500">Plan your week</p>
                        </Link>

                        <Link
                            href="/schedule#templates"
                            className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors"
                        >
                            <Dumbbell className="w-6 h-6 text-purple-500 mb-2" />
                            <h3 className="font-bold text-gray-900">Templates</h3>
                            <p className="text-xs text-gray-500">Saved workouts</p>
                        </Link>

                        <Link
                            href="/progress"
                            className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors"
                        >
                            <Clock className="w-6 h-6 text-green-500 mb-2" />
                            <h3 className="font-bold text-gray-900">History</h3>
                            <p className="text-xs text-gray-500">Past workouts</p>
                        </Link>

                        <Link
                            href="/log"
                            className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-orange-200 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-orange-500 mb-2" />
                            <h3 className="font-bold text-gray-900">Back to Log</h3>
                            <p className="text-xs text-gray-500">Today's log</p>
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
