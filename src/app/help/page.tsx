'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronRight, Mic, Camera, Brain, Dumbbell, Settings, Utensils } from 'lucide-react';

export default function HelpPage() {
    const [openSection, setOpenSection] = useState<string | null>('quick-start');

    const toggle = (id: string) => setOpenSection(openSection === id ? null : id);

    return (
        <main className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="p-4 flex items-center gap-4">
                    <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <h1 className="text-xl font-bold">Help & User Guide</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 space-y-6">

                {/* Quick Start */}
                <Section
                    id="quick-start"
                    title="🚀 Quick Start"
                    isOpen={openSection === 'quick-start'}
                    onClick={() => toggle('quick-start')}
                >
                    <div className="space-y-4 text-gray-600">
                        <p>Welcome! Here is the fastest way to get value from the app:</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li><strong>Set your Goals:</strong> Go to Settings to define your target weight and protein.</li>
                            <li><strong>Log your first Meal:</strong> Tap the big "Log Today" button on the dashboard.</li>
                            <li><strong>Track a Workout:</strong> Ask the <span className="text-purple-600 font-bold">Smart Coach</span> to build you a routine.</li>
                        </ol>
                    </div>
                </Section>

                {/* Smart Food Logging */}
                <Section
                    id="food"
                    title="🥗 Smart Food Logging"
                    icon={<Utensils className="w-5 h-5 text-green-500" />}
                    isOpen={openSection === 'food'}
                    onClick={() => toggle('food')}
                >
                    <div className="space-y-4 text-gray-600">
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <h4 className="font-bold text-green-800 flex items-center gap-2 mb-2">
                                <Mic className="w-4 h-4" /> Voice Logging
                            </h4>
                            <p className="text-sm">
                                Tap the Microphone icon and simply say what you ate.
                                <br /><em>"I had 2 eggs, toast, and a black coffee."</em>
                                <br />The AI will calculate the macros automatically.
                            </p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                                <Camera className="w-4 h-4" /> Snap & Track
                            </h4>
                            <p className="text-sm">
                                Not sure about calories? Take a photo of your meal. The AI analyzes the image to estimate portion sizes and nutritional content.
                            </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-2">
                                <Brain className="w-4 h-4" /> Menu Scanner
                            </h4>
                            <p className="text-sm">
                                At a restaurant? Open the "Scan Menu" feature (in the Log page) and take a picture of the physical menu. The AI will recommend the healthiest, high-protein options.
                            </p>
                        </div>
                    </div>
                </Section>

                {/* Workouts & Coach */}
                <Section
                    id="workouts"
                    title="🏋️‍♂️ Workouts & Coach"
                    icon={<Dumbbell className="w-5 h-5 text-indigo-500" />}
                    isOpen={openSection === 'workouts'}
                    onClick={() => toggle('workouts')}
                >
                    <div className="space-y-4 text-gray-600">
                        <p>
                            <strong>Smart Coach:</strong> Go to the Coach tab and ask for anything.
                            <br /><em>"Build me a generic gym workout."</em>
                            <br /><em>"I only have dumbbells, give me a leg day."</em>
                        </p>
                        <p>
                            <strong>Saving Workouts:</strong> When the Coach suggests a routine, a blue <span className="text-blue-600 font-bold">Save to Templates</span> button will appear. Click it to store the workout.
                        </p>
                        <p>
                            <strong>Active Tracking:</strong>
                            <br />1. Go to <strong>Workout Builder</strong> (linked from Log).
                            <br />2. Click "Start" on a template.
                            <br />3. Log your sets/reps in real-time. The timer runs automatically.
                            <br />4. Click "Finish" to save it to your history.
                        </p>
                    </div>
                </Section>

                {/* Settings & Equipment */}
                <Section
                    id="settings"
                    title="⚙️ Settings & Equipment"
                    icon={<Settings className="w-5 h-5 text-gray-500" />}
                    isOpen={openSection === 'settings'}
                    onClick={() => toggle('settings')}
                >
                    <div className="space-y-4 text-gray-600">
                        <p>
                            <strong>Available Equipment:</strong>
                            <br />In Settings, list the equipment you have at home (e.g., "Dumbbells", "Pull-up Bar"). The AI Coach will ONLY suggest exercises you can actually perform.
                        </p>
                        <p>
                            <strong>Integrations:</strong>
                            <br />Connect <strong>Strava</strong> to automatically import your runs and cycling sessions.
                        </p>
                    </div>
                </Section>

            </div>
        </main>
    );
}

function Section({ id, title, icon, isOpen, onClick, children }: any) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                onClick={onClick}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-bold text-gray-900">{title}</span>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>
            {isOpen && (
                <div className="p-4 pt-0 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="mt-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
